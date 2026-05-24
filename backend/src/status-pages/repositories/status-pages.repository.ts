import { Injectable } from '@nestjs/common';
import { Prisma, type StatusPage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const statusPageWithMonitorStatus = Prisma.validator<Prisma.StatusPageInclude>()({
  pageMonitors: {
    orderBy: {
      createdAt: 'asc',
    },
    include: {
      monitor: {
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
            },
          },
        },
      },
    },
  },
});

export type StatusPageWithMonitorStatus = Prisma.StatusPageGetPayload<{
  include: typeof statusPageWithMonitorStatus;
}>;

@Injectable()
export class StatusPagesRepository {
  constructor(private readonly prismaService: PrismaService) {}

  countByUserId(userId: string): Promise<number> {
    return this.prismaService.statusPage.count({
      where: {
        userId,
      },
    });
  }

  findManyByUserId(params: {
    userId: string;
    skip: number;
    take: number;
  }): Promise<StatusPageWithMonitorStatus[]> {
    return this.prismaService.statusPage.findMany({
      where: {
        userId: params.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: params.skip,
      take: params.take,
      include: statusPageWithMonitorStatus,
    });
  }

  findOwnedById(
    userId: string,
    statusPageId: string,
  ): Promise<StatusPageWithMonitorStatus | null> {
    return this.prismaService.statusPage.findFirst({
      where: {
        id: statusPageId,
        userId,
      },
      include: statusPageWithMonitorStatus,
    });
  }

  findBySlug(slug: string): Promise<StatusPage | null> {
    return this.prismaService.statusPage.findUnique({
      where: {
        slug,
      },
    });
  }

  findPublicBySlug(slug: string): Promise<StatusPageWithMonitorStatus | null> {
    return this.prismaService.statusPage.findFirst({
      where: {
        slug,
        isPublic: true,
      },
      include: statusPageWithMonitorStatus,
    });
  }

  create(data: Prisma.StatusPageCreateInput): Promise<StatusPage> {
    return this.prismaService.statusPage.create({
      data,
    });
  }

  update(
    statusPageId: string,
    data: Prisma.StatusPageUpdateInput,
  ): Promise<StatusPage> {
    return this.prismaService.statusPage.update({
      where: {
        id: statusPageId,
      },
      data,
    });
  }

  delete(statusPageId: string): Promise<StatusPage> {
    return this.prismaService.statusPage.delete({
      where: {
        id: statusPageId,
      },
    });
  }
}
