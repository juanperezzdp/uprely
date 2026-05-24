import process from 'node:process';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_HOST: z.string().min(1).default('redis'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_DB: z.coerce.number().int().nonnegative().default(0),
  REDIS_PASSWORD: z.string().optional().default(''),
  SCHEDULER_PULSE_MS: z.coerce.number().int().positive().default(30000),
});

type SchedulerEnv = z.infer<typeof envSchema>;

function getRedisConnection(env: SchedulerEnv) {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    db: env.REDIS_DB,
    ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
  };
}

async function bootstrap() {
  const env = envSchema.parse(process.env);
  const redis = new Redis(getRedisConnection(env));
  const postgres = new Pool({ connectionString: env.DATABASE_URL });
  const queue = new Queue('monitor-checks', {
    connection: getRedisConnection(env),
  });

  const publishPulse = async () => {
    await redis.ping();
    await postgres.query('SELECT 1');

    const job = await queue.add(
      'scheduler-heartbeat',
      {
        emittedAt: new Date().toISOString(),
      },
      {
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    process.stdout.write(
      `${JSON.stringify({
        service: 'scheduler',
        status: 'pulse',
        queue: 'monitor-checks',
        jobId: job.id,
      })}\n`,
    );
  };

  await queue.waitUntilReady();
  await publishPulse();

  const interval = setInterval(() => {
    void publishPulse();
  }, env.SCHEDULER_PULSE_MS);

  const shutdown = async (signal: string) => {
    clearInterval(interval);
    await queue.close();
    await redis.quit();
    await postgres.end();
    process.stdout.write(
      `${JSON.stringify({
        service: 'scheduler',
        status: 'stopped',
        signal,
      })}\n`,
    );
    process.exit(0);
  };

  process.stdout.write(
    `${JSON.stringify({
      service: 'scheduler',
      status: 'ready',
      intervalMs: env.SCHEDULER_PULSE_MS,
    })}\n`,
  );

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown scheduler error';
  process.stderr.write(
    `${JSON.stringify({
      service: 'scheduler',
      status: 'failed',
      message,
    })}\n`,
  );
  process.exit(1);
});
