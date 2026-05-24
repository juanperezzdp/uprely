import { Module } from '@nestjs/common';
import { SseController } from './sse.controller';
import { SseService } from './sse.service';
import { SseRepository } from './repositories/sse.repository';

@Module({
  controllers: [SseController],
  providers: [SseRepository, SseService],
  exports: [SseService],
})
export class SseModule {}
