import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';
import type { EnvironmentVariables } from '../config/env.schema';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
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

  async getConnectedClient(): Promise<Redis> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }

    return this.client;
  }

  getBullConnection(): RedisOptions {
    return {
      ...this.connectionOptions,
      lazyConnect: false,
      enableOfflineQueue: true,
    };
  }

  async onModuleInit(): Promise<void> {
    return Promise.resolve();
  }

  async ping(): Promise<string> {
    return (await this.getConnectedClient()).ping();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }
}
