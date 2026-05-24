import { Module } from '@nestjs/common';
import { MonitorsModule } from '../monitors/monitors.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsRepository } from './repositories/alerts.repository';

@Module({
  imports: [MonitorsModule],
  controllers: [AlertsController],
  providers: [AlertsRepository, AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
