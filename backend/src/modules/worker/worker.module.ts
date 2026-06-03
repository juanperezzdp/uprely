import { Module } from '@nestjs/common';
import { HeartbeatModule } from '../../heartbeat/heartbeat.module';
import { IncidentsModule } from '../../incidents/incidents.module';
import { AlertsProcessorService } from './alerts-processor.service';
import { MonitorCheckExecutorService } from './monitor-check-executor.service';
import { WorkerMetricsService } from './worker-metrics.service';
import { MonitorCheckProcessorService } from './monitor-check-processor.service';
import { WorkerRepository } from './repositories/worker.repository';
import { WorkerHttpClientService } from './worker-http-client.service';
import { WorkerRuntimeService } from './worker-runtime.service';

@Module({
  imports: [IncidentsModule, HeartbeatModule],
  providers: [
    WorkerRepository,
    WorkerHttpClientService,
    MonitorCheckExecutorService,
    WorkerMetricsService,
    MonitorCheckProcessorService,
    AlertsProcessorService,
    WorkerRuntimeService,
  ],
})
export class WorkerModule {}
