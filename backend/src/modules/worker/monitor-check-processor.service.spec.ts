import { MonitorType, type Incident } from '@prisma/client';
import { IncidentsService } from '../../incidents/incidents.service';
import { RedisService } from '../../queue/redis.service';
import { MonitorCheckExecutorService } from './monitor-check-executor.service';
import { MonitorCheckProcessorService } from './monitor-check-processor.service';
import { WorkerRepository } from './repositories/worker.repository';

describe('MonitorCheckProcessorService', () => {
  let service: MonitorCheckProcessorService;
  let workerRepository: jest.Mocked<WorkerRepository>;
  let executorService: jest.Mocked<MonitorCheckExecutorService>;
  let incidentsService: jest.Mocked<IncidentsService>;
  let redisService: jest.Mocked<RedisService>;
  let redisClient: {
    del: jest.Mock;
    incr: jest.Mock;
    pexpire: jest.Mock;
    set: jest.Mock;
    get: jest.Mock;
  };

  beforeEach(() => {
    workerRepository = {
      findMonitorForExecution: jest.fn(),
      recordCheckResult: jest.fn(),
    } as unknown as jest.Mocked<WorkerRepository>;

    executorService = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<MonitorCheckExecutorService>;

    incidentsService = {
      openIncidentForMonitor: jest.fn(),
      resolveOpenIncidentForMonitor: jest.fn(),
    } as unknown as jest.Mocked<IncidentsService>;

    redisClient = {
      del: jest.fn().mockResolvedValue(2),
      incr: jest.fn(),
      pexpire: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
    };

    redisService = {
      getClient: jest.fn().mockReturnValue(redisClient),
    } as unknown as jest.Mocked<RedisService>;

    service = new MonitorCheckProcessorService(
      workerRepository,
      executorService,
      incidentsService,
      redisService,
    );
  });

  it('keeps a failed check unconfirmed until the threshold is reached', async () => {
    workerRepository.findMonitorForExecution.mockResolvedValue({
      id: 'monitor-1',
      userId: 'user-1',
      name: 'API',
      url: 'https://api.example.com/health',
      type: MonitorType.HTTP,
      intervalSeconds: 60,
      timeoutMs: 5000,
      isActive: true,
      keywordExpected: null,
      keywordMustExist: null,
      consecutiveFailuresThreshold: 2,
      lastCheckedAt: null,
    });
    executorService.execute.mockResolvedValue({
      checkedAt: new Date('2026-05-26T12:00:00.000Z'),
      isUp: false,
      statusCode: 500,
      latencyMs: 220,
      error: 'HTTP status 500',
      keywordFound: null,
    });
    redisClient.incr.mockResolvedValue(1);

    const result = await service.process({
      monitorId: 'monitor-1',
    });

    expect(workerRepository.recordCheckResult).toHaveBeenCalled();
    expect(redisClient.set).toHaveBeenCalledWith(
      'worker:monitor:monitor-1:first-failure-at',
      '2026-05-26T12:00:00.000Z',
      'PX',
      86400000,
    );
    expect(incidentsService.openIncidentForMonitor).not.toHaveBeenCalled();
    expect(result).toEqual({
      processed: true,
      outcome: 'UNCONFIRMED_DOWN',
      monitorId: 'monitor-1',
      monitorType: MonitorType.HTTP,
      checkedAt: '2026-05-26T12:00:00.000Z',
      isUp: false,
      consecutiveFailures: 1,
      incidentId: null,
      error: 'HTTP status 500',
    });
  });

  it('opens an incident when the consecutive failure threshold is reached', async () => {
    workerRepository.findMonitorForExecution.mockResolvedValue({
      id: 'monitor-1',
      userId: 'user-1',
      name: 'API',
      url: 'https://api.example.com/health',
      type: MonitorType.HTTP,
      intervalSeconds: 60,
      timeoutMs: 5000,
      isActive: true,
      keywordExpected: null,
      keywordMustExist: null,
      consecutiveFailuresThreshold: 2,
      lastCheckedAt: null,
    });
    executorService.execute.mockResolvedValue({
      checkedAt: new Date('2026-05-26T12:01:00.000Z'),
      isUp: false,
      statusCode: 500,
      latencyMs: 200,
      error: 'HTTP status 500',
      keywordFound: null,
    });
    redisClient.incr.mockResolvedValue(2);
    redisClient.get.mockResolvedValue('2026-05-26T12:00:00.000Z');
    incidentsService.openIncidentForMonitor.mockResolvedValue({
      id: 'incident-1',
      monitorId: 'monitor-1',
      startedAt: new Date('2026-05-26T12:00:00.000Z'),
      confirmedAt: new Date('2026-05-26T12:01:00.000Z'),
      resolvedAt: null,
      cause: 'HTTP status 500',
      createdAt: new Date('2026-05-26T12:01:00.000Z'),
    } as Incident);

    const result = await service.process({
      monitorId: 'monitor-1',
    });

    expect(incidentsService.openIncidentForMonitor).toHaveBeenCalledWith({
      monitorId: 'monitor-1',
      cause: 'HTTP status 500',
      startedAt: new Date('2026-05-26T12:00:00.000Z'),
      confirmedAt: new Date('2026-05-26T12:01:00.000Z'),
    });
    expect(result.outcome).toBe('DOWN');
    expect(result.incidentId).toBe('incident-1');
    expect(result.consecutiveFailures).toBe(2);
  });

  it('resolves an open incident and clears redis counters after a successful check', async () => {
    workerRepository.findMonitorForExecution.mockResolvedValue({
      id: 'monitor-1',
      userId: 'user-1',
      name: 'API',
      url: 'https://api.example.com/health',
      type: MonitorType.HTTP,
      intervalSeconds: 60,
      timeoutMs: 5000,
      isActive: true,
      keywordExpected: null,
      keywordMustExist: null,
      consecutiveFailuresThreshold: 2,
      lastCheckedAt: null,
    });
    executorService.execute.mockResolvedValue({
      checkedAt: new Date('2026-05-26T12:05:00.000Z'),
      isUp: true,
      statusCode: 200,
      latencyMs: 150,
      error: null,
      keywordFound: null,
    });
    incidentsService.resolveOpenIncidentForMonitor.mockResolvedValue({
      id: 'incident-1',
      monitorId: 'monitor-1',
      startedAt: new Date('2026-05-26T12:00:00.000Z'),
      confirmedAt: new Date('2026-05-26T12:01:00.000Z'),
      resolvedAt: new Date('2026-05-26T12:05:00.000Z'),
      cause: 'HTTP status 500',
      createdAt: new Date('2026-05-26T12:01:00.000Z'),
    } as Incident);

    const result = await service.process({
      monitorId: 'monitor-1',
    });

    expect(redisClient.del).toHaveBeenCalledWith(
      'worker:monitor:monitor-1:failure-count',
      'worker:monitor:monitor-1:first-failure-at',
    );
    expect(incidentsService.resolveOpenIncidentForMonitor).toHaveBeenCalledWith({
      monitorId: 'monitor-1',
      resolvedAt: new Date('2026-05-26T12:05:00.000Z'),
    });
    expect(result).toEqual({
      processed: true,
      outcome: 'RECOVERED',
      monitorId: 'monitor-1',
      monitorType: MonitorType.HTTP,
      checkedAt: '2026-05-26T12:05:00.000Z',
      isUp: true,
      consecutiveFailures: 0,
      incidentId: 'incident-1',
      error: null,
    });
  });
});
