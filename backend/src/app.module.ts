import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { AlertsModule } from './alerts/alerts.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { validateEnvironment, type EnvironmentVariables } from './config/env.schema';
import { HealthModule } from './health/health.module';
import { HeartbeatModule } from './heartbeat/heartbeat.module';
import { IncidentsModule } from './incidents/incidents.module';
import { MonitorsModule } from './monitors/monitors.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { SseModule } from './sse/sse.module';
import { StatusPagesModule } from './status-pages/status-pages.module';
import { UsersModule } from './users/users.module';

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
            service: 'uptimewatch-api',
            environment: configService.getOrThrow('NODE_ENV', {
              infer: true,
            }),
          },
          level: configService.getOrThrow('LOG_LEVEL', {
            infer: true,
          }),
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
            ],
            remove: true,
          },
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<EnvironmentVariables, true>,
      ) => ({
        throttlers: [
          {
            name: 'auth',
            ttl: configService.getOrThrow('AUTH_RATE_LIMIT_TTL_MS', {
              infer: true,
            }),
            limit: configService.getOrThrow('AUTH_RATE_LIMIT_LIMIT', {
              infer: true,
            }),
          },
        ],
      }),
    }),
    AlertsModule,
    AuthModule,
    BillingModule,
    HeartbeatModule,
    IncidentsModule,
    MonitorsModule,
    SseModule,
    StatusPagesModule,
    UsersModule,
    PrismaModule,
    QueueModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
