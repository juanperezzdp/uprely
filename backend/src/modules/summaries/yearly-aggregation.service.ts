import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class YearlyAggregationService {
  private readonly isDevelopment: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(YearlyAggregationService.name);
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private logInfo(data: Record<string, unknown>, message: string): void {
    if (this.isDevelopment) {
      this.logger.debug(data, message);
      return;
    }

    this.logger.info(data, message);
  }

  async aggregateYear(year: number): Promise<{
    processed: number;
    errors: number;
  }> {
    const yearDates = this.getYearDates(year);
    const { yearStart, yearEnd } = yearDates;

    this.logInfo(
      { year, yearStart, yearEnd },
      'Starting yearly aggregation'
    );

    // Get all monitors that have monthly summaries for this year
    const monitorsWithData = await this.prisma.monitorMonthlySummary.groupBy({
      by: ['monitorId'],
      where: {
        year,
        monthStartDate: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      _count: {
        id: true,
      },
    });

    this.logInfo(
      { monitorCount: monitorsWithData.length, year },
      'Found monitors with monthly data'
    );

    let processed = 0;
    let errors = 0;

    for (const monitorGroup of monitorsWithData) {
      try {
        await this.aggregateMonitorForYear(
          monitorGroup.monitorId,
          year,
          yearStart,
          yearEnd
        );
        processed++;
      } catch (error) {
        errors++;
        this.logger.error(
          {
            monitorId: monitorGroup.monitorId,
            year,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          'Failed to aggregate yearly data for monitor'
        );
      }
    }

    this.logInfo(
      { processed, errors, total: monitorsWithData.length, year },
      'Yearly aggregation completed'
    );

    return { processed, errors };
  }

  private async aggregateMonitorForYear(
    monitorId: string,
    year: number,
    yearStart: Date,
    yearEnd: Date
  ): Promise<void> {
    // Get all monthly summaries for this monitor in this year
    const monthlySummaries = await this.prisma.monitorMonthlySummary.findMany({
      where: {
        monitorId,
        year,
        monthStartDate: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
    });

    if (monthlySummaries.length === 0) {
      return;
    }

    // Aggregate yearly statistics from monthly summaries
    const totalChecks = monthlySummaries.reduce((sum, m) => sum + m.totalChecks, 0);
    const upChecks = monthlySummaries.reduce((sum, m) => sum + m.upChecks, 0);
    const downChecks = monthlySummaries.reduce((sum, m) => sum + m.downChecks, 0);
    const uptimePercentage = totalChecks > 0 ? (upChecks / totalChecks) * 100 : 0;

    // Aggregate latency metrics (weighted by number of checks per month)
    let totalLatencyWeight = 0;
    let weightedLatencySum = 0;
    const allP95Latencies: number[] = [];
    const allP99Latencies: number[] = [];
    let globalMinLatency: number | null = null;
    let globalMaxLatency: number | null = null;

    for (const month of monthlySummaries) {
      if (month.avgLatencyMs !== null && month.totalChecks > 0) {
        weightedLatencySum += month.avgLatencyMs * month.totalChecks;
        totalLatencyWeight += month.totalChecks;
      }
      if (month.minLatencyMs !== null) {
        globalMinLatency = globalMinLatency === null 
          ? month.minLatencyMs 
          : Math.min(globalMinLatency, month.minLatencyMs);
      }
      if (month.maxLatencyMs !== null) {
        globalMaxLatency = globalMaxLatency === null 
          ? month.maxLatencyMs 
          : Math.max(globalMaxLatency, month.maxLatencyMs);
      }
      if (month.p95LatencyMs !== null) {
        allP95Latencies.push(month.p95LatencyMs);
      }
      if (month.p99LatencyMs !== null) {
        allP99Latencies.push(month.p99LatencyMs);
      }
    }

    const avgLatencyMs = totalLatencyWeight > 0 ? weightedLatencySum / totalLatencyWeight : null;
    const minLatencyMs = globalMinLatency;
    const maxLatencyMs = globalMaxLatency;
    
    // Calculate yearly p95/p99 as average of monthly p95/p99 values
    const p95LatencyMs = allP95Latencies.length > 0 
      ? Math.round(allP95Latencies.reduce((a, b) => a + b, 0) / allP95Latencies.length) 
      : null;
    const p99LatencyMs = allP99Latencies.length > 0 
      ? Math.round(allP99Latencies.reduce((a, b) => a + b, 0) / allP99Latencies.length) 
      : null;

    // Aggregate incident data
    const incidentsCount = monthlySummaries.reduce((sum, m) => sum + m.incidentsCount, 0);
    const totalDowntimeMinutes = monthlySummaries.reduce((sum, m) => sum + m.totalDowntimeMinutes, 0);

    // Upsert the yearly summary
    await this.prisma.monitorYearlySummary.upsert({
      where: {
        monitorId_year: {
          monitorId,
          year,
        },
      },
      update: {
        yearStartDate: yearStart,
        yearEndDate: yearEnd,
        totalChecks,
        upChecks,
        downChecks,
        uptimePercentage,
        avgLatencyMs,
        minLatencyMs,
        maxLatencyMs,
        p95LatencyMs,
        p99LatencyMs,
        incidentsCount,
        totalDowntimeMinutes,
        monthsWithData: monthlySummaries.length,
        updatedAt: new Date(),
      },
      create: {
        monitorId,
        year,
        yearStartDate: yearStart,
        yearEndDate: yearEnd,
        totalChecks,
        upChecks,
        downChecks,
        uptimePercentage,
        avgLatencyMs,
        minLatencyMs,
        maxLatencyMs,
        p95LatencyMs,
        p99LatencyMs,
        incidentsCount,
        totalDowntimeMinutes,
        monthsWithData: monthlySummaries.length,
      },
    });

    this.logger.debug(
      { monitorId, year, totalChecks, monthsWithData: monthlySummaries.length },
      'Yearly summary created/updated'
    );
  }

  private getYearDates(year: number): { yearStart: Date; yearEnd: Date } {
    const yearStart = new Date(year, 0, 1);
    yearStart.setHours(0, 0, 0, 0);

    const yearEnd = new Date(year, 11, 31);
    yearEnd.setHours(23, 59, 59, 999);

    return { yearStart, yearEnd };
  }

  async deleteMonthlySummariesForYear(year: number): Promise<number> {
    const result = await this.prisma.monitorMonthlySummary.deleteMany({
      where: {
        year,
      },
    });

    this.logInfo(
      { year, deletedCount: result.count },
      'Deleted monthly summaries after yearly aggregation'
    );

    return result.count;
  }

  getPreviousYearInfo(): { year: number } {
    const now = new Date();
    const currentYear = now.getFullYear();
    return { year: currentYear - 1 };
  }
}
