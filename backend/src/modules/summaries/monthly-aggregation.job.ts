import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { MonthlyAggregationService } from './monthly-aggregation.service';
import type { EnvironmentVariables } from '../../config/env.schema';

@Injectable()
export class MonthlyAggregationJob implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly isDevelopment: boolean;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly logger: PinoLogger,
    private readonly monthlyAggregationService: MonthlyAggregationService,
  ) {
    this.logger.setContext(MonthlyAggregationJob.name);
    this.isDevelopment =
      this.configService.get('NODE_ENV', { infer: true }) === 'development';
  }

  private logInfo(data: Record<string, unknown> | undefined, message: string): void {
    if (this.isDevelopment) {
      this.logger.debug(data, message);
      return;
    }

    this.logger.info(data, message);
  }

  async onApplicationBootstrap(): Promise<void> {
    const isEnabled = this.configService.get('ENABLE_MONTHLY_AGGREGATION', { infer: true }) ?? true;

    if (!isEnabled) {
      this.logInfo(undefined, 'Monthly aggregation job is disabled');
      return;
    }

    // Schedule to run on the 1st of each month at 00:15 UTC
    const hour = this.configService.get('MONTHLY_AGGREGATION_HOUR', { infer: true }) ?? 0;
    const minute = this.configService.get('MONTHLY_AGGREGATION_MINUTE', { infer: true }) ?? 15;

    const now = new Date();
    const nextRun = this.getNextFirstOfMonthAt(now, hour, minute);
    const delayMs = nextRun.getTime() - now.getTime();

    this.logInfo(
      {
        nextRun: nextRun.toISOString(),
        delayMs,
        delayHours: Math.round(delayMs / (1000 * 60 * 60) * 100) / 100,
      },
      'Monthly aggregation job scheduled'
    );

    // Schedule first run
    this.timer = setTimeout(() => {
      void this.runAggregation('scheduled');
      // After first run, schedule monthly
      this.timer = setInterval(() => {
        void this.runAggregation('scheduled');
      }, this.getDaysInMonth(nextRun) * 24 * 60 * 60 * 1000);
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
      this.logger.warn({ trigger }, 'Monthly aggregation already running, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    // Get previous month info
    const monthInfo = await this.monthlyAggregationService.getPreviousMonthInfo();

    if (!monthInfo) {
      this.logger.warn('Could not determine previous month for aggregation');
      this.isRunning = false;
      return;
    }

    const { year, month } = monthInfo;

    this.logInfo(
      {
        trigger,
        year,
        month,
      },
      'Starting monthly aggregation'
    );

    try {
      // Step 1: Aggregate monthly data from weekly summaries
      const result = await this.monthlyAggregationService.aggregateMonth(year, month);

      // Step 2: Delete weekly summaries (only if aggregation succeeded)
      const deleteEnabled = this.configService.get('DELETE_WEEKLY_AFTER_MONTHLY_AGGREGATION', { infer: true }) ?? true;

      let deletedCount = 0;
      if (deleteEnabled && result.errors === 0 && result.processed > 0) {
        deletedCount = await this.monthlyAggregationService.deleteWeeklySummariesForMonth(year, month);
      }

      const durationMs = Date.now() - startTime;

      this.logInfo(
        {
          trigger,
          year,
          month,
          processed: result.processed,
          errors: result.errors,
          deletedCount,
          durationMs,
          durationSeconds: Math.round(durationMs / 1000),
        },
        'Monthly aggregation completed'
      );
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        {
          trigger,
          year,
          month,
          durationMs,
          error: message,
        },
        'Monthly aggregation failed'
      );
    } finally {
      this.isRunning = false;
    }
  }

  private getNextFirstOfMonthAt(fromDate: Date, hour: number, minute: number): Date {
    const result = new Date(fromDate);
    result.setDate(1);
    result.setHours(hour, minute, 0, 0);

    if (result <= fromDate) {
      // Move to next month
      result.setMonth(result.getMonth() + 1);
    }

    return result;
  }

  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }
}
