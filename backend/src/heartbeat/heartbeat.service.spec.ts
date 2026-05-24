import { NotFoundException } from '@nestjs/common';
import { MonitorType, type Incident } from '@prisma/client';
import type { Queue } from 'bullmq';
import { IncidentsService } from '../incidents/incidents.service';
import { BullQueueService } from '../queue/bull-queue.service';
import { HeartbeatService } from './heartbeat.service';
import {
  HEARTBEAT_TIMEOUT_CAUSE,
  HEARTBEAT_TIMEOUT_JOB_NAME,
} from './heartbeat.types';
import { HeartbeatRepository } from './repositories/heartbeat.repository';

describe('HeartbeatService', () => {
  let heartbeatService: HeartbeatService;
  let heartbeatRepository: jest.Mocked<HeartbeatRepository>;
  let incidentsService: jest.Mocked<IncidentsService>;
  let bullQueueService: jest.Mocked<BullQueueService>;
  let queue: {
    getJob: jest.Mock;
    add: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-23T12:00:00.000Z'));

    heartbeatRepository = {
      findActiveMonitorByToken: jest.fn(),
      findHeartbeatMonitorById: jest.fn(),
      recordPing: jest.fn(),
      recordTimeoutFailure: jest.fn(),
    } as unknown as jest.Mocked<HeartbeatRepository>;

    incidentsService = {
      resolveOpenIncidentForMonitor: jest.fn(),
      openIncidentForMonitor: jest.fn(),
    } as unknown as jest.Mocked<IncidentsService>;

    queue = {
      getJob: jest.fn(),
      add: jest.fn(),
    };

    bullQueueService = {
      getQueue: jest.fn().mockReturnValue(queue as unknown as Queue),
      getQueueEvents: jest.fn(),
      onModuleDestroy: jest.fn(),
    } as unknown as jest.Mocked<BullQueueService>;

    heartbeatService = new HeartbeatService(
      heartbeatRepository,
      incidentsService,
      bullQueueService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('registers a heartbeat ping, re-arms the timeout and resolves open incidents', async () => {
    heartbeatRepository.findActiveMonitorByToken.mockResolvedValue({
      id: 'monitor-1',
      name: 'Cron worker',
      type: MonitorType.HEARTBEAT,
      isActive: true,
      intervalSeconds: 300,
      timeoutMs: 10000,
      lastCheckedAt: null,
      createdAt: new Date('2026-05-23T11:00:00.000Z'),
      updatedAt: new Date('2026-05-23T11:00:00.000Z'),
    });
    incidentsService.resolveOpenIncidentForMonitor.mockResolvedValue(null);
    queue.getJob.mockResolvedValue(null);

    const result = await heartbeatService.ping('heartbeat-token');

    expect(heartbeatRepository.recordPing).toHaveBeenCalledWith(
      'monitor-1',
      new Date('2026-05-23T12:00:00.000Z'),
    );
    expect(queue.add).toHaveBeenCalledWith(
      HEARTBEAT_TIMEOUT_JOB_NAME,
      {
        monitorId: 'monitor-1',
        expectedBy: '2026-05-23T12:05:10.000Z',
      },
      expect.objectContaining({
        jobId: 'heartbeat-timeout:monitor-1',
        delay: 310000,
      }),
    );
    expect(incidentsService.resolveOpenIncidentForMonitor).toHaveBeenCalledWith({
      monitorId: 'monitor-1',
      resolvedAt: new Date('2026-05-23T12:00:00.000Z'),
    });
    expect(result.nextTimeoutAt).toBe('2026-05-23T12:05:10.000Z');
  });

  it('throws when the heartbeat token does not belong to an active heartbeat monitor', async () => {
    heartbeatRepository.findActiveMonitorByToken.mockResolvedValue(null);

    await expect(heartbeatService.ping('missing-token')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('opens an incident when a heartbeat timeout expires without a newer ping', async () => {
    heartbeatRepository.findHeartbeatMonitorById.mockResolvedValue({
      id: 'monitor-1',
      name: 'Cron worker',
      type: MonitorType.HEARTBEAT,
      isActive: true,
      intervalSeconds: 300,
      timeoutMs: 10000,
      lastCheckedAt: new Date('2026-05-23T12:00:00.000Z'),
      createdAt: new Date('2026-05-23T11:00:00.000Z'),
      updatedAt: new Date('2026-05-23T11:00:00.000Z'),
    });
    incidentsService.openIncidentForMonitor.mockResolvedValue({
      id: 'incident-1',
      monitorId: 'monitor-1',
      startedAt: new Date('2026-05-23T12:05:10.000Z'),
      confirmedAt: new Date('2026-05-23T12:05:10.000Z'),
      resolvedAt: null,
      cause: HEARTBEAT_TIMEOUT_CAUSE,
      createdAt: new Date('2026-05-23T12:05:10.000Z'),
    } as Incident);

    const result = await heartbeatService.processTimeoutJob({
      monitorId: 'monitor-1',
      expectedBy: '2026-05-23T12:05:10.000Z',
    });

    expect(heartbeatRepository.recordTimeoutFailure).toHaveBeenCalledWith(
      'monitor-1',
      new Date('2026-05-23T12:05:10.000Z'),
      HEARTBEAT_TIMEOUT_CAUSE,
    );
    expect(incidentsService.openIncidentForMonitor).toHaveBeenCalledWith({
      monitorId: 'monitor-1',
      cause: HEARTBEAT_TIMEOUT_CAUSE,
      startedAt: new Date('2026-05-23T12:05:10.000Z'),
      confirmedAt: new Date('2026-05-23T12:05:10.000Z'),
    });
    expect(result).toEqual({
      expired: true,
      monitorId: 'monitor-1',
      incidentId: 'incident-1',
    });
  });

  it('ignores timeout jobs that are stale because a newer heartbeat already arrived', async () => {
    heartbeatRepository.findHeartbeatMonitorById.mockResolvedValue({
      id: 'monitor-1',
      name: 'Cron worker',
      type: MonitorType.HEARTBEAT,
      isActive: true,
      intervalSeconds: 300,
      timeoutMs: 10000,
      lastCheckedAt: new Date('2026-05-23T12:06:00.000Z'),
      createdAt: new Date('2026-05-23T11:00:00.000Z'),
      updatedAt: new Date('2026-05-23T11:00:00.000Z'),
    });

    const result = await heartbeatService.processTimeoutJob({
      monitorId: 'monitor-1',
      expectedBy: '2026-05-23T12:05:10.000Z',
    });

    expect(heartbeatRepository.recordTimeoutFailure).not.toHaveBeenCalled();
    expect(incidentsService.openIncidentForMonitor).not.toHaveBeenCalled();
    expect(result).toEqual({
      expired: false,
      monitorId: 'monitor-1',
      incidentId: null,
    });
  });
});
