export interface DailyAggregationResult {
  monitorId: string;
  date: Date;
  totalChecks: number;
  upChecks: number;
  downChecks: number;
  uptimePercentage: number;
  avgLatencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
}

export interface AggregationJobConfig {
  runHour: number;
  runMinute: number;
  deleteAfterAggregate: boolean;
  retentionDays: number;
}
