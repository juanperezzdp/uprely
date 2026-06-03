import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { DailyAggregationService } from './daily-aggregation.service';
import type { EnvironmentVariables } from '../../config/env.schema';

@Injectable()
export class DailyAggregationJob implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly logger: PinoLogger,
    private readonly aggregationService: DailyAggregationService,
  ) {
    this.logger.setContext(DailyAggregationJob.name);
  }

  async onApplicationBootstrap(): Promise<void> {
    const isEnabled = this.configService.get('ENABLE_DAILY_AGGREGATION', { infer: true }) ?? true;
    
    if (!isEnabled) {
      this.logger.info('Daily aggregation job is disabled');
      return;
    }

    // Calculate time until next 00:05 UTC
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setUTCHours(0, 5, 0, 0);
    
    if (nextRun <= now) {
      // If it's already past 00:05 today, schedule for tomorrow
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }

    const delayMs = nextRun.getTime() - now.getTime();

    this.logger.info(
      { 
        nextRun: nextRun.toISOString(),
        delayMs,
        delayHours: Math.round(delayMs / (1000 * 60 * 60) * 100) / 100,
      },
      'Daily aggregation job scheduled'
    );

    // Schedule first run
    this.timer = setTimeout(() => {
      void this.runAggregation('scheduled');
      // After first run, schedule daily
      this.timer = setInterval(() => {
        void this.runAggregation('scheduled');
      }, 24 * 60 * 60 * 1000); // Every 24 hours
    }, delayMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runAggregation(trigger: 'scheduled' | 'manual'): Promise<void> {
    if (this.isRunning) {
      this.logger.warn({ trigger }, 'Aggregation already running, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    // Calculate yesterday's date
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    this.logger.info(
      { 
        trigger, 
        date: yesterday.toISOString().split('T')[0],
      },
      'Starting daily aggregation'
    );

    try {
      // Step 1: Aggregate data
      const result = await this.aggregationService.aggregateDate(yesterday);
      
      // Step 2: Delete raw checks (only if aggregation succeeded)
      const deleteEnabled = this.configService.get('DELETE_AFTER_AGGREGATION', { infer: true }) ?? true;
      
      let deletedCount = 0;
      if (deleteEnabled && result.errors === 0 && result.processed > 0) {
        deletedCount = await this.aggregationService.deleteChecksForDate(yesterday);
      }

      const durationMs = Date.now() - startTime;

      this.logger.info(
        {
          trigger,
          date: yesterday.toISOString().split('T')[0],
          processed: result.processed,
          errors: result.errors,
          deletedCount,
          durationMs,
          durationSeconds: Math.round(durationMs / 1000),
        },
        'Daily aggregation completed'
      );
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        {
          trigger,
          date: yesterday.toISOString().split('T')[0],
          durationMs,
          error: message,
        },
        'Daily aggregation failed'
      );
    } finally {
      this.isRunning = false;
    }
  }
}
