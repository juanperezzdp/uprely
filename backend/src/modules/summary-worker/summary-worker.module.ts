import { Module } from '@nestjs/common';
import { SummariesModule } from '../summaries/summaries.module';
import { CheckResultsRetentionService } from '../worker/check-results-retention.service';
import { WorkerRepository } from '../worker/repositories/worker.repository';

@Module({
  imports: [SummariesModule],
  providers: [WorkerRepository, CheckResultsRetentionService],
})
export class SummaryWorkerModule {}
