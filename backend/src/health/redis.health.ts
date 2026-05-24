import { Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { RedisService } from '../queue/redis.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly redisService: RedisService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const response = await this.redisService.ping();

      if (response !== 'PONG') {
        return indicator.down({
          message: `Unexpected Redis ping response: ${response}`,
        });
      }

      return indicator.up();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Redis connection error';

      return indicator.down({
        message,
      });
    }
  }
}
