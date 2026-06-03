import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnvironment, type EnvironmentVariables } from './config/env.schema';
import { SummaryWorkerModule } from './modules/summary-worker/summary-worker.module';
import { PrismaModule } from './prisma/prisma.module';

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
              service: 'uptimewatch-summary-worker',
              environment,
            },
            level:
              environment === 'development' && configuredLogLevel === 'info'
                ? 'warn'
                : configuredLogLevel,
          },
        };
      },
    }),
    PrismaModule,
    SummaryWorkerModule,
  ],
})
export class SummaryWorkerAppModule {}
