import { Module } from '@nestjs/common';
import { SchedulerRepository } from './repositories/scheduler.repository';
import { SchedulerService } from './scheduler.service';

@Module({
  providers: [SchedulerRepository, SchedulerService],
})
export class SchedulerModule {}
