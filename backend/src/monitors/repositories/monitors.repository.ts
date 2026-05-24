import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type CheckResult,
  type Incident,
  type Monitor,
  type Plan,
  type MonitorType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MonitorsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  countByUserId(userId: string): Promise<number> {
    return this.prismaService.monitor.count({
      where: {
        userId,
      },
    });
  }

  findManyByUserId(params: {
    userId: string;
    skip: number;
    take: number;
    type?: MonitorType;
    isActive?: boolean;
  }): Promise<Monitor[]> {
    return this.prismaService.monitor.findMany({
      where: {
        userId: params.userId,
        type: params.type,
        isActive: params.isActive,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: params.skip,
      take: params.take,
    });
  }

  countVisibleByUserId(params: {
    userId: string;
    type?: MonitorType;
    isActive?: boolean;
  }): Promise<number> {
    return this.prismaService.monitor.count({
      where: {
        userId: params.userId,
        type: params.type,
        isActive: params.isActive,
      },
    });
  }

  findOwnedById(userId: string, monitorId: string): Promise<Monitor | null> {
    return this.prismaService.monitor.findFirst({
      where: {
        id: monitorId,
        userId,
      },
    });
  }

  findById(monitorId: string): Promise<Monitor | null> {
    return this.prismaService.monitor.findUnique({
      where: {
        id: monitorId,
      },
    });
  }

  findManyOwnedByIds(userId: string, monitorIds: string[]): Promise<Monitor[]> {
    if (monitorIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.prismaService.monitor.findMany({
      where: {
        userId,
        id: {
          in: monitorIds,
        },
      },
    });
  }

  findByIdWithOwner(monitorId: string): Promise<{
    id: string;
    userId: string;
    name: string;
    url: string | null;
    type: MonitorType;
    user: {
      id: string;
      plan: Plan;
    };
  } | null> {
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
        user: {
          select: {
            id: true,
            plan: true,
          },
        },
      },
    });
  }

  create(data: Prisma.MonitorCreateInput): Promise<Monitor> {
    return this.prismaService.monitor.create({
      data,
    });
  }

  update(monitorId: string, data: Prisma.MonitorUpdateInput): Promise<Monitor> {
    return this.prismaService.monitor.update({
      where: {
        id: monitorId,
      },
      data,
    });
  }

  delete(monitorId: string): Promise<Monitor> {
    return this.prismaService.monitor.delete({
      where: {
        id: monitorId,
      },
    });
  }

  countCheckResults(userId: string, monitorId: string): Promise<number> {
    return this.prismaService.checkResult.count({
      where: {
        monitorId,
        monitor: {
          userId,
        },
      },
    });
  }

  findCheckResults(params: {
    userId: string;
    monitorId: string;
    skip: number;
    take: number;
  }): Promise<CheckResult[]> {
    return this.prismaService.checkResult.findMany({
      where: {
        monitorId: params.monitorId,
        monitor: {
          userId: params.userId,
        },
      },
      orderBy: {
        checkedAt: 'desc',
      },
      skip: params.skip,
      take: params.take,
    });
  }

  countIncidents(userId: string, monitorId: string): Promise<number> {
    return this.prismaService.incident.count({
      where: {
        monitorId,
        monitor: {
          userId,
        },
      },
    });
  }

  findIncidents(params: {
    userId: string;
    monitorId: string;
    skip: number;
    take: number;
  }): Promise<Incident[]> {
    return this.prismaService.incident.findMany({
      where: {
        monitorId: params.monitorId,
        monitor: {
          userId: params.userId,
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      skip: params.skip,
      take: params.take,
    });
  }

  aggregateCheckStats(userId: string, monitorId: string): Promise<{
    totalChecks: number;
    upChecks: number;
    downChecks: number;
    avgLatencyMs: number | null;
    latestCheck: CheckResult | null;
    totalIncidents: number;
  }> {
    return Promise.all([
      this.prismaService.checkResult.count({
        where: {
          monitorId,
          monitor: {
            userId,
          },
        },
      }),
      this.prismaService.checkResult.count({
        where: {
          monitorId,
          isUp: true,
          monitor: {
            userId,
          },
        },
      }),
      this.prismaService.checkResult.count({
        where: {
          monitorId,
          isUp: false,
          monitor: {
            userId,
          },
        },
      }),
      this.prismaService.checkResult.aggregate({
        where: {
          monitorId,
          monitor: {
            userId,
          },
        },
        _avg: {
          latencyMs: true,
        },
      }),
      this.prismaService.checkResult.findFirst({
        where: {
          monitorId,
          monitor: {
            userId,
          },
        },
        orderBy: {
          checkedAt: 'desc',
        },
      }),
      this.prismaService.incident.count({
        where: {
          monitorId,
          monitor: {
            userId,
          },
        },
      }),
    ]).then(
      ([totalChecks, upChecks, downChecks, latencyAggregate, latestCheck, totalIncidents]) => ({
        totalChecks,
        upChecks,
        downChecks,
        avgLatencyMs: latencyAggregate._avg.latencyMs ?? null,
        latestCheck,
        totalIncidents,
      }),
    );
  }
}
