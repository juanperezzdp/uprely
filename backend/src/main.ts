import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  parseCorsOrigins,
  type EnvironmentVariables,
} from './config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  const configService = app.get<ConfigService<EnvironmentVariables, true>>(
    ConfigService,
  );
  const logger = app.get(Logger);
  const swaggerPath = configService.getOrThrow('SWAGGER_PATH', {
    infer: true,
  });
  const corsOrigins = parseCorsOrigins(
    configService.getOrThrow('CORS_ORIGINS', {
      infer: true,
    }),
  );

  app.useLogger(logger);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      forbidUnknownValues: true,
    }),
  );
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('UptimeWatch API')
    .setDescription(
      'UptimeWatch REST API for monitoring, incidents, alerts, billing, and status pages',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addCookieAuth('auth_token')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(swaggerPath, app, document, {
    jsonDocumentUrl: `${swaggerPath}-json`,
  });

  const port = configService.getOrThrow('PORT', {
    infer: true,
  });
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
