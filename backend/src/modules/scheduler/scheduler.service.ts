import { randomUUID } from 'node:crypto';
import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MonitorType } from '@prisma/client';
import type { Job, Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import type { EnvironmentVariables } from '../../config/env.schema';
import {
  buildHeartbeatTimeoutPayload,
  getHeartbeatTimeoutJobId,
  HEARTBEAT_TIMEOUT_JOB_NAME,
  type HeartbeatTimeoutJobPayload,
} from '../../heartbeat/heartbeat.types';
import { BullQueueService } from '../../queue/bull-queue.service';
import { RedisService } from '../../queue/redis.service';
import { SchedulerRepository } from './repositories/scheduler.repository';
import {
  getMonitorCheckSchedulerId,
  getMonitorCheckSchedulerOffsetMs,
  getMonitorCheckQueueName,
  MONITOR_CHECK_QUEUE_NAMES,
  MONITOR_CHECK_JOB_NAME,
  SCHEDULER_SYNC_LOCK_KEY,
  type MonitorCheckQueueName,
  type MonitorCheckJobPayload,
  type SchedulerMonitorTarget,
} from './scheduler.types';

type MonitorCheckScheduler = Awaited<
  ReturnType<Queue<MonitorCheckJobPayload>['getJobSchedulers']>
>[number];

@Injectable()
export class SchedulerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private pollTimer: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs: number;
  private readonly lockTtlMs: number;

  constructor(
    configService: ConfigService<EnvironmentVariables, true>,
    private readonly logger: PinoLogger,
    private readonly schedulerRepository: SchedulerRepository,
    private readonly bullQueueService: BullQueueService,
    private readonly redisService: RedisService,
  ) {
    this.logger.setContext(SchedulerService.name);
    this.pollIntervalMs = configService.getOrThrow('SCHEDULER_POLL_INTERVAL_MS', {
      infer: true,
    });
    this.lockTtlMs = configService.getOrThrow('SCHEDULER_LOCK_TTL_MS', {
      infer: true,
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.syncWithDistributedLock('bootstrap');

    this.pollTimer = setInterval(() => {
      void this.syncWithDistributedLock('poll');
    }, this.pollIntervalMs);

    this.logger.info(
      {
        pollIntervalMs: this.pollIntervalMs,
        lockTtlMs: this.lockTtlMs,
      },
      'Scheduler polling started',
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async synchronizeMonitors(): Promise<void> {
    const monitors = await this.schedulerRepository.findActiveMonitorsForScheduling();
    const monitorCheckQueues = new Map<
      MonitorCheckQueueName,
      Queue<MonitorCheckJobPayload>
    >(
      MONITOR_CHECK_QUEUE_NAMES.map((queueName) => [
        queueName,
        this.bullQueueService.getQueue<MonitorCheckJobPayload>(queueName),
      ]),
    );
    const heartbeatTimeoutQueue =
      this.bullQueueService.getQueue<HeartbeatTimeoutJobPayload>('heartbeat-timeout');
    const existingSchedulersByQueue = new Map<
      MonitorCheckQueueName,
      MonitorCheckScheduler[]
    >(
      await Promise.all(
        [...monitorCheckQueues.entries()].map(async ([queueName, queue]) =>
          [
            queueName,
            await queue.getJobSchedulers(0, -1, true),
          ] as const,
        ),
      ),
    );
    const activeHeartbeatIds = new Set<string>();

    for (const monitor of monitors) {
      if (monitor.type === MonitorType.HEARTBEAT) {
        activeHeartbeatIds.add(monitor.id);
        await this.syncHeartbeatTimeoutJob(heartbeatTimeoutQueue, monitor);
        continue;
      }

      const queue = monitorCheckQueues.get(getMonitorCheckQueueName(monitor.type));

      if (!queue) {
        throw new Error(`Monitor check queue for type ${monitor.type} is not available`);
      }

      await this.syncMonitorCheckScheduler(queue, monitor);
    }

    await this.removeStaleMonitorCheckSchedulers(
      monitorCheckQueues,
      monitors,
      existingSchedulersByQueue,
    );
    await this.removeStaleHeartbeatTimeoutJobs(heartbeatTimeoutQueue, activeHeartbeatIds);

    this.logger.info(
      {
        activeMonitorCount: monitors.length,
        monitorCheckCount: monitors.filter((monitor) => monitor.type !== MonitorType.HEARTBEAT)
          .length,
        heartbeatMonitorCount: activeHeartbeatIds.size,
        schedulerStrategy: 'stable-offset-jitter',
        checkQueues: MONITOR_CHECK_QUEUE_NAMES,
      },
      'Scheduler reconciliation completed',
    );
  }

  private async syncWithDistributedLock(
    trigger: 'bootstrap' | 'poll',
  ): Promise<void> {
    const redis = await this.redisService.getConnectedClient();
    const token = randomUUID();
    const lockResult = await redis.set(
      SCHEDULER_SYNC_LOCK_KEY,
      token,
      'PX',
      this.lockTtlMs,
      'NX',
    );

    if (lockResult !== 'OK') {
      this.logger.debug({ trigger }, 'Scheduler sync skipped because another instance owns the lock');
      return;
    }

    try {
      await this.synchronizeMonitors();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown scheduler synchronization error';

      this.logger.error(
        {
          trigger,
          errorMessage: message,
        },
        'Scheduler synchronization failed',
      );

      throw error;
    } finally {
      await redis.eval(
        `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          end
          return 0
        `,
        1,
        SCHEDULER_SYNC_LOCK_KEY,
        token,
      );
    }
  }

  private async syncMonitorCheckScheduler(
    queue: Queue<MonitorCheckJobPayload>,
    monitor: SchedulerMonitorTarget,
  ): Promise<void> {
    await queue.upsertJobScheduler(
      getMonitorCheckSchedulerId(monitor.id),
      {
        every: monitor.intervalSeconds * 1000,
        offset: getMonitorCheckSchedulerOffsetMs(
          monitor.id,
          monitor.intervalSeconds,
        ),
      },
      {
        name: MONITOR_CHECK_JOB_NAME,
        data: {
          monitorId: monitor.id,
        },
        opts: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      },
    );
  }

  private async removeStaleMonitorCheckSchedulers(
    queues: Map<MonitorCheckQueueName, Queue<MonitorCheckJobPayload>>,
    monitors: SchedulerMonitorTarget[],
    existingSchedulersByQueue: Map<
      MonitorCheckQueueName,
      MonitorCheckScheduler[]
    >,
  ): Promise<void> {
    const desiredSchedulerIdsByQueue = new Map<
      MonitorCheckQueueName,
      Set<string>
    >(
      MONITOR_CHECK_QUEUE_NAMES.map((queueName) => [queueName, new Set<string>()]),
    );

    for (const monitor of monitors) {
      if (monitor.type === MonitorType.HEARTBEAT) {
        continue;
      }

      desiredSchedulerIdsByQueue
        .get(getMonitorCheckQueueName(monitor.type))
        ?.add(getMonitorCheckSchedulerId(monitor.id));
    }

    for (const queueName of MONITOR_CHECK_QUEUE_NAMES) {
      const queue = queues.get(queueName);
      const desiredSchedulerIds = desiredSchedulerIdsByQueue.get(queueName);
      const existingSchedulers = existingSchedulersByQueue.get(queueName) ?? [];

      if (!queue || !desiredSchedulerIds) {
        continue;
      }

      for (const scheduler of existingSchedulers) {
        const schedulerId = scheduler.id;

        if (!schedulerId?.startsWith('monitor-check:')) {
          continue;
        }

        if (desiredSchedulerIds.has(schedulerId)) {
          continue;
        }

        await queue.removeJobScheduler(schedulerId);
      }
    }
  }

  private async syncHeartbeatTimeoutJob(
    queue: Queue<HeartbeatTimeoutJobPayload>,
    monitor: SchedulerMonitorTarget,
  ): Promise<void> {
    const payload = buildHeartbeatTimeoutPayload({
      monitorId: monitor.id,
      intervalSeconds: monitor.intervalSeconds,
      timeoutMs: monitor.timeoutMs,
      referenceTime: monitor.lastCheckedAt ?? monitor.updatedAt ?? monitor.createdAt,
    });
    const jobId = getHeartbeatTimeoutJobId(monitor.id);
    const existingJob = await queue.getJob(jobId);

    if (existingJob) {
      const existingPayload = existingJob.data;

      if (
        isHeartbeatTimeoutPayload(existingPayload) &&
        existingPayload.expectedBy === payload.expectedBy
      ) {
        return;
      }

      await existingJob.remove();
    }

    const delay = Math.max(new Date(payload.expectedBy).getTime() - Date.now(), 0);

    await queue.add(HEARTBEAT_TIMEOUT_JOB_NAME, payload, {
      jobId,
      delay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }

  private async removeStaleHeartbeatTimeoutJobs(
    queue: Queue<HeartbeatTimeoutJobPayload>,
    activeHeartbeatIds: Set<string>,
  ): Promise<void> {
    const jobs = await queue.getJobs(['delayed', 'waiting', 'paused'], 0, -1, true);

    for (const job of jobs) {
      const jobId = typeof job.id === 'string' ? job.id : null;

      if (!jobId?.startsWith('heartbeat-timeout:')) {
        continue;
      }

      const monitorId = jobId.slice('heartbeat-timeout:'.length);

      if (activeHeartbeatIds.has(monitorId)) {
        continue;
      }

      await job.remove();
    }
  }
}

function isHeartbeatTimeoutPayload(
  value: unknown,
): value is HeartbeatTimeoutJobPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.monitorId === 'string' &&
    typeof payload.expectedBy === 'string'
  );
}
