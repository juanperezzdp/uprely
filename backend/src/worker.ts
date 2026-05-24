import process from 'node:process';
import { NestFactory } from '@nestjs/core';
import { QueueEvents, Worker } from 'bullmq';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { request } from 'undici';
import { z } from 'zod';
import { AppModule } from './app.module';
import {
  AlertEventType,
  type AlertContactJobTarget,
  type AlertJobPayload,
} from './alerts/alerts.types';
import { HeartbeatService } from './heartbeat/heartbeat.service';
import { type HeartbeatTimeoutJobPayload } from './heartbeat/heartbeat.types';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_HOST: z.string().min(1).default('redis'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_DB: z.coerce.number().int().nonnegative().default(0),
  REDIS_PASSWORD: z.string().optional().default(''),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
});

type WorkerEnv = z.infer<typeof envSchema>;

function getRedisConnection(env: WorkerEnv) {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    db: env.REDIS_DB,
    ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
  };
}

async function dispatchAlertContact(
  eventType: AlertEventType,
  contact: AlertContactJobTarget,
  payload: AlertJobPayload,
): Promise<void> {
  switch (contact.type) {
    case 'WEBHOOK': {
      const response = await request(contact.value, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(
          `Webhook dispatch failed with status ${response.statusCode} for contact ${contact.id}`,
        );
      }

      return;
    }
    case 'EMAIL':
    case 'SMS':
      process.stdout.write(
        `${JSON.stringify({
          service: 'worker',
          queue: 'alerts',
          status: 'dispatched',
          provider: 'structured-log',
          channel: contact.type,
          eventType,
          contactId: contact.id,
          target: contact.value,
          monitorId: payload.monitorId,
          monitorName: payload.monitorName,
          incidentId: payload.incidentId,
        })}\n`,
      );
      return;
    default:
      throw new Error(`Unsupported alert contact type for contact ${contact.id}`);
  }
}

async function bootstrap() {
  const env = envSchema.parse(process.env);
  const redis = new Redis(getRedisConnection(env));
  const postgres = new Pool({ connectionString: env.DATABASE_URL });
  const appContext = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const heartbeatService = appContext.get(HeartbeatService);

  await redis.ping();
  await postgres.query('SELECT 1');

  const monitorChecksWorker = new Worker(
    'monitor-checks',
    async (job) => {
      process.stdout.write(
        `${JSON.stringify({
          service: 'worker',
          status: 'processed',
          queue: job.queueName,
          name: job.name,
          jobId: job.id,
        })}\n`,
      );

      return {
        processedAt: new Date().toISOString(),
      };
    },
    {
      connection: getRedisConnection(env),
      concurrency: env.WORKER_CONCURRENCY,
    },
  );

  const alertsWorker = new Worker(
    'alerts',
    async (job) => {
      const payload = job.data as AlertJobPayload;

      for (const contact of payload.contacts) {
        await dispatchAlertContact(payload.eventType, contact, payload);
      }

      process.stdout.write(
        `${JSON.stringify({
          service: 'worker',
          status: 'processed',
          queue: job.queueName,
          name: job.name,
          jobId: job.id,
          contactCount: payload.contacts.length,
          eventType: payload.eventType,
          monitorId: payload.monitorId,
          incidentId: payload.incidentId,
        })}\n`,
      );

      return {
        processedAt: new Date().toISOString(),
        contactCount: payload.contacts.length,
      };
    },
    {
      connection: getRedisConnection(env),
      concurrency: env.WORKER_CONCURRENCY,
    },
  );

  const heartbeatTimeoutWorker = new Worker(
    'heartbeat-timeout',
    async (job) => {
      const payload = job.data as HeartbeatTimeoutJobPayload;
      const result = await heartbeatService.processTimeoutJob(payload);

      process.stdout.write(
        `${JSON.stringify({
          service: 'worker',
          status: 'processed',
          queue: job.queueName,
          name: job.name,
          jobId: job.id,
          monitorId: result.monitorId,
          expired: result.expired,
          incidentId: result.incidentId,
        })}\n`,
      );

      return result;
    },
    {
      connection: getRedisConnection(env),
      concurrency: env.WORKER_CONCURRENCY,
    },
  );

  const monitorChecksQueueEvents = new QueueEvents('monitor-checks', {
    connection: getRedisConnection(env),
  });

  const alertsQueueEvents = new QueueEvents('alerts', {
    connection: getRedisConnection(env),
  });

  const heartbeatTimeoutQueueEvents = new QueueEvents('heartbeat-timeout', {
    connection: getRedisConnection(env),
  });

  await Promise.all([
    monitorChecksQueueEvents.waitUntilReady(),
    alertsQueueEvents.waitUntilReady(),
    heartbeatTimeoutQueueEvents.waitUntilReady(),
  ]);

  process.stdout.write(
    `${JSON.stringify({
      service: 'worker',
      status: 'ready',
      concurrency: env.WORKER_CONCURRENCY,
        queues: ['monitor-checks', 'heartbeat-timeout', 'alerts'],
    })}\n`,
  );

  const shutdown = async (signal: string) => {
    await Promise.all([
      monitorChecksQueueEvents.close(),
      alertsQueueEvents.close(),
      heartbeatTimeoutQueueEvents.close(),
      monitorChecksWorker.close(),
      alertsWorker.close(),
      heartbeatTimeoutWorker.close(),
      appContext.close(),
    ]);
    await redis.quit();
    await postgres.end();
    process.stdout.write(
      `${JSON.stringify({
        service: 'worker',
        status: 'stopped',
        signal,
      })}\n`,
    );
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown worker error';
  process.stderr.write(
    `${JSON.stringify({
      service: 'worker',
      status: 'failed',
      message,
    })}\n`,
  );
  process.exit(1);
});
