import { MonitorType } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';
import { SchedulerService } from './scheduler.service';
import { SchedulerRepository } from './repositories/scheduler.repository';
import { BullQueueService } from '../../queue/bull-queue.service';
import { RedisService } from '../../queue/redis.service';
import {
  getMonitorCheckSchedulerId,
  getMonitorCheckSchedulerOffsetMs,
  getMonitorCheckQueueName,
  MONITOR_CHECK_JOB_NAME,
  MONITOR_CHECK_QUEUE_NAMES,
} from './scheduler.types';
import { HEARTBEAT_TIMEOUT_JOB_NAME } from '../../heartbeat/heartbeat.types';

describe('SchedulerService', () => {
  let schedulerService: SchedulerService;
  let schedulerRepository: jest.Mocked<SchedulerRepository>;
  let bullQueueService: jest.Mocked<BullQueueService>;
  let redisService: jest.Mocked<RedisService>;
  let logger: jest.Mocked<PinoLogger>;
  let monitorCheckQueues: Map<
    string,
    {
      getJobSchedulers: jest.Mock;
      upsertJobScheduler: jest.Mock;
      removeJobScheduler: jest.Mock;
    }
  >;
  let heartbeatTimeoutQueue: {
    getJob: jest.Mock;
    add: jest.Mock;
    getJobs: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-26T12:00:00.000Z'));

    schedulerRepository = {
      findActiveMonitorsForScheduling: jest.fn(),
    } as unknown as jest.Mocked<SchedulerRepository>;

    monitorCheckQueues = new Map(
      MONITOR_CHECK_QUEUE_NAMES.map((queueName) => [
        queueName,
        {
          getJobSchedulers: jest.fn().mockResolvedValue([]),
          upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
          removeJobScheduler: jest.fn().mockResolvedValue(true),
        },
      ]),
    );

    heartbeatTimeoutQueue = {
      getJob: jest.fn().mockResolvedValue(null),
      add: jest.fn().mockResolvedValue(undefined),
      getJobs: jest.fn().mockResolvedValue([]),
    };

    bullQueueService = {
      getQueue: jest.fn((name: string) => {
        if (monitorCheckQueues.has(name)) {
          return monitorCheckQueues.get(name);
        }

        return heartbeatTimeoutQueue;
      }),
    } as unknown as jest.Mocked<BullQueueService>;

    redisService = {
      getClient: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    const configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'SCHEDULER_POLL_INTERVAL_MS') {
          return 30000;
        }

        if (key === 'SCHEDULER_LOCK_TTL_MS') {
          return 60000;
        }

        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as ConfigService;

    schedulerService = new SchedulerService(
      configService as ConfigService,
      logger,
      schedulerRepository,
      bullQueueService,
      redisService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reconciles monitor schedulers and heartbeat timeout jobs', async () => {
    const staleHeartbeatRemove = jest.fn().mockResolvedValue(undefined);

    schedulerRepository.findActiveMonitorsForScheduling.mockResolvedValue([
      {
        id: 'monitor-http',
        type: MonitorType.HTTP,
        isActive: true,
        intervalSeconds: 60,
        timeoutMs: 5000,
        lastCheckedAt: null,
        createdAt: new Date('2026-05-26T10:00:00.000Z'),
        updatedAt: new Date('2026-05-26T10:00:00.000Z'),
      },
      {
        id: 'monitor-heartbeat',
        type: MonitorType.HEARTBEAT,
        isActive: true,
        intervalSeconds: 300,
        timeoutMs: 10000,
        lastCheckedAt: null,
        createdAt: new Date('2026-05-26T11:00:00.000Z'),
        updatedAt: new Date('2026-05-26T11:00:00.000Z'),
      },
    ]);
    monitorCheckQueues
      .get('monitor-checks-http')
      ?.getJobSchedulers.mockResolvedValue([
      {
        id: getMonitorCheckSchedulerId('deleted-monitor'),
      },
    ]);
    heartbeatTimeoutQueue.getJobs.mockResolvedValue([
      {
        id: 'heartbeat-timeout:deleted-monitor',
        remove: staleHeartbeatRemove,
      },
    ]);

    await schedulerService.synchronizeMonitors();

    expect(
      monitorCheckQueues.get(getMonitorCheckQueueName(MonitorType.HTTP))
        ?.upsertJobScheduler,
    ).toHaveBeenCalledWith(
      getMonitorCheckSchedulerId('monitor-http'),
      {
        every: 60000,
        offset: getMonitorCheckSchedulerOffsetMs('monitor-http', 60),
      },
      {
        name: MONITOR_CHECK_JOB_NAME,
        data: {
          monitorId: 'monitor-http',
        },
        opts: expect.objectContaining({
          attempts: 3,
        }),
      },
    );
    expect(
      monitorCheckQueues.get('monitor-checks-http')?.removeJobScheduler,
    ).toHaveBeenCalledWith(
      getMonitorCheckSchedulerId('deleted-monitor'),
    );
    expect(heartbeatTimeoutQueue.add).toHaveBeenCalledWith(
      HEARTBEAT_TIMEOUT_JOB_NAME,
      {
        monitorId: 'monitor-heartbeat',
        expectedBy: '2026-05-26T11:05:10.000Z',
      },
      expect.objectContaining({
        jobId: 'heartbeat-timeout:monitor-heartbeat',
        delay: 0,
      }),
    );
    expect(staleHeartbeatRemove).toHaveBeenCalledTimes(1);
  });

  it('computes a stable scheduler offset to spread checks across the interval', () => {
    expect(getMonitorCheckSchedulerOffsetMs('monitor-http', 60)).toBe(13557);
    expect(getMonitorCheckSchedulerOffsetMs('monitor-http', 60)).toBe(
      getMonitorCheckSchedulerOffsetMs('monitor-http', 60),
    );
    expect(getMonitorCheckSchedulerOffsetMs('monitor-http', 60)).toBeGreaterThanOrEqual(
      0,
    );
    expect(getMonitorCheckSchedulerOffsetMs('monitor-http', 60)).toBeLessThan(
      60000,
    );
  });

  it('keeps the existing heartbeat timeout job when it already matches the expected deadline', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);

    schedulerRepository.findActiveMonitorsForScheduling.mockResolvedValue([
      {
        id: 'monitor-heartbeat',
        type: MonitorType.HEARTBEAT,
        isActive: true,
        intervalSeconds: 300,
        timeoutMs: 10000,
        lastCheckedAt: new Date('2026-05-26T12:00:00.000Z'),
        createdAt: new Date('2026-05-26T11:00:00.000Z'),
        updatedAt: new Date('2026-05-26T11:00:00.000Z'),
      },
    ]);
    heartbeatTimeoutQueue.getJob.mockResolvedValue({
      data: {
        monitorId: 'monitor-heartbeat',
        expectedBy: '2026-05-26T12:05:10.000Z',
      },
      remove,
    });

    await schedulerService.synchronizeMonitors();

    expect(remove).not.toHaveBeenCalled();
    expect(heartbeatTimeoutQueue.add).not.toHaveBeenCalled();
  });
});
