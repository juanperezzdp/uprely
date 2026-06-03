import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, QueueEvents, type Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import type { EnvironmentVariables } from '../../config/env.schema';
import { type AlertJobPayload } from '../../alerts/alerts.types';
import { HeartbeatService } from '../../heartbeat/heartbeat.service';
import type { HeartbeatTimeoutJobPayload } from '../../heartbeat/heartbeat.types';
import { RedisService } from '../../queue/redis.service';
import {
  MONITOR_CHECK_QUEUE_NAMES,
  type MonitorCheckQueueName,
  type MonitorCheckJobPayload,
} from '../scheduler/scheduler.types';
import { AlertsProcessorService } from './alerts-processor.service';
import { MonitorCheckProcessorService } from './monitor-check-processor.service';
import {
  resolveWorkerQueueConcurrency,
  type MonitorCheckProcessingResult,
  type WorkerQueueConcurrencyMap,
  type WorkerRuntimeQueueName,
} from './worker.types';

@Injectable()
export class WorkerRuntimeService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly monitorCheckWorkers = new Map<
    MonitorCheckQueueName,
    Worker<MonitorCheckJobPayload, MonitorCheckProcessingResult>
  >();
  private alertsWorker: Worker<AlertJobPayload> | null = null;
  private heartbeatTimeoutWorker: Worker<
    HeartbeatTimeoutJobPayload,
    {
      expired: boolean;
      monitorId: string;
      incidentId: string | null;
    }
  > | null = null;
  private readonly monitorCheckQueueEvents = new Map<
    MonitorCheckQueueName,
    QueueEvents
  >();
  private alertsQueueEvents: QueueEvents | null = null;
  private heartbeatTimeoutQueueEvents: QueueEvents | null = null;
  private readonly queueConcurrency: WorkerQueueConcurrencyMap;
  private readonly isDevelopment: boolean;

  constructor(
    configService: ConfigService<EnvironmentVariables, true>,
    private readonly logger: PinoLogger,
    private readonly redisService: RedisService,
    private readonly monitorCheckProcessorService: MonitorCheckProcessorService,
    private readonly alertsProcessorService: AlertsProcessorService,
    private readonly heartbeatService: HeartbeatService,
  ) {
    this.logger.setContext(WorkerRuntimeService.name);
    this.isDevelopment =
      configService.getOrThrow('NODE_ENV', {
        infer: true,
      }) === 'development';
    this.queueConcurrency = resolveWorkerQueueConcurrency({
      WORKER_CONCURRENCY: configService.getOrThrow('WORKER_CONCURRENCY', {
        infer: true,
      }),
      WORKER_CONCURRENCY_HTTP: configService.get('WORKER_CONCURRENCY_HTTP', {
        infer: true,
      }),
      WORKER_CONCURRENCY_TCP: configService.get('WORKER_CONCURRENCY_TCP', {
        infer: true,
      }),
      WORKER_CONCURRENCY_SSL: configService.get('WORKER_CONCURRENCY_SSL', {
        infer: true,
      }),
      WORKER_CONCURRENCY_KEYWORD: configService.get('WORKER_CONCURRENCY_KEYWORD', {
        infer: true,
      }),
      WORKER_CONCURRENCY_ALERTS: configService.get('WORKER_CONCURRENCY_ALERTS', {
        infer: true,
      }),
      WORKER_CONCURRENCY_HEARTBEAT_TIMEOUT: configService.get(
        'WORKER_CONCURRENCY_HEARTBEAT_TIMEOUT',
        {
          infer: true,
        },
      ),
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    const connection = this.redisService.getBullConnection();

    for (const queueName of MONITOR_CHECK_QUEUE_NAMES) {
      this.monitorCheckWorkers.set(
        queueName,
        new Worker(
          queueName,
          async (job: Job<MonitorCheckJobPayload>) =>
            this.monitorCheckProcessorService.process(job.data),
          {
            connection,
            concurrency: this.queueConcurrency[queueName],
          },
        ),
      );
      this.monitorCheckQueueEvents.set(
        queueName,
        new QueueEvents(queueName, {
          connection,
        }),
      );
    }
    this.alertsWorker = new Worker(
      'alerts',
      async (job: Job<AlertJobPayload>) =>
        this.alertsProcessorService.dispatch(job.data),
      {
        connection,
        concurrency: this.queueConcurrency.alerts,
      },
    );
    this.heartbeatTimeoutWorker = new Worker(
      'heartbeat-timeout',
      async (job: Job<HeartbeatTimeoutJobPayload>) =>
        this.heartbeatService.processTimeoutJob(job.data),
      {
        connection,
        concurrency: this.queueConcurrency['heartbeat-timeout'],
      },
    );

    this.alertsQueueEvents = new QueueEvents('alerts', {
      connection,
    });
    this.heartbeatTimeoutQueueEvents = new QueueEvents('heartbeat-timeout', {
      connection,
    });

    for (const [queueName, worker] of this.monitorCheckWorkers.entries()) {
      this.attachWorkerLogging(worker, queueName);
    }
    this.attachWorkerLogging(this.alertsWorker, 'alerts');
    this.attachWorkerLogging(this.heartbeatTimeoutWorker, 'heartbeat-timeout');

    await Promise.all([
      ...[...this.monitorCheckWorkers.values()].map(async (worker) =>
        worker.waitUntilReady(),
      ),
      this.alertsWorker.waitUntilReady(),
      this.heartbeatTimeoutWorker.waitUntilReady(),
      ...[...this.monitorCheckQueueEvents.values()].map(async (queueEvents) =>
        queueEvents.waitUntilReady(),
      ),
      this.alertsQueueEvents.waitUntilReady(),
      this.heartbeatTimeoutQueueEvents.waitUntilReady(),
    ]);

    this.logger.info(
      {
        queueConcurrency: this.queueConcurrency,
        queues: [...MONITOR_CHECK_QUEUE_NAMES, 'heartbeat-timeout', 'alerts'],
      },
      'Worker runtime ready',
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      ...[...this.monitorCheckQueueEvents.values()].map(async (queueEvents) =>
        queueEvents.close(),
      ),
      this.alertsQueueEvents?.close(),
      this.heartbeatTimeoutQueueEvents?.close(),
      ...[...this.monitorCheckWorkers.values()].map(async (worker) =>
        worker.close(),
      ),
      this.alertsWorker?.close(),
      this.heartbeatTimeoutWorker?.close(),
    ]);
  }

  private attachWorkerLogging<TData, TResult>(
    worker: Worker<TData, TResult>,
    queue: WorkerRuntimeQueueName,
  ): void {
    worker.on('completed', (job, result) => {
      const logPayload = {
        queue,
        concurrency: this.queueConcurrency[queue],
        jobId: job.id,
        name: job.name,
        result,
      };

      if (this.isDevelopment) {
        this.logger.debug(logPayload, 'Worker job completed');
        return;
      }

      this.logger.info(logPayload, 'Worker job completed');
    });
    worker.on('failed', (job, error) => {
      this.logger.error(
        {
          queue,
          concurrency: this.queueConcurrency[queue],
          jobId: job?.id ?? null,
          name: job?.name ?? null,
          errorMessage: error.message,
        },
        'Worker job failed',
      );
    });
    worker.on('error', (error) => {
      this.logger.error(
        {
          queue,
          concurrency: this.queueConcurrency[queue],
          errorMessage: error.message,
        },
        'Worker runtime error',
      );
    });
  }
}
