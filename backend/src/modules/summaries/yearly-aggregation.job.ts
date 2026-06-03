import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { YearlyAggregationService } from './yearly-aggregation.service';
import type { EnvironmentVariables } from '../../config/env.schema';

@Injectable()
export class YearlyAggregationJob implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly isDevelopment: boolean;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly logger: PinoLogger,
    private readonly yearlyAggregationService: YearlyAggregationService,
  ) {
    this.logger.setContext(YearlyAggregationJob.name);
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
    const isEnabled = this.configService.get('ENABLE_YEARLY_AGGREGATION', { infer: true }) ?? true;

    if (!isEnabled) {
      this.logInfo(undefined, 'Yearly aggregation job is disabled');
      return;
    }

    // Schedule to run on January 1st at 00:20 UTC
    const hour = this.configService.get('YEARLY_AGGREGATION_HOUR', { infer: true }) ?? 0;
    const minute = this.configService.get('YEARLY_AGGREGATION_MINUTE', { infer: true }) ?? 20;

    const now = new Date();
    const nextRun = this.getNextJanuaryFirstAt(now, hour, minute);
    const delayMs = nextRun.getTime() - now.getTime();

    this.logInfo(
      {
        nextRun: nextRun.toISOString(),
        delayMs,
        delayHours: Math.round(delayMs / (1000 * 60 * 60) * 100) / 100,
      },
      'Yearly aggregation job scheduled'
    );

    // Schedule first run
    this.timer = setTimeout(() => {
      void this.runAggregation('scheduled');
      // After first run, schedule yearly
      this.timer = setInterval(() => {
        void this.runAggregation('scheduled');
      }, 365 * 24 * 60 * 60 * 1000); // Every year (approximate)
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
      this.logger.warn({ trigger }, 'Yearly aggregation already running, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    // Get previous year info
    const yearInfo = this.yearlyAggregationService.getPreviousYearInfo();
    const { year } = yearInfo;

    this.logInfo(
      {
        trigger,
        year,
      },
      'Starting yearly aggregation'
    );

    try {
      // Step 1: Aggregate yearly data from monthly summaries
      const result = await this.yearlyAggregationService.aggregateYear(year);

      // Step 2: Delete monthly summaries (only if aggregation succeeded)
      const deleteEnabled = this.configService.get('DELETE_MONTHLY_AFTER_YEARLY_AGGREGATION', { infer: true }) ?? true;

      let deletedCount = 0;
      if (deleteEnabled && result.errors === 0 && result.processed > 0) {
        deletedCount = await this.yearlyAggregationService.deleteMonthlySummariesForYear(year);
      }

      const durationMs = Date.now() - startTime;

      this.logInfo(
        {
          trigger,
          year,
          processed: result.processed,
          errors: result.errors,
          deletedCount,
          durationMs,
          durationSeconds: Math.round(durationMs / 1000),
        },
        'Yearly aggregation completed'
    );
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        {
          trigger,
          year,
          durationMs,
          error: message,
        },
        'Yearly aggregation failed'
      );
    } finally {
      this.isRunning = false;
    }
  }

  private getNextJanuaryFirstAt(fromDate: Date, hour: number, minute: number): Date {
    const result = new Date(fromDate);
    result.setMonth(0, 1); // January 1st
    result.setHours(hour, minute, 0, 0);

    if (result <= fromDate) {
      // Move to next year
      result.setFullYear(result.getFullYear() + 1);
    }

    return result;
  }
}
