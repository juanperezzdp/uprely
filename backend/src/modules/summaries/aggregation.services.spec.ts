import type { PinoLogger } from 'nestjs-pino';
import { DailyAggregationService } from './daily-aggregation.service';
import { WeeklyAggregationService } from './weekly-aggregation.service';
import { MonthlyAggregationService } from './monthly-aggregation.service';
import { YearlyAggregationService } from './yearly-aggregation.service';
import type { PrismaService } from '../../prisma/prisma.service';

describe('Aggregation Services', () => {
  let dailyService: DailyAggregationService;
  let weeklyService: WeeklyAggregationService;
  let monthlyService: MonthlyAggregationService;
  let yearlyService: YearlyAggregationService;

  let prisma: jest.Mocked<PrismaService>;
  let logger: jest.Mocked<PinoLogger>;

  beforeEach(() => {
    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    prisma = {
      checkResult: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      incident: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      monitorDailySummary: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      monitorWeeklySummary: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      monitorMonthlySummary: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      monitorYearlySummary: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(),
    } as unknown as jest.Mocked<PrismaService>;

    dailyService = new DailyAggregationService(prisma, logger);
    weeklyService = new WeeklyAggregationService(prisma, logger);
    monthlyService = new MonthlyAggregationService(prisma, logger);
    yearlyService = new YearlyAggregationService(prisma, logger);
  });

  describe('DailyAggregationService', () => {
    it('should aggregate check results for a given date', async () => {
      const date = new Date('2024-01-15');
      const monitorId = 'monitor-1';

      (prisma.checkResult.groupBy as jest.Mock).mockResolvedValue([
        { monitorId, _count: { id: 100 } },
      ]);

      (prisma.checkResult.findMany as jest.Mock).mockResolvedValue([
        { isUp: true, latencyMs: 100 },
        { isUp: true, latencyMs: 150 },
        { isUp: false, latencyMs: null },
      ]);

      const result = await dailyService.aggregateDate(date);

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
    });
  });

  describe('WeeklyAggregationService', () => {
    it('should aggregate weekly data from daily summaries', async () => {
      const year = 2024;
      const weekNumber = 3;

      (prisma.monitorDailySummary.groupBy as jest.Mock).mockResolvedValue([
        { monitorId: 'monitor-1', _count: { id: 7 } },
      ]);

      (prisma.monitorDailySummary.findMany as jest.Mock).mockResolvedValue([
        { totalChecks: 1440, upChecks: 1400, avgLatencyMs: 100, p95LatencyMs: 200, p99LatencyMs: 300, incidentsCount: 0, totalDowntimeMinutes: 0 },
        { totalChecks: 1440, upChecks: 1380, avgLatencyMs: 110, p95LatencyMs: 210, p99LatencyMs: 320, incidentsCount: 1, totalDowntimeMinutes: 5 },
      ]);

      const result = await weeklyService.aggregateWeek(year, weekNumber);

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
    });
  });

  describe('MonthlyAggregationService', () => {
    it('should aggregate monthly data from weekly summaries', async () => {
      const year = 2024;
      const month = 1;

      (prisma.monitorWeeklySummary.groupBy as jest.Mock).mockResolvedValue([
        { monitorId: 'monitor-1', _count: { id: 4 } },
      ]);

      (prisma.monitorWeeklySummary.findMany as jest.Mock).mockResolvedValue([
        { totalChecks: 10080, upChecks: 9800, avgLatencyMs: 100, p95LatencyMs: 200, p99LatencyMs: 300, incidentsCount: 0, totalDowntimeMinutes: 0 },
        { totalChecks: 10080, upChecks: 9900, avgLatencyMs: 110, p95LatencyMs: 210, p99LatencyMs: 320, incidentsCount: 1, totalDowntimeMinutes: 10 },
      ]);

      const result = await monthlyService.aggregateMonth(year, month);

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
    });
  });

  describe('YearlyAggregationService', () => {
    it('should aggregate yearly data from monthly summaries', async () => {
      const year = 2024;

      (prisma.monitorMonthlySummary.groupBy as jest.Mock).mockResolvedValue([
        { monitorId: 'monitor-1', _count: { id: 12 } },
      ]);

      (prisma.monitorMonthlySummary.findMany as jest.Mock).mockResolvedValue([
        { totalChecks: 40320, upChecks: 39200, avgLatencyMs: 100, p95LatencyMs: 200, p99LatencyMs: 300, incidentsCount: 0, totalDowntimeMinutes: 0 },
        { totalChecks: 40320, upChecks: 39600, avgLatencyMs: 110, p95LatencyMs: 210, p99LatencyMs: 320, incidentsCount: 2, totalDowntimeMinutes: 30 },
      ]);

      const result = await yearlyService.aggregateYear(year);

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
    });
  });
});
