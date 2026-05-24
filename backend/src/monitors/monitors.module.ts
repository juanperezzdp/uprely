import { Module, forwardRef } from '@nestjs/common';
import { HeartbeatModule } from '../heartbeat/heartbeat.module';
import { MonitorsController } from './monitors.controller';
import { MonitorsRepository } from './repositories/monitors.repository';
import { MonitorsService } from './monitors.service';

@Module({
  imports: [forwardRef(() => HeartbeatModule)],
  controllers: [MonitorsController],
  providers: [MonitorsRepository, MonitorsService],
  exports: [MonitorsService, MonitorsRepository],
})
export class MonitorsModule {}
