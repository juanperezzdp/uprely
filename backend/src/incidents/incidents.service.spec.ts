import { BadRequestException, NotFoundException } from '@nestjs/common';
import { type Incident, MonitorType, Plan, type Monitor } from '@prisma/client';
import { AlertsService } from '../alerts/alerts.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { MonitorsRepository } from '../monitors/repositories/monitors.repository';
import { SseService } from '../sse/sse.service';
import { IncidentStatusFilter } from './dto/list-incidents-query.dto';
import { IncidentsRepository } from './repositories/incidents.repository';
import { IncidentsService } from './incidents.service';

describe('IncidentsService', () => {
  let incidentsService: IncidentsService;
  let incidentsRepository: jest.Mocked<IncidentsRepository>;
  let monitorsRepository: jest.Mocked<MonitorsRepository>;
  let alertsService: jest.Mocked<AlertsService>;
  let sseService: jest.Mocked<SseService>;

  const currentUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'john@uptimewatch.dev',
    plan: Plan.FREE,
    dodoCustomerId: null,
  };

  const baseMonitor: Monitor = {
    id: '7f9d9c77-31d4-4b74-b0d2-d60b4bcbe3d0',
    userId: 'user-1',
    name: 'API Principal',
    url: 'https://api.uptimewatch.dev/health',
    type: MonitorType.HTTP,
    intervalSeconds: 300,
    timeoutMs: 10000,
    isActive: true,
    keywordExpected: null,
    keywordMustExist: null,
    consecutiveFailuresThreshold: 2,
    heartbeatToken: null,
    lastCheckedAt: null,
    createdAt: new Date('2026-05-23T00:00:00.000Z'),
    updatedAt: new Date('2026-05-23T00:00:00.000Z'),
  };

  const baseIncident: Incident = {
    id: '59cc4808-3ddd-41f8-a90d-8861ddb661ff',
    monitorId: baseMonitor.id,
    startedAt: new Date('2026-05-23T12:00:00.000Z'),
    confirmedAt: new Date('2026-05-23T12:01:00.000Z'),
    resolvedAt: null,
    cause: 'HTTP 500',
    createdAt: new Date('2026-05-23T12:00:00.000Z'),
  };

  beforeEach(() => {
    incidentsRepository = {
      findByIdForUser: jest.fn(),
      countForUser: jest.fn(),
      findManyForUser: jest.fn(),
      findOpenByMonitorId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<IncidentsRepository>;

    monitorsRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<MonitorsRepository>;

    alertsService = {
      enqueueMonitorDownAlert: jest.fn().mockResolvedValue(1),
      enqueueMonitorRecoveredAlert: jest.fn().mockResolvedValue(1),
    } as unknown as jest.Mocked<AlertsService>;

    sseService = {
      streamMonitorEvents: jest.fn(),
      publishMonitorStatusChange: jest.fn(),
    } as unknown as jest.Mocked<SseService>;

    incidentsService = new IncidentsService(
      incidentsRepository,
      monitorsRepository,
      alertsService,
      sseService,
    );
  });

  it('lists incidents filtered by status with pagination', async () => {
    incidentsRepository.countForUser.mockResolvedValue(1);
    incidentsRepository.findManyForUser.mockResolvedValue([baseIncident]);

    const result = await incidentsService.listIncidents(currentUser, {
      page: 1,
      limit: 10,
      status: IncidentStatusFilter.OPEN,
    });

    expect(result.items[0]?.status).toBe(IncidentStatusFilter.OPEN);
    expect(result.meta.total).toBe(1);
  });

  it('rejects invalid date ranges in incident filters', async () => {
    await expect(
      incidentsService.listIncidents(currentUser, {
        page: 1,
        limit: 10,
        startDate: '2026-05-31T00:00:00.000Z',
        endDate: '2026-05-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns an incident by id', async () => {
    incidentsRepository.findByIdForUser.mockResolvedValue(baseIncident);

    const result = await incidentsService.getIncidentById(
      currentUser,
      baseIncident.id,
    );

    expect(result.id).toBe(baseIncident.id);
    expect(result.status).toBe(IncidentStatusFilter.OPEN);
  });

  it('opens an incident only once per monitor while it remains unresolved', async () => {
    monitorsRepository.findById.mockResolvedValue(baseMonitor);
    incidentsRepository.findOpenByMonitorId.mockResolvedValue(baseIncident);

    const result = await incidentsService.openIncidentForMonitor({
      monitorId: baseMonitor.id,
      cause: 'HTTP 500',
    });

    expect(result.id).toBe(baseIncident.id);
    expect(incidentsRepository.create).not.toHaveBeenCalled();
  });

  it('creates an incident when a monitor has no open incident', async () => {
    monitorsRepository.findById.mockResolvedValue(baseMonitor);
    incidentsRepository.findOpenByMonitorId.mockResolvedValue(null);
    incidentsRepository.create.mockResolvedValue(baseIncident);

    const result = await incidentsService.openIncidentForMonitor({
      monitorId: baseMonitor.id,
      cause: 'HTTP 500',
    });

    expect(result.id).toBe(baseIncident.id);
    expect(incidentsRepository.create).toHaveBeenCalled();
    expect(alertsService.enqueueMonitorDownAlert).toHaveBeenCalled();
    expect(sseService.publishMonitorStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: baseMonitor.userId,
        monitorId: baseMonitor.id,
        status: 'DOWN',
      }),
    );
  });

  it('resolves an open incident when the monitor recovers', async () => {
    incidentsRepository.findOpenByMonitorId.mockResolvedValue(baseIncident);
    monitorsRepository.findById.mockResolvedValue(baseMonitor);
    incidentsRepository.update.mockResolvedValue({
      ...baseIncident,
      resolvedAt: new Date('2026-05-23T12:10:00.000Z'),
    });

    const result = await incidentsService.resolveOpenIncidentForMonitor({
      monitorId: baseMonitor.id,
    });

    expect(result?.resolvedAt).not.toBeNull();
    expect(alertsService.enqueueMonitorRecoveredAlert).toHaveBeenCalled();
    expect(sseService.publishMonitorStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: baseMonitor.userId,
        monitorId: baseMonitor.id,
        status: 'UP',
      }),
    );
  });

  it('fails opening incidents for unknown monitors', async () => {
    monitorsRepository.findById.mockResolvedValue(null);

    await expect(
      incidentsService.openIncidentForMonitor({
        monitorId: baseMonitor.id,
        cause: 'HTTP 500',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
