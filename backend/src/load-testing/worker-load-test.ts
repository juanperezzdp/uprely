import 'dotenv/config';
import http from 'node:http';
import net from 'node:net';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { MonitorType, Plan, PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { Pool } from 'pg';
import { z } from 'zod';
import { BULL_QUEUE_NAMES } from '../queue/queue.constants';
import {
  buildLoadTestMonitorPlan,
  parseLoadTestMonitorTypes,
  type SupportedLoadTestMonitorType,
} from './worker-load-test.utils';

const cliSchema = z.object({
  monitors: z.coerce.number().int().positive().default(1000),
  durationSec: z.coerce.number().int().positive().default(120),
  sampleIntervalSec: z.coerce.number().int().positive().default(10),
  schedulerSettleSec: z.coerce.number().int().positive().default(35),
  intervalSeconds: z.coerce.number().int().positive().default(60),
  timeoutMs: z.coerce.number().int().positive().default(5000),
  cleanup: z.enum(['true', 'false']).default('false'),
  tag: z.string().min(1).optional(),
  types: z.string().optional(),
  httpPort: z.coerce.number().int().min(0).max(65535).default(0),
  tcpPort: z.coerce.number().int().min(0).max(65535).default(0),
  keyword: z.string().min(1).default('UPTIMEWATCH_OK'),
});

const runtimeEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_HOST: z.string().min(1).default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_DB: z.coerce.number().int().nonnegative().default(0),
  REDIS_PASSWORD: z.string().default(''),
});

interface CliOptions {
  monitors: number;
  durationSec: number;
  sampleIntervalSec: number;
  schedulerSettleSec: number;
  intervalSeconds: number;
  timeoutMs: number;
  cleanup: boolean;
  tag: string;
  types: SupportedLoadTestMonitorType[];
  httpPort: number;
  tcpPort: number;
  keyword: string;
}

interface RuntimeEnvironment {
  DATABASE_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_DB: number;
  REDIS_PASSWORD: string;
}

interface HttpTargetServerHandle {
  server: http.Server;
  port: number;
}

interface TcpTargetServerHandle {
  server: net.Server;
  port: number;
}

interface LoadTestContext {
  userId: string;
  userEmail: string;
}

interface LoadTestSnapshot {
  timestamp: string;
  checkResults: number;
  incidents: number;
  averageLatencyMs: number | null;
  uptimeRatio: number | null;
  queueBacklog: Record<string, number>;
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const runtimeEnv = runtimeEnvSchema.parse(process.env);
  const prismaResources = createPrismaClient(runtimeEnv.DATABASE_URL);
  const redis = createRedisClient(runtimeEnv);
  const queues = BULL_QUEUE_NAMES.map((queueName) => new Queue(queueName, { connection: redis }));

  const httpTargetServer = await startHttpTargetServer(options.httpPort, options.keyword);
  const tcpTargetServer = await startTcpTargetServer(options.tcpPort);

  try {
    await prismaResources.client.$connect();

    const context = await createLoadTestContext(prismaResources.client, options.tag);
    await seedLoadTestMonitors(prismaResources.client, context, options, {
      httpUrl: `http://127.0.0.1:${httpTargetServer.port}/health`,
      tcpTarget: `127.0.0.1:${tcpTargetServer.port}`,
      keywordUrl: `http://127.0.0.1:${httpTargetServer.port}/keyword`,
      keywordExpected: options.keyword,
    });

    writeInfo('Load test context created', {
      userEmail: context.userEmail,
      userId: context.userId,
      monitorCount: options.monitors,
      types: options.types,
      durationSec: options.durationSec,
      schedulerSettleSec: options.schedulerSettleSec,
      sampleIntervalSec: options.sampleIntervalSec,
      intervalSeconds: options.intervalSeconds,
      timeoutMs: options.timeoutMs,
      httpTarget: `http://127.0.0.1:${httpTargetServer.port}/health`,
      tcpTarget: `127.0.0.1:${tcpTargetServer.port}`,
      keywordTarget: `http://127.0.0.1:${httpTargetServer.port}/keyword`,
      cleanup: options.cleanup,
    });

    writeInfo(
      'Waiting for scheduler and worker to pick up seeded monitors',
      { seconds: options.schedulerSettleSec },
    );
    await sleep(options.schedulerSettleSec * 1000);

    const baseline = await collectSnapshot(prismaResources.client, queues, context.userId);
    const startedAt = Date.now();
    let previousSnapshot = baseline;

    writeInfo('Load test baseline captured', baseline);

    while (Date.now() - startedAt < options.durationSec * 1000) {
      await sleep(options.sampleIntervalSec * 1000);
      const snapshot = await collectSnapshot(prismaResources.client, queues, context.userId);
      writeInfo('Load test sample', {
        ...snapshot,
        deltaCheckResults: snapshot.checkResults - previousSnapshot.checkResults,
        deltaIncidents: snapshot.incidents - previousSnapshot.incidents,
      });
      previousSnapshot = snapshot;
    }

    const finalSnapshot = await collectSnapshot(prismaResources.client, queues, context.userId);
    const elapsedSec = Math.max(Math.round((Date.now() - startedAt) / 1000), 1);
    const totalCheckResults = finalSnapshot.checkResults - baseline.checkResults;
    const checksPerSecond = totalCheckResults / elapsedSec;
    const checksPerMinute = checksPerSecond * 60;

    writeInfo('Load test summary', {
      tag: options.tag,
      userEmail: context.userEmail,
      durationSec: elapsedSec,
      monitorCount: options.monitors,
      checkResultsDuringWindow: totalCheckResults,
      checksPerSecond: Number(checksPerSecond.toFixed(2)),
      checksPerMinute: Number(checksPerMinute.toFixed(2)),
      incidentsDuringWindow: finalSnapshot.incidents - baseline.incidents,
      averageLatencyMs: finalSnapshot.averageLatencyMs,
      uptimeRatio: finalSnapshot.uptimeRatio,
      queueBacklog: finalSnapshot.queueBacklog,
    });

    if (options.cleanup) {
      await prismaResources.client.user.delete({
        where: {
          id: context.userId,
        },
      });
      writeInfo('Load test data cleaned up', {
        userId: context.userId,
        userEmail: context.userEmail,
      });
    }
  } finally {
    await Promise.allSettled([
      ...queues.map(async (queue) => queue.close()),
      redis.quit(),
      stopHttpTargetServer(httpTargetServer),
      stopTcpTargetServer(tcpTargetServer),
      prismaResources.client.$disconnect(),
      prismaResources.pool.end(),
    ]);
  }
}

function parseCliOptions(rawArgs: string[]): CliOptions {
  const parsedArgs = Object.fromEntries(
    rawArgs.map((argument) => {
      if (!argument.startsWith('--')) {
        throw new Error(`Invalid argument format "${argument}". Use --name=value`);
      }

      const separatorIndex = argument.indexOf('=');

      if (separatorIndex === -1) {
        const key = argument.slice(2);

        return [key, 'true'];
      }

      return [argument.slice(2, separatorIndex), argument.slice(separatorIndex + 1)];
    }),
  );
  const parsed = cliSchema.parse(parsedArgs);
  const tag = parsed.tag ?? randomUUID().slice(0, 8);

  return {
    monitors: parsed.monitors,
    durationSec: parsed.durationSec,
    sampleIntervalSec: parsed.sampleIntervalSec,
    schedulerSettleSec: parsed.schedulerSettleSec,
    intervalSeconds: parsed.intervalSeconds,
    timeoutMs: parsed.timeoutMs,
    cleanup: parsed.cleanup === 'true',
    tag,
    types: parseLoadTestMonitorTypes(parsed.types),
    httpPort: parsed.httpPort,
    tcpPort: parsed.tcpPort,
    keyword: parsed.keyword,
  };
}

function createPrismaClient(databaseUrl: string): {
  client: PrismaClient;
  pool: Pool;
} {
  const pool = new Pool({
    connectionString: databaseUrl,
  });
  const client = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  return {
    client,
    pool,
  };
}

function createRedisClient(env: RuntimeEnvironment): IORedis {
  return new IORedis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    db: env.REDIS_DB,
    password: env.REDIS_PASSWORD.length > 0 ? env.REDIS_PASSWORD : undefined,
    maxRetriesPerRequest: null,
  });
}

async function startHttpTargetServer(
  requestedPort: number,
  keyword: string,
): Promise<HttpTargetServerHandle> {
  const server = http.createServer((request, response) => {
    if (request.url === '/keyword') {
      response.writeHead(200, {
        'content-type': 'text/plain; charset=utf-8',
      });
      response.end(`worker-load-test ${keyword}`);
      return;
    }

    if (request.url === '/health') {
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
      });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    response.writeHead(404, {
      'content-type': 'text/plain; charset=utf-8',
    });
    response.end('not-found');
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(requestedPort, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('HTTP target server did not expose a TCP port');
  }

  return {
    server,
    port: address.port,
  };
}

async function stopHttpTargetServer(handle: HttpTargetServerHandle): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    handle.server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function startTcpTargetServer(requestedPort: number): Promise<TcpTargetServerHandle> {
  const server = net.createServer((socket) => {
    socket.end();
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(requestedPort, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('TCP target server did not expose a TCP port');
  }

  return {
    server,
    port: address.port,
  };
}

async function stopTcpTargetServer(handle: TcpTargetServerHandle): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    handle.server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function createLoadTestContext(
  prisma: PrismaClient,
  tag: string,
): Promise<LoadTestContext> {
  const user = await prisma.user.create({
    data: {
      email: `loadtest+${tag}@uptimewatch.local`,
      passwordHash: `loadtest-${tag}`,
      plan: Plan.PRO,
    },
    select: {
      id: true,
      email: true,
    },
  });

  return {
    userId: user.id,
    userEmail: user.email,
  };
}

async function seedLoadTestMonitors(
  prisma: PrismaClient,
  context: LoadTestContext,
  options: CliOptions,
  targets: {
    httpUrl: string;
    tcpTarget: string;
    keywordUrl: string;
    keywordExpected: string;
  },
): Promise<void> {
  const monitors = buildLoadTestMonitorPlan({
    monitorCount: options.monitors,
    types: options.types,
    intervalSeconds: options.intervalSeconds,
    timeoutMs: options.timeoutMs,
    userId: context.userId,
    tag: options.tag,
    ...targets,
  });
  const batchSize = 500;

  for (let offset = 0; offset < monitors.length; offset += batchSize) {
    await prisma.monitor.createMany({
      data: monitors.slice(offset, offset + batchSize),
    });
  }
}

async function collectSnapshot(
  prisma: PrismaClient,
  queues: Array<Queue>,
  userId: string,
): Promise<LoadTestSnapshot> {
  const [checkResults, incidents, latencyAggregate, upCheckResults, queueCounts] =
    await Promise.all([
      prisma.checkResult.count({
        where: {
          monitor: {
            userId,
          },
        },
      }),
      prisma.incident.count({
        where: {
          monitor: {
            userId,
          },
        },
      }),
      prisma.checkResult.aggregate({
        where: {
          monitor: {
            userId,
          },
          latencyMs: {
            not: null,
          },
        },
        _avg: {
          latencyMs: true,
        },
      }),
      prisma.checkResult.count({
        where: {
          monitor: {
            userId,
          },
          isUp: true,
        },
      }),
      Promise.all(
        queues.map(async (queue) => [
          queue.name,
          await queue.getJobCounts('wait', 'active', 'delayed', 'failed'),
        ] as const),
      ),
    ]);

  return {
    timestamp: new Date().toISOString(),
    checkResults,
    incidents,
    averageLatencyMs:
      latencyAggregate._avg.latencyMs === null
        ? null
        : Number(latencyAggregate._avg.latencyMs.toFixed(2)),
    uptimeRatio:
      checkResults === 0 ? null : Number((upCheckResults / checkResults).toFixed(4)),
    queueBacklog: Object.fromEntries(
      queueCounts.map(([queueName, counts]) => [
        queueName,
        counts.wait + counts.active + counts.delayed + counts.failed,
      ]),
    ),
  };
}

function writeInfo(message: string, payload: object): void {
  process.stdout.write(
    `${JSON.stringify({
      level: 'info',
      message,
      ...payload,
    })}\n`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown load test error';
  process.stderr.write(
    `${JSON.stringify({
      level: 'error',
      message,
    })}\n`,
  );
  process.exit(1);
});
