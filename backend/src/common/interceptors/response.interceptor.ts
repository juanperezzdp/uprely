import {
  CallHandler,
  ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiSuccessResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    if (context.getType() !== 'http') {
      return next.handle() as Observable<ApiSuccessResponse<T>>;
    }

    const request = context.switchToHttp().getRequest<{ headers?: Record<string, string> }>();
    const acceptHeader = request.headers?.accept ?? '';

    if (acceptHeader.includes('text/event-stream')) {
      return next.handle() as Observable<ApiSuccessResponse<T>>;
    }

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
      })),
    );
  }
}
