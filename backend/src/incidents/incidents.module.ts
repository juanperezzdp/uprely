import { Module, forwardRef } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { MonitorsModule } from '../monitors/monitors.module';
import { SseModule } from '../sse/sse.module';
import { IncidentsController } from './incidents.controller';
import { IncidentsRepository } from './repositories/incidents.repository';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [
    forwardRef(() => MonitorsModule),
    forwardRef(() => AlertsModule),
    SseModule,
  ],
  controllers: [IncidentsController],
  providers: [IncidentsRepository, IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
