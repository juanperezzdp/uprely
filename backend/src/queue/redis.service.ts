import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';
import type { EnvironmentVariables } from '../config/env.schema';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly connectionOptions: RedisOptions;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    const password = configService.getOrThrow('REDIS_PASSWORD', {
      infer: true,
    });

    this.connectionOptions = {
      host: configService.getOrThrow('REDIS_HOST', {
        infer: true,
      }),
      port: configService.getOrThrow('REDIS_PORT', {
        infer: true,
      }),
      db: configService.getOrThrow('REDIS_DB', {
        infer: true,
      }),
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 1000,
      retryStrategy: () => null,
      ...(password
        ? {
            password,
          }
        : {}),
    };
    this.client = new Redis(this.connectionOptions);
    this.client.on('error', () => undefined);
  }

  getClient(): Redis {
    return this.client;
  }

  getBullConnection(): RedisOptions {
    return {
      ...this.connectionOptions,
    };
  }

  async ping(): Promise<string> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }

    return this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }
}
