import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from './config/env.schema';

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  getApiInfo() {
    const swaggerPath = this.configService.getOrThrow('SWAGGER_PATH', {
      infer: true,
    });

    return {
      name: 'uptimewatch-api',
      status: 'ok',
      docsPath: `/${swaggerPath}`,
      timestamp: new Date().toISOString(),
    };
  }
}
