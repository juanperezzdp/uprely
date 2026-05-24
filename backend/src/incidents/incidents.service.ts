import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Incident } from '@prisma/client';
import { AlertsService } from '../alerts/alerts.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { PaginatedResponse } from '../monitors/monitors.service';
import { MonitorsRepository } from '../monitors/repositories/monitors.repository';
import { SseService } from '../sse/sse.service';
import {
  IncidentStatusFilter,
  type ListIncidentsQueryDto,
} from './dto/list-incidents-query.dto';
import { IncidentsRepository } from './repositories/incidents.repository';

export interface IncidentDetailResponse {
  id: string;
  monitorId: string;
  startedAt: string;
  confirmedAt: string | null;
  resolvedAt: string | null;
  cause: string;
  createdAt: string;
  status: IncidentStatusFilter.OPEN | IncidentStatusFilter.RESOLVED;
}

@Injectable()
export class IncidentsService {
  constructor(
    private readonly incidentsRepository: IncidentsRepository,
    private readonly monitorsRepository: MonitorsRepository,
    private readonly alertsService: AlertsService,
    private readonly sseService: SseService,
  ) {}

  async listIncidents(
    user: AuthenticatedUser,
    query: ListIncidentsQueryDto,
  ): Promise<PaginatedResponse<IncidentDetailResponse>> {
    const page = query.page;
    const limit = query.limit;
    const where = this.buildWhereClause(user.id, query);
    const [items, total] = await Promise.all([
      this.incidentsRepository.findManyForUser({
        where,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.incidentsRepository.countForUser(where),
    ]);

    return {
      items: items.map((incident) => this.toIncidentDetailResponse(incident)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getIncidentById(
    user: AuthenticatedUser,
    incidentId: string,
  ): Promise<IncidentDetailResponse> {
    const incident = await this.incidentsRepository.findByIdForUser(user.id, incidentId);

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    return this.toIncidentDetailResponse(incident);
  }

  async openIncidentForMonitor(params: {
    monitorId: string;
    cause: string;
    startedAt?: Date;
    confirmedAt?: Date | null;
  }): Promise<Incident> {
    const monitor = await this.monitorsRepository.findById(params.monitorId);

    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }

    const existingOpenIncident = await this.incidentsRepository.findOpenByMonitorId(
      params.monitorId,
    );

    if (existingOpenIncident) {
      return existingOpenIncident;
    }

    const startedAt = params.startedAt ?? new Date();

    const incident = await this.incidentsRepository.create({
      cause: params.cause,
      startedAt,
      confirmedAt: params.confirmedAt ?? startedAt,
      monitor: {
        connect: {
          id: params.monitorId,
        },
      },
    });

    await this.alertsService.enqueueMonitorDownAlert({
      incidentId: incident.id,
      monitorId: incident.monitorId,
      cause: incident.cause,
      startedAt: incident.startedAt,
    });
    this.sseService.publishMonitorStatusChange({
      userId: monitor.userId,
      monitorId: monitor.id,
      monitorName: monitor.name,
      monitorType: monitor.type,
      status: 'DOWN',
      incidentId: incident.id,
      cause: incident.cause,
      changedAt: incident.startedAt.toISOString(),
    });

    return incident;
  }

  async resolveOpenIncidentForMonitor(params: {
    monitorId: string;
    resolvedAt?: Date;
  }): Promise<Incident | null> {
    const existingOpenIncident = await this.incidentsRepository.findOpenByMonitorId(
      params.monitorId,
    );

    if (!existingOpenIncident) {
      return null;
    }

    const resolvedIncident = await this.incidentsRepository.update(existingOpenIncident.id, {
      resolvedAt: params.resolvedAt ?? new Date(),
    });
    const monitor = await this.monitorsRepository.findById(resolvedIncident.monitorId);

    await this.alertsService.enqueueMonitorRecoveredAlert({
      incidentId: resolvedIncident.id,
      monitorId: resolvedIncident.monitorId,
      cause: resolvedIncident.cause,
      startedAt: resolvedIncident.startedAt,
      resolvedAt: resolvedIncident.resolvedAt ?? new Date(),
    });
    if (monitor) {
      this.sseService.publishMonitorStatusChange({
        userId: monitor.userId,
        monitorId: monitor.id,
        monitorName: monitor.name,
        monitorType: monitor.type,
        status: 'UP',
        incidentId: resolvedIncident.id,
        cause: resolvedIncident.cause,
        changedAt: (resolvedIncident.resolvedAt ?? new Date()).toISOString(),
      });
    }

    return resolvedIncident;
  }

  private buildWhereClause(
    userId: string,
    query: ListIncidentsQueryDto,
  ) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException('startDate must be earlier than or equal to endDate');
    }

    return {
      monitor: {
        userId,
      },
      ...(query.monitorId
        ? {
            monitorId: query.monitorId,
          }
        : {}),
      ...(query.status === IncidentStatusFilter.OPEN
        ? {
            resolvedAt: null,
          }
        : {}),
      ...(query.status === IncidentStatusFilter.RESOLVED
        ? {
            NOT: {
              resolvedAt: null,
            },
          }
        : {}),
      ...(startDate || endDate
        ? {
            startedAt: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    };
  }

  private toIncidentDetailResponse(incident: Incident): IncidentDetailResponse {
    return {
      id: incident.id,
      monitorId: incident.monitorId,
      startedAt: incident.startedAt.toISOString(),
      confirmedAt: incident.confirmedAt?.toISOString() ?? null,
      resolvedAt: incident.resolvedAt?.toISOString() ?? null,
      cause: incident.cause,
      createdAt: incident.createdAt.toISOString(),
      status: incident.resolvedAt
        ? IncidentStatusFilter.RESOLVED
        : IncidentStatusFilter.OPEN,
    };
  }
}
