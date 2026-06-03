import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Agent, request } from 'undici';
import type { EnvironmentVariables } from '../../config/env.schema';

interface HttpOriginStatsSummary {
  connected: number;
  pending: number;
  running: number;
  size: number;
  free?: number;
  queued?: number;
}

@Injectable()
export class WorkerHttpClientService implements OnModuleDestroy {
  private readonly agent: Agent;

  constructor(
    configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.agent = new Agent({
      connections: configService.getOrThrow('WORKER_HTTP_CONNECTIONS_PER_HOST', {
        infer: true,
      }),
      pipelining: configService.getOrThrow('WORKER_HTTP_PIPELINING', {
        infer: true,
      }),
      keepAliveTimeout: configService.getOrThrow(
        'WORKER_HTTP_KEEP_ALIVE_TIMEOUT_MS',
        {
          infer: true,
        },
      ),
      keepAliveMaxTimeout: configService.getOrThrow(
        'WORKER_HTTP_KEEP_ALIVE_MAX_TIMEOUT_MS',
        {
          infer: true,
        },
      ),
      connectTimeout: 10000,
      autoSelectFamily: true,
      maxCachedSessions: 256,
    });
  }

  request(
    url: string,
    options: NonNullable<Parameters<typeof request>[1]>,
  ): ReturnType<typeof request> {
    return request(url, {
      ...options,
      dispatcher: this.agent,
    });
  }

  getStatsSummary(): Record<string, HttpOriginStatsSummary> {
    const entries = Object.entries(this.agent.stats);

    return Object.fromEntries(
      entries.map(([origin, stats]) => [
        origin,
        {
          connected:
            typeof stats.connected === 'boolean'
              ? Number(stats.connected)
              : stats.connected,
          pending: stats.pending,
          running: stats.running,
          size: stats.size,
          ...('free' in stats
            ? {
                free: stats.free,
                queued: stats.queued,
              }
            : {}),
        },
      ]),
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.agent.closed && !this.agent.destroyed) {
      await this.agent.close();
    }
  }
}
