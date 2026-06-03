import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service';
import type { DailyAggregationResult } from './summaries.types';

@Injectable()
export class DailyAggregationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DailyAggregationService.name);
  }

  async aggregateDate(date: Date): Promise<{
    processed: number;
    errors: number;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    this.logger.info(
      { date: date.toISOString().split('T')[0], startOfDay, endOfDay },
      'Starting daily aggregation'
    );

    // Get all monitors that have check results for this date
    const monitorsWithChecks = await this.prisma.checkResult.groupBy({
      by: ['monitorId'],
      where: {
        checkedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      _count: {
        id: true,
      },
    });

    this.logger.info(
      { monitorCount: monitorsWithChecks.length },
      'Found monitors with checks'
    );

    let processed = 0;
    let errors = 0;

    for (const monitorGroup of monitorsWithChecks) {
      try {
        await this.aggregateMonitorForDate(
          monitorGroup.monitorId,
          startOfDay,
          endOfDay
        );
        processed++;
      } catch (error) {
        errors++;
        this.logger.error(
          { 
            monitorId: monitorGroup.monitorId, 
            date: date.toISOString().split('T')[0],
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          'Failed to aggregate monitor'
        );
      }
    }

    this.logger.info(
      { processed, errors, total: monitorsWithChecks.length },
      'Daily aggregation completed'
    );

    return { processed, errors };
  }

  private async aggregateMonitorForDate(
    monitorId: string,
    startOfDay: Date,
    endOfDay: Date
  ): Promise<void> {
    // Get all checks for this monitor on this date
    const checks = await this.prisma.checkResult.findMany({
      where: {
        monitorId,
        checkedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        isUp: true,
        latencyMs: true,
      },
      orderBy: {
        checkedAt: 'asc',
      },
    });

    if (checks.length === 0) {
      return;
    }

    // Calculate statistics
    const totalChecks = checks.length;
    const upChecks = checks.filter(c => c.isUp).length;
    const downChecks = totalChecks - upChecks;
    const uptimePercentage = (upChecks / totalChecks) * 100;

    // Calculate latency statistics
    const latencies = checks
      .map(c => c.latencyMs)
      .filter((l): l is number => l !== null && l !== undefined)
      .sort((a, b) => a - b);

    const avgLatencyMs = latencies.length > 0 
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
      : null;
    
    const minLatencyMs = latencies.length > 0 ? latencies[0] : null;
    const maxLatencyMs = latencies.length > 0 ? latencies[latencies.length - 1] : null;
    
    const p95LatencyMs = this.calculatePercentile(latencies, 0.95);
    const p99LatencyMs = this.calculatePercentile(latencies, 0.99);

    // Count incidents for this day
    const incidentsCount = await this.prisma.incident.count({
      where: {
        monitorId,
        startedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Calculate total downtime minutes
    const incidents = await this.prisma.incident.findMany({
      where: {
        monitorId,
        startedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        startedAt: true,
        resolvedAt: true,
      },
    });

    let totalDowntimeMinutes = 0;
    for (const incident of incidents) {
      const start = incident.startedAt;
      const end = incident.resolvedAt || endOfDay;
      const diffMs = end.getTime() - start.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      totalDowntimeMinutes += diffMinutes;
    }

    // Upsert the daily summary
    await this.prisma.monitorDailySummary.upsert({
      where: {
        monitorId_date: {
          monitorId,
          date: startOfDay,
        },
      },
      update: {
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
        updatedAt: new Date(),
      },
      create: {
        monitorId,
        date: startOfDay,
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
      },
    });

    this.logger.debug(
      { monitorId, date: startOfDay.toISOString().split('T')[0], totalChecks },
      'Daily summary created/updated'
    );
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number | null {
    if (sortedArray.length === 0) return null;
    
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    const clampedIndex = Math.max(0, Math.min(index, sortedArray.length - 1));
    
    return sortedArray[clampedIndex];
  }

  async deleteChecksForDate(date: Date): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.prisma.checkResult.deleteMany({
      where: {
        checkedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    this.logger.info(
      { date: date.toISOString().split('T')[0], deletedCount: result.count },
      'Deleted raw checks after aggregation'
    );

    return result.count;
  }
}