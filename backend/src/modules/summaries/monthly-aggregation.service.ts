import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MonthlyAggregationService {
  private readonly isDevelopment: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MonthlyAggregationService.name);
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private logInfo(data: Record<string, unknown>, message: string): void {
    if (this.isDevelopment) {
      this.logger.debug(data, message);
      return;
    }

    this.logger.info(data, message);
  }

  async aggregateMonth(year: number, month: number): Promise<{
    processed: number;
    errors: number;
  }> {
    const monthDates = this.getMonthDates(year, month);
    const { monthStart, monthEnd } = monthDates;

    this.logInfo(
      { year, month, monthStart, monthEnd },
      'Starting monthly aggregation'
    );

    // Get all monitors that have weekly summaries for this month
    const monitorsWithData = await this.prisma.monitorWeeklySummary.groupBy({
      by: ['monitorId'],
      where: {
        year,
        weekStartDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _count: {
        id: true,
      },
    });

    this.logInfo(
      { monitorCount: monitorsWithData.length, year, month },
      'Found monitors with weekly data'
    );

    let processed = 0;
    let errors = 0;

    for (const monitorGroup of monitorsWithData) {
      try {
        await this.aggregateMonitorForMonth(
          monitorGroup.monitorId,
          year,
          month,
          monthStart,
          monthEnd
        );
        processed++;
      } catch (error) {
        errors++;
        this.logger.error(
          {
            monitorId: monitorGroup.monitorId,
            year,
            month,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          'Failed to aggregate monthly data for monitor'
        );
      }
    }

    this.logInfo(
      { processed, errors, total: monitorsWithData.length, year, month },
      'Monthly aggregation completed'
    );

    return { processed, errors };
  }

  private async aggregateMonitorForMonth(
    monitorId: string,
    year: number,
    month: number,
    monthStart: Date,
    monthEnd: Date
  ): Promise<void> {
    // Get all weekly summaries for this monitor in this month
    const weeklySummaries = await this.prisma.monitorWeeklySummary.findMany({
      where: {
        monitorId,
        year,
        weekStartDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    if (weeklySummaries.length === 0) {
      return;
    }

    // Aggregate monthly statistics from weekly summaries
    const totalChecks = weeklySummaries.reduce((sum, w) => sum + w.totalChecks, 0);
    const upChecks = weeklySummaries.reduce((sum, w) => sum + w.upChecks, 0);
    const downChecks = weeklySummaries.reduce((sum, w) => sum + w.downChecks, 0);
    const uptimePercentage = totalChecks > 0 ? (upChecks / totalChecks) * 100 : 0;

    // Aggregate latency metrics (weighted by number of checks per week)
    let totalLatencyWeight = 0;
    let weightedLatencySum = 0;
    const allP95Latencies: number[] = [];
    const allP99Latencies: number[] = [];
    let globalMinLatency: number | null = null;
    let globalMaxLatency: number | null = null;

    for (const week of weeklySummaries) {
      if (week.avgLatencyMs !== null && week.totalChecks > 0) {
        weightedLatencySum += week.avgLatencyMs * week.totalChecks;
        totalLatencyWeight += week.totalChecks;
      }
      if (week.minLatencyMs !== null) {
        globalMinLatency = globalMinLatency === null 
          ? week.minLatencyMs 
          : Math.min(globalMinLatency, week.minLatencyMs);
      }
      if (week.maxLatencyMs !== null) {
        globalMaxLatency = globalMaxLatency === null 
          ? week.maxLatencyMs 
          : Math.max(globalMaxLatency, week.maxLatencyMs);
      }
      if (week.p95LatencyMs !== null) {
        allP95Latencies.push(week.p95LatencyMs);
      }
      if (week.p99LatencyMs !== null) {
        allP99Latencies.push(week.p99LatencyMs);
      }
    }

    const avgLatencyMs = totalLatencyWeight > 0 ? weightedLatencySum / totalLatencyWeight : null;
    const minLatencyMs = globalMinLatency;
    const maxLatencyMs = globalMaxLatency;
    
    // Calculate monthly p95/p99 as average of weekly p95/p99 values
    const p95LatencyMs = allP95Latencies.length > 0 
      ? Math.round(allP95Latencies.reduce((a, b) => a + b, 0) / allP95Latencies.length) 
      : null;
    const p99LatencyMs = allP99Latencies.length > 0 
      ? Math.round(allP99Latencies.reduce((a, b) => a + b, 0) / allP99Latencies.length) 
      : null;

    // Aggregate incident data
    const incidentsCount = weeklySummaries.reduce((sum, w) => sum + w.incidentsCount, 0);
    const totalDowntimeMinutes = weeklySummaries.reduce((sum, w) => sum + w.totalDowntimeMinutes, 0);

    // Upsert the monthly summary
    await this.prisma.monitorMonthlySummary.upsert({
      where: {
        monitorId_year_month: {
          monitorId,
          year,
          month,
        },
      },
      update: {
        monthStartDate: monthStart,
        monthEndDate: monthEnd,
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
        weeksWithData: weeklySummaries.length,
        updatedAt: new Date(),
      },
      create: {
        monitorId,
        year,
        month,
        monthStartDate: monthStart,
        monthEndDate: monthEnd,
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
        weeksWithData: weeklySummaries.length,
      },
    });

    this.logger.debug(
      { monitorId, year, month, totalChecks, weeksWithData: weeklySummaries.length },
      'Monthly summary created/updated'
    );
  }

  private getMonthDates(year: number, month: number): { monthStart: Date; monthEnd: Date } {
    const monthStart = new Date(year, month - 1, 1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date(year, month, 0); // Last day of month
    monthEnd.setHours(23, 59, 59, 999);

    return { monthStart, monthEnd };
  }

  async deleteWeeklySummariesForMonth(year: number, month: number): Promise<number> {
    const { monthStart, monthEnd } = this.getMonthDates(year, month);

    const result = await this.prisma.monitorWeeklySummary.deleteMany({
      where: {
        year,
        weekStartDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    this.logInfo(
      { year, month, deletedCount: result.count, monthStart, monthEnd },
      'Deleted weekly summaries after monthly aggregation'
    );

    return result.count;
  }

  async getPreviousMonthInfo(): Promise<{ year: number; month: number } | null> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    // Calculate previous month
    let prevYear = currentYear;
    let prevMonth = currentMonth - 1;

    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = currentYear - 1;
    }

    return { year: prevYear, month: prevMonth };
  }
}
