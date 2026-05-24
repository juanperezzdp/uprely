import { Injectable } from '@nestjs/common';
import { Prisma, type Incident } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IncidentsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  findByIdForUser(userId: string, incidentId: string): Promise<Incident | null> {
    return this.prismaService.incident.findFirst({
      where: {
        id: incidentId,
        monitor: {
          userId,
        },
      },
    });
  }

  countForUser(where: Prisma.IncidentWhereInput): Promise<number> {
    return this.prismaService.incident.count({
      where,
    });
  }

  findManyForUser(params: {
    where: Prisma.IncidentWhereInput;
    skip: number;
    take: number;
  }): Promise<Incident[]> {
    return this.prismaService.incident.findMany({
      where: params.where,
      orderBy: {
        startedAt: 'desc',
      },
      skip: params.skip,
      take: params.take,
    });
  }

  findOpenByMonitorId(monitorId: string): Promise<Incident | null> {
    return this.prismaService.incident.findFirst({
      where: {
        monitorId,
        resolvedAt: null,
      },
      orderBy: {
        startedAt: 'desc',
      },
    });
  }

  create(data: Prisma.IncidentCreateInput): Promise<Incident> {
    return this.prismaService.incident.create({
      data,
    });
  }

  update(incidentId: string, data: Prisma.IncidentUpdateInput): Promise<Incident> {
    return this.prismaService.incident.update({
      where: {
        id: incidentId,
      },
      data,
    });
  }
}
