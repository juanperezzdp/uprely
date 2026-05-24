import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HeartbeatService } from './heartbeat.service';

@ApiTags('Heartbeat')
@Controller('heartbeat')
export class HeartbeatController {
  constructor(private readonly heartbeatService: HeartbeatService) {}

  @Get(':token/ping')
  @ApiOkResponse({
    description: 'Register a public heartbeat ping and reset the timeout window',
  })
  @ApiOperation({
    summary: 'Receive a heartbeat ping',
  })
  ping(@Param('token') token: string) {
    return this.heartbeatService.ping(token);
  }
}
