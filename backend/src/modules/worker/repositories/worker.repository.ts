import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  MonitorCheckExecutionResult,
  MonitorExecutionTarget,
} from '../worker.types';

@Injectable()
export class WorkerRepository {
  constructor(private readonly prismaService: PrismaService) {}

  findMonitorForExecution(monitorId: string): Promise<MonitorExecutionTarget | null> {
    return this.prismaService.monitor.findUnique({
      where: {
        id: monitorId,
      },
      select: {
        id: true,
        userId: true,
        name: true,
        url: true,
        type: true,
        intervalSeconds: true,
        timeoutMs: true,
        isActive: true,
        keywordExpected: true,
        keywordMustExist: true,
        consecutiveFailuresThreshold: true,
        lastCheckedAt: true,
      },
    });
  }

  async recordCheckResult(
    monitorId: string,
    result: MonitorCheckExecutionResult,
  ): Promise<void> {
    await this.prismaService.$transaction([
      this.prismaService.checkResult.create({
        data: {
          monitor: {
            connect: {
              id: monitorId,
            },
          },
          checkedAt: result.checkedAt,
          statusCode: result.statusCode,
          latencyMs: result.latencyMs,
          isUp: result.isUp,
          error: result.error,
          keywordFound: result.keywordFound,
        },
      }),
      this.prismaService.monitor.update({
        where: {
          id: monitorId,
        },
        data: {
          lastCheckedAt: result.checkedAt,
        },
      }),
    ]);
  }

  findCheckResultIdsOlderThan(params: {
    cutoff: Date;
    take: number;
  }): Promise<Array<{ id: string }>> {
    return this.prismaService.checkResult.findMany({
      where: {
        checkedAt: {
          lt: params.cutoff,
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        checkedAt: 'asc',
      },
      take: params.take,
    });
  }

  deleteCheckResultsByIds(ids: string[]): Promise<{ count: number }> {
    if (ids.length === 0) {
      return Promise.resolve({
        count: 0,
      });
    }

    return this.prismaService.checkResult.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }
}
