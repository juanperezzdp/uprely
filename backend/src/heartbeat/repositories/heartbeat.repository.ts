import { Injectable } from '@nestjs/common';
import { MonitorType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HeartbeatRepository {
  constructor(private readonly prismaService: PrismaService) {}

  findActiveMonitorByToken(token: string): Promise<{
    id: string;
    name: string;
    type: MonitorType;
    isActive: boolean;
    intervalSeconds: number;
    timeoutMs: number;
    lastCheckedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    return this.prismaService.monitor.findFirst({
      where: {
        heartbeatToken: token,
        type: MonitorType.HEARTBEAT,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
        intervalSeconds: true,
        timeoutMs: true,
        lastCheckedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  findHeartbeatMonitorById(monitorId: string): Promise<{
    id: string;
    name: string;
    type: MonitorType;
    isActive: boolean;
    intervalSeconds: number;
    timeoutMs: number;
    lastCheckedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    return this.prismaService.monitor.findFirst({
      where: {
        id: monitorId,
        type: MonitorType.HEARTBEAT,
      },
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
        intervalSeconds: true,
        timeoutMs: true,
        lastCheckedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async recordPing(monitorId: string, receivedAt: Date): Promise<void> {
    await this.prismaService.$transaction([
      this.prismaService.heartbeatLog.create({
        data: {
          monitor: {
            connect: {
              id: monitorId,
            },
          },
          receivedAt,
        },
      }),
      this.prismaService.checkResult.create({
        data: {
          monitor: {
            connect: {
              id: monitorId,
            },
          },
          checkedAt: receivedAt,
          isUp: true,
          error: null,
          latencyMs: null,
          statusCode: null,
          keywordFound: null,
        },
      }),
      this.prismaService.monitor.update({
        where: {
          id: monitorId,
        },
        data: {
          lastCheckedAt: receivedAt,
        },
      }),
    ]);
  }

  async recordTimeoutFailure(
    monitorId: string,
    checkedAt: Date,
    error: string,
  ): Promise<void> {
    await this.prismaService.$transaction([
      this.prismaService.checkResult.create({
        data: {
          monitor: {
            connect: {
              id: monitorId,
            },
          },
          checkedAt,
          isUp: false,
          error,
          latencyMs: null,
          statusCode: null,
          keywordFound: null,
        },
      }),
      this.prismaService.monitor.update({
        where: {
          id: monitorId,
        },
        data: {
          lastCheckedAt: checkedAt,
        },
      }),
    ]);
  }
}
