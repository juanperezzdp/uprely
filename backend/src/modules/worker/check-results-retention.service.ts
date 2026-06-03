import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import type { EnvironmentVariables } from '../../config/env.schema';
import { WorkerRepository } from './repositories/worker.repository';

const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class CheckResultsRetentionService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private timer: NodeJS.Timeout | null = null;
  private readonly retentionDays: number;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private isRunning = false;

  constructor(
    configService: ConfigService<EnvironmentVariables, true>,
    private readonly logger: PinoLogger,
    private readonly workerRepository: WorkerRepository,
  ) {
    this.logger.setContext(CheckResultsRetentionService.name);
    this.retentionDays = configService.getOrThrow('CHECK_RESULTS_RETENTION_DAYS', {
      infer: true,
    });
    this.intervalMs = configService.getOrThrow('CHECK_RESULTS_CLEANUP_INTERVAL_MS', {
      infer: true,
    });
    this.batchSize = configService.getOrThrow('CHECK_RESULTS_CLEANUP_BATCH_SIZE', {
      infer: true,
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.runCleanup('startup');

    this.timer = setInterval(() => {
      void this.runCleanup('interval');
    }, this.intervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async cleanupExpiredResults(): Promise<{
    deletedCount: number;
    batches: number;
    cutoff: string;
  }> {
    const cutoff = new Date(Date.now() - this.retentionDays * MILLISECONDS_IN_DAY);
    let deletedCount = 0;
    let batches = 0;

    while (true) {
      const rows = await this.workerRepository.findCheckResultIdsOlderThan({
        cutoff,
        take: this.batchSize,
      });

      if (rows.length === 0) {
        break;
      }

      const result = await this.workerRepository.deleteCheckResultsByIds(
        rows.map((row) => row.id),
      );

      deletedCount += result.count;
      batches += 1;

      if (rows.length < this.batchSize) {
        break;
      }
    }

    return {
      deletedCount,
      batches,
      cutoff: cutoff.toISOString(),
    };
  }

  private async runCleanup(trigger: 'startup' | 'interval'): Promise<void> {
    if (this.isRunning) {
      this.logger.warn({ trigger }, 'Check results cleanup skipped because a previous run is still active');
      return;
    }

    this.isRunning = true;

    try {
      const result = await this.cleanupExpiredResults();

      this.logger.info(
        {
          trigger,
          retentionDays: this.retentionDays,
          batchSize: this.batchSize,
          ...result,
        },
        'Check results retention cleanup completed',
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown check results cleanup error';

      this.logger.error(
        {
          trigger,
          retentionDays: this.retentionDays,
          batchSize: this.batchSize,
          errorMessage: message,
        },
        'Check results retention cleanup failed',
      );
    } finally {
      this.isRunning = false;
    }
  }
}
