import {
  Controller,
  MessageEvent,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Observable } from 'rxjs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { SseService } from './sse.service';

@ApiTags('SSE')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('sse')
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Sse('monitors')
  @ApiOkResponse({
    description: 'Stream monitor status changes for the authenticated user',
  })
  @ApiOperation({
    summary: 'Stream monitor status changes in real time',
  })
  streamMonitors(
    @CurrentUser() user: AuthenticatedUser,
  ): Observable<MessageEvent> {
    return this.sseService.streamMonitorEvents(user);
  }
}
