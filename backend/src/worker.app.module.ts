import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnvironment, type EnvironmentVariables } from './config/env.schema';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { WorkerModule } from './modules/worker/worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<EnvironmentVariables, true>,
      ) => {
        const environment = configService.getOrThrow('NODE_ENV', {
          infer: true,
        });
        const configuredLogLevel = configService.getOrThrow('LOG_LEVEL', {
          infer: true,
        });

        return {
          pinoHttp: {
            base: {
              service: 'uptimewatch-worker',
              environment,
            },
            // Keep the worker quieter in development while preserving warnings and errors.
            level:
              environment === 'development' && configuredLogLevel === 'info'
                ? 'warn'
                : configuredLogLevel,
          },
        };
      },
    }),
    PrismaModule,
    QueueModule,
    WorkerModule,
  ],
})
export class WorkerAppModule {}
