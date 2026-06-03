import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { WeeklyAggregationService } from './weekly-aggregation.service';
import type { EnvironmentVariables } from '../../config/env.schema';

@Injectable()
export class WeeklyAggregationJob implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly logger: PinoLogger,
    private readonly weeklyAggregationService: WeeklyAggregationService,
  ) {
    this.logger.setContext(WeeklyAggregationJob.name);
  }

  async onApplicationBootstrap(): Promise<void> {
    const isEnabled = this.configService.get('ENABLE_WEEKLY_AGGREGATION', { infer: true }) ?? true;

    if (!isEnabled) {
      this.logger.info('Weekly aggregation job is disabled');
      return;
    }

    // Schedule to run every Monday at 00:10 UTC (after daily aggregation completes)
    const hour = this.configService.get('WEEKLY_AGGREGATION_HOUR', { infer: true }) ?? 0;
    const minute = this.configService.get('WEEKLY_AGGREGATION_MINUTE', { infer: true }) ?? 10;

    const now = new Date();
    const nextRun = this.getNextMondayAt(now, hour, minute);
    const delayMs = nextRun.getTime() - now.getTime();

    this.logger.info(
      {
        nextRun: nextRun.toISOString(),
        delayMs,
        delayHours: Math.round(delayMs / (1000 * 60 * 60) * 100) / 100,
      },
      'Weekly aggregation job scheduled'
    );

    // Schedule first run
    this.timer = setTimeout(() => {
      void this.runAggregation('scheduled');
      // After first run, schedule weekly (every 7 days)
      this.timer = setInterval(() => {
        void this.runAggregation('scheduled');
      }, 7 * 24 * 60 * 60 * 1000);
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
      this.logger.warn({ trigger }, 'Weekly aggregation already running, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    // Get previous week info
    const weekInfo = await this.weeklyAggregationService.getPreviousWeekInfo();

    if (!weekInfo) {
      this.logger.warn('Could not determine previous week for aggregation');
      this.isRunning = false;
      return;
    }

    const { year, weekNumber } = weekInfo;

    this.logger.info(
      {
        trigger,
        year,
        weekNumber,
      },
      'Starting weekly aggregation'
    );

    try {
      // Step 1: Aggregate weekly data from daily summaries
      const result = await this.weeklyAggregationService.aggregateWeek(year, weekNumber);

      // Step 2: Delete daily summaries (only if aggregation succeeded)
      const deleteEnabled = this.configService.get('DELETE_DAILY_AFTER_WEEKLY_AGGREGATION', { infer: true }) ?? true;

      let deletedCount = 0;
      if (deleteEnabled && result.errors === 0 && result.processed > 0) {
        deletedCount = await this.weeklyAggregationService.deleteDailySummariesForWeek(year, weekNumber);
      }

      const durationMs = Date.now() - startTime;

      this.logger.info(
        {
          trigger,
          year,
          weekNumber,
          processed: result.processed,
          errors: result.errors,
          deletedCount,
          durationMs,
          durationSeconds: Math.round(durationMs / 1000),
        },
        'Weekly aggregation completed'
      );
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        {
          trigger,
          year,
          weekNumber,
          durationMs,
          error: message,
        },
        'Weekly aggregation failed'
      );
    } finally {
      this.isRunning = false;
    }
  }

  private getNextMondayAt(fromDate: Date, hour: number, minute: number): Date {
    const result = new Date(fromDate);
    result.setUTCHours(hour, minute, 0, 0);

    // If today is Monday and we haven't passed the target time, use today
    const dayOfWeek = result.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    if (dayOfWeek === 1 && result > fromDate) {
      // It's Monday and we haven't passed the target time
      return result;
    }

    // Calculate days until next Monday
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    result.setUTCDate(result.getUTCDate() + daysUntilMonday);

    return result;
  }
}
