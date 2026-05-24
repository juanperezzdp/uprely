import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  type MonitorStatusSnapshotItem,
  type RealtimeMonitorStatus,
} from '../sse.types';

@Injectable()
export class SseRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findMonitorStatusSnapshotByUserId(
    userId: string,
  ): Promise<MonitorStatusSnapshotItem[]> {
    const monitors = await this.prismaService.monitor.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
        lastCheckedAt: true,
        checkResults: {
          orderBy: {
            checkedAt: 'desc',
          },
          take: 1,
          select: {
            checkedAt: true,
            isUp: true,
            error: true,
          },
        },
        incidents: {
          where: {
            resolvedAt: null,
          },
          orderBy: {
            startedAt: 'desc',
          },
          take: 1,
          select: {
            id: true,
            cause: true,
            startedAt: true,
          },
        },
      },
    });

    return monitors.map((monitor) => {
      const latestCheck = monitor.checkResults[0] ?? null;
      const openIncident = monitor.incidents[0] ?? null;
      const status: RealtimeMonitorStatus = openIncident
        ? 'DOWN'
        : latestCheck
          ? latestCheck.isUp
            ? 'UP'
            : 'DOWN'
          : 'UNKNOWN';
      const changedAt = openIncident?.startedAt ?? latestCheck?.checkedAt ?? null;

      return {
        monitorId: monitor.id,
        monitorName: monitor.name,
        monitorType: monitor.type,
        isActive: monitor.isActive,
        status,
        incidentId: openIncident?.id ?? null,
        cause: openIncident?.cause ?? latestCheck?.error ?? null,
        changedAt: changedAt?.toISOString() ?? null,
        lastCheckedAt: monitor.lastCheckedAt?.toISOString() ?? null,
      };
    });
  }
}
