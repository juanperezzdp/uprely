import {
  CallHandler,
  ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { tap, type Observable } from 'rxjs';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

type RequestWithUser = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(LoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const startedAt = Date.now();
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.info(
            {
              method: request.method,
              path: request.originalUrl,
              statusCode: response.statusCode,
              durationMs: Date.now() - startedAt,
              userId: request.user?.id ?? null,
            },
            'HTTP request handled by interceptor',
          );
        },
        error: (error: unknown) => {
          const message =
            error instanceof Error ? error.message : 'Unknown request error';

          this.logger.warn(
            {
              method: request.method,
              path: request.originalUrl,
              statusCode: response.statusCode,
              durationMs: Date.now() - startedAt,
              userId: request.user?.id ?? null,
              errorMessage: message,
            },
            'HTTP request failed in interceptor',
          );
        },
      }),
    );
  }
}
