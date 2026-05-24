import { Module, forwardRef } from '@nestjs/common';
import { IncidentsModule } from '../incidents/incidents.module';
import { HeartbeatController } from './heartbeat.controller';
import { HeartbeatService } from './heartbeat.service';
import { HeartbeatRepository } from './repositories/heartbeat.repository';

@Module({
  imports: [forwardRef(() => IncidentsModule)],
  controllers: [HeartbeatController],
  providers: [HeartbeatRepository, HeartbeatService],
  exports: [HeartbeatService],
})
export class HeartbeatModule {}
