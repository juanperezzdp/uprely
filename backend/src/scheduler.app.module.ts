import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnvironment, type EnvironmentVariables } from './config/env.schema';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';

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
      ) => ({
        pinoHttp: {
          base: {
            service: 'uptimewatch-scheduler',
            environment: configService.getOrThrow('NODE_ENV', {
              infer: true,
            }),
          },
          level: configService.getOrThrow('LOG_LEVEL', {
            infer: true,
          }),
        },
      }),
    }),
    PrismaModule,
    QueueModule,
    SchedulerModule,
  ],
})
export class SchedulerAppModule {}
