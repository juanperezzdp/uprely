import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { SchedulerMonitorTarget } from '../scheduler.types';

@Injectable()
export class SchedulerRepository {
  constructor(private readonly prismaService: PrismaService) {}

  findActiveMonitorsForScheduling(): Promise<SchedulerMonitorTarget[]> {
    return this.prismaService.monitor.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        type: true,
        isActive: true,
        intervalSeconds: true,
        timeoutMs: true,
        lastCheckedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}
