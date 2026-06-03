import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WeeklyAggregationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(WeeklyAggregationService.name);
  }

  async aggregateWeek(year: number, weekNumber: number): Promise<{
    processed: number;
    errors: number;
  }> {
    const weekDates = this.getWeekDates(year, weekNumber);
    const { weekStart, weekEnd } = weekDates;

    this.logger.info(
      { year, weekNumber, weekStart, weekEnd },
      'Starting weekly aggregation'
    );

    // Get all monitors that have daily summaries for this week
    const monitorsWithData = await this.prisma.monitorDailySummary.groupBy({
      by: ['monitorId'],
      where: {
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      _count: {
        id: true,
      },
    });

    this.logger.info(
      { monitorCount: monitorsWithData.length, year, weekNumber },
      'Found monitors with daily data'
    );

    let processed = 0;
    let errors = 0;

    for (const monitorGroup of monitorsWithData) {
      try {
        await this.aggregateMonitorForWeek(
          monitorGroup.monitorId,
          year,
          weekNumber,
          weekStart,
          weekEnd
        );
        processed++;
      } catch (error) {
        errors++;
        this.logger.error(
          {
            monitorId: monitorGroup.monitorId,
            year,
            weekNumber,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          'Failed to aggregate weekly data for monitor'
        );
      }
    }

    this.logger.info(
      { processed, errors, total: monitorsWithData.length, year, weekNumber },
      'Weekly aggregation completed'
    );

    return { processed, errors };
  }

  private async aggregateMonitorForWeek(
    monitorId: string,
    year: number,
    weekNumber: number,
    weekStart: Date,
    weekEnd: Date
  ): Promise<void> {
    // Get all daily summaries for this monitor in this week
    const dailySummaries = await this.prisma.monitorDailySummary.findMany({
      where: {
        monitorId,
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
    });

    if (dailySummaries.length === 0) {
      return;
    }

    // Aggregate weekly statistics from daily summaries
    const totalChecks = dailySummaries.reduce((sum, d) => sum + d.totalChecks, 0);
    const upChecks = dailySummaries.reduce((sum, d) => sum + d.upChecks, 0);
    const downChecks = dailySummaries.reduce((sum, d) => sum + d.downChecks, 0);
    const uptimePercentage = totalChecks > 0 ? (upChecks / totalChecks) * 100 : 0;

    // Aggregate latency metrics (weighted by number of checks per day)
    let totalLatencyWeight = 0;
    let weightedLatencySum = 0;
    const allP95Latencies: number[] = [];
    const allP99Latencies: number[] = [];
    let globalMinLatency: number | null = null;
    let globalMaxLatency: number | null = null;

    for (const day of dailySummaries) {
      if (day.avgLatencyMs !== null && day.totalChecks > 0) {
        weightedLatencySum += day.avgLatencyMs * day.totalChecks;
        totalLatencyWeight += day.totalChecks;
      }
      if (day.minLatencyMs !== null) {
        globalMinLatency = globalMinLatency === null 
          ? day.minLatencyMs 
          : Math.min(globalMinLatency, day.minLatencyMs);
      }
      if (day.maxLatencyMs !== null) {
        globalMaxLatency = globalMaxLatency === null 
          ? day.maxLatencyMs 
          : Math.max(globalMaxLatency, day.maxLatencyMs);
      }
      if (day.p95LatencyMs !== null) {
        allP95Latencies.push(day.p95LatencyMs);
      }
      if (day.p99LatencyMs !== null) {
        allP99Latencies.push(day.p99LatencyMs);
      }
    }

    const avgLatencyMs = totalLatencyWeight > 0 ? weightedLatencySum / totalLatencyWeight : null;
    const minLatencyMs = globalMinLatency;
    const maxLatencyMs = globalMaxLatency;
    
    // Calculate weekly p95/p99 as average of daily p95/p99 values
    const p95LatencyMs = allP95Latencies.length > 0 
      ? Math.round(allP95Latencies.reduce((a, b) => a + b, 0) / allP95Latencies.length) 
      : null;
    const p99LatencyMs = allP99Latencies.length > 0 
      ? Math.round(allP99Latencies.reduce((a, b) => a + b, 0) / allP99Latencies.length) 
      : null;

    // Aggregate incident data
    const incidentsCount = dailySummaries.reduce((sum, d) => sum + d.incidentsCount, 0);
    const totalDowntimeMinutes = dailySummaries.reduce((sum, d) => sum + d.totalDowntimeMinutes, 0);

    // Upsert the weekly summary
    await this.prisma.monitorWeeklySummary.upsert({
      where: {
        monitorId_year_weekNumber: {
          monitorId,
          year,
          weekNumber,
        },
      },
      update: {
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
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
        daysWithData: dailySummaries.length,
        updatedAt: new Date(),
      },
      create: {
        monitorId,
        year,
        weekNumber,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
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
        daysWithData: dailySummaries.length,
      },
    });

    this.logger.debug(
      { monitorId, year, weekNumber, totalChecks, daysWithData: dailySummaries.length },
      'Weekly summary created/updated'
    );
  }

  private getWeekDates(year: number, weekNumber: number): { weekStart: Date; weekEnd: Date } {
    // ISO week date calculation
    const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }

    const weekStart = new Date(ISOweekStart);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return { weekStart, weekEnd };
  }

  async deleteDailySummariesForWeek(year: number, weekNumber: number): Promise<number> {
    const { weekStart, weekEnd } = this.getWeekDates(year, weekNumber);

    const result = await this.prisma.monitorDailySummary.deleteMany({
      where: {
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
    });

    this.logger.info(
      { year, weekNumber, deletedCount: result.count, weekStart, weekEnd },
      'Deleted daily summaries after weekly aggregation'
    );

    return result.count;
  }

  async getPreviousWeekInfo(): Promise<{ year: number; weekNumber: number } | null> {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Get current week number
    const currentWeek = this.getWeekNumber(now);
    
    // Calculate previous week
    let prevYear = currentYear;
    let prevWeek = currentWeek - 1;
    
    if (prevWeek === 0) {
      // Go to last week of previous year
      prevYear = currentYear - 1;
      // Week 52 or 53 depending on the year
      const lastDayOfPrevYear = new Date(prevYear, 11, 31);
      prevWeek = this.getWeekNumber(lastDayOfPrevYear);
    }
    
    return { year: prevYear, weekNumber: prevWeek };
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}
