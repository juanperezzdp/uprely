import process from 'node:process';
import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import type { EnvironmentVariables } from '../../config/env.schema';
import { BullQueueService } from '../../queue/bull-queue.service';
import { MONITOR_CHECK_QUEUE_NAMES } from '../scheduler/scheduler.types';
import { WorkerHttpClientService } from './worker-http-client.service';

@Injectable()
export class WorkerMetricsService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;

  constructor(
    configService: ConfigService<EnvironmentVariables, true>,
    private readonly logger: PinoLogger,
    private readonly bullQueueService: BullQueueService,
    private readonly workerHttpClientService: WorkerHttpClientService,
  ) {
    this.logger.setContext(WorkerMetricsService.name);
    this.intervalMs = configService.getOrThrow('WORKER_METRICS_INTERVAL_MS', {
      infer: true,
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.logSnapshot('startup');

    this.timer = setInterval(() => {
      void this.logSnapshot('interval');
    }, this.intervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async collectMetrics(): Promise<{
    queueMetrics: Record<string, Record<string, number>>;
    httpClientMetrics: Record<
      string,
      {
        connected: number;
        pending: number;
        running: number;
        size: number;
        free?: number;
        queued?: number;
      }
    >;
    processMetrics: {
      rssBytes: number;
      heapUsedBytes: number;
      heapTotalBytes: number;
      externalBytes: number;
      uptimeSeconds: number;
    };
  }> {
    const monitorCheckEntries = await Promise.all(
      MONITOR_CHECK_QUEUE_NAMES.map(async (queueName) =>
        [
          queueName,
          await this.bullQueueService
            .getQueue(queueName)
            .getJobCounts('wait', 'active', 'delayed', 'completed', 'failed', 'paused'),
        ] as const,
      ),
    );
    const [heartbeatTimeoutCounts, alertsCounts] = await Promise.all([
      this.bullQueueService
        .getQueue('heartbeat-timeout')
        .getJobCounts('wait', 'active', 'delayed', 'completed', 'failed', 'paused'),
      this.bullQueueService
        .getQueue('alerts')
        .getJobCounts('wait', 'active', 'delayed', 'completed', 'failed', 'paused'),
    ]);
    const memoryUsage = process.memoryUsage();
    const monitorCheckQueueMetrics: Record<string, Record<string, number>> =
      Object.fromEntries(monitorCheckEntries);
    const aggregateMonitorChecks = Object.values(monitorCheckQueueMetrics).reduce<
      Record<string, number>
    >(
      (accumulator, counts) => {
        for (const [key, value] of Object.entries(counts)) {
          accumulator[key] = (accumulator[key] ?? 0) + value;
        }

        return accumulator;
      },
      {},
    );

    return {
      queueMetrics: {
        monitorChecks: aggregateMonitorChecks,
        ...monitorCheckQueueMetrics,
        heartbeatTimeout: heartbeatTimeoutCounts,
        alerts: alertsCounts,
      },
      httpClientMetrics: this.workerHttpClientService.getStatsSummary(),
      processMetrics: {
        rssBytes: memoryUsage.rss,
        heapUsedBytes: memoryUsage.heapUsed,
        heapTotalBytes: memoryUsage.heapTotal,
        externalBytes: memoryUsage.external,
        uptimeSeconds: Math.floor(process.uptime()),
      },
    };
  }

  private async logSnapshot(trigger: 'startup' | 'interval'): Promise<void> {
    const snapshot = await this.collectMetrics();

    this.logger.info(
      {
        trigger,
        ...snapshot,
      },
      'Worker metrics snapshot',
    );
  }
}
