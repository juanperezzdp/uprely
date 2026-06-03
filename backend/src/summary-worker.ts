import process from 'node:process';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SummaryWorkerAppModule } from './summary-worker.app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SummaryWorkerAppModule, {
    bufferLogs: true,
  });
  const logger = app.get(Logger);

  app.useLogger(logger);
  app.enableShutdownHooks();

  logger.log('Summary worker process ready');

  const shutdown = async (signal: string) => {
    logger.log(`Summary worker process stopping (${signal})`);
    await app.close();
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
  const message = error instanceof Error ? error.message : 'Unknown summary worker error';
  process.stderr.write(
    `${JSON.stringify({
      service: 'summary-worker',
      status: 'failed',
      message,
    })}\n`,
  );
  process.exit(1);
});
