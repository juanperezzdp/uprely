import { Global, Module } from '@nestjs/common';
import { BullQueueService } from './bull-queue.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService, BullQueueService],
  exports: [RedisService, BullQueueService],
})
export class QueueModule {}
