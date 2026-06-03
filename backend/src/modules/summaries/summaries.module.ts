import { Module } from '@nestjs/common';
import { SummariesRepository } from './summaries.repository';
import { DailyAggregationService } from './daily-aggregation.service';
import { DailyAggregationJob } from './daily-aggregation.job';
import { WeeklyAggregationService } from './weekly-aggregation.service';
import { WeeklyAggregationJob } from './weekly-aggregation.job';
import { MonthlyAggregationService } from './monthly-aggregation.service';
import { MonthlyAggregationJob } from './monthly-aggregation.job';
import { YearlyAggregationService } from './yearly-aggregation.service';
import { YearlyAggregationJob } from './yearly-aggregation.job';

@Module({
  providers: [
    SummariesRepository,
    DailyAggregationService,
    DailyAggregationJob,
    WeeklyAggregationService,
    WeeklyAggregationJob,
    MonthlyAggregationService,
    MonthlyAggregationJob,
    YearlyAggregationService,
    YearlyAggregationJob,
  ],
  exports: [
    SummariesRepository,
    DailyAggregationService,
    WeeklyAggregationService,
    MonthlyAggregationService,
    YearlyAggregationService,
  ],
})
export class SummariesModule {}
