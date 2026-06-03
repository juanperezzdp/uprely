import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

@Injectable()
export class SummariesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDailySummary(monitorId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    return this.prisma.monitorDailySummary.findUnique({
      where: {
        monitorId_date: {
          monitorId,
          date: startOfDay,
        },
      },
    });
  }

  async findDailySummariesForRange(
    monitorId: string,
    startDate: Date,
    endDate: Date
  ) {
    return this.prisma.monitorDailySummary.findMany({
      where: {
        monitorId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });
  }

  async upsertDailySummary(
    monitorId: string,
    date: Date,
    data: Prisma.MonitorDailySummaryUncheckedCreateInput
  ) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    return this.prisma.monitorDailySummary.upsert({
      where: {
        monitorId_date: {
          monitorId,
          date: startOfDay,
        },
      },
      update: {
        ...data,
        updatedAt: new Date(),
      },
      create: {
        ...data,
        monitorId,
        date: startOfDay,
      },
    });
  }

  async deleteOldSummaries(cutoffDate: Date): Promise<number> {
    const result = await this.prisma.monitorDailySummary.deleteMany({
      where: {
        date: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  async getSummaryStats(monitorId: string, days: number) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const summaries = await this.prisma.monitorDailySummary.findMany({
      where: {
        monitorId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    if (summaries.length === 0) {
      return null;
    }

    const totalChecks = summaries.reduce((sum, s) => sum + s.totalChecks, 0);
    const upChecks = summaries.reduce((sum, s) => sum + s.upChecks, 0);
    const uptimePercentage = totalChecks > 0 ? (upChecks / totalChecks) * 100 : 0;

    const avgLatencies = summaries
      .map(s => s.avgLatencyMs)
      .filter((l): l is number => l !== null);
    const avgLatency = avgLatencies.length > 0
      ? avgLatencies.reduce((a, b) => a + b, 0) / avgLatencies.length
      : null;

    return {
      totalChecks,
      upChecks,
      downChecks: totalChecks - upChecks,
      uptimePercentage,
      avgLatencyMs: avgLatency,
      daysWithData: summaries.length,
    };
  }
}
