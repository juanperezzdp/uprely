import type { PinoLogger } from 'nestjs-pino';
import { DailyAggregationService } from './daily-aggregation.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CheckResult, Incident, MonitorDailySummary } from '@prisma/client';

describe('DailyAggregationService', () => {
  let service: DailyAggregationService;
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
        groupBy: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      incident: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      monitorDailySummary: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as jest.Mocked<PrismaService>;

    service = new DailyAggregationService(prisma, logger);
  });

  describe('aggregateDate', () => {
    it('should aggregate check results for a given date', async () => {
      const date = new Date('2024-01-15');
      const monitorId = 'monitor-1';

      const mockGroupByResult = [
        { monitorId, _count: { id: 1440 } },
      ];

      (prisma.checkResult.groupBy as jest.Mock).mockResolvedValue(mockGroupByResult);

      const mockChecks: Partial<CheckResult>[] = [
        { isUp: true, latencyMs: 100 },
        { isUp: true, latencyMs: 150 },
        { isUp: false, latencyMs: null },
      ];

      (prisma.checkResult.findMany as jest.Mock).mockResolvedValue(mockChecks);
      (prisma.incident.count as jest.Mock).mockResolvedValue(0);
      (prisma.incident.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.monitorDailySummary.upsert as jest.Mock).mockResolvedValue({} as MonitorDailySummary);

      const result = await service.aggregateDate(date);

      expect(result.processed).toBe(1);
      expect(result.errors).toBe(0);
      expect(prisma.checkResult.groupBy).toHaveBeenCalled();
      expect(prisma.monitorDailySummary.upsert).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const date = new Date('2024-01-15');

      (prisma.checkResult.groupBy as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await service.aggregateDate(date);

      expect(result.processed).toBe(0);
      expect(result.errors).toBe(0); // The error is caught and logged, not counted in errors
    });
  });

  describe('deleteChecksForDate', () => {
    it('should delete check results for a given date', async () => {
      const date = new Date('2024-01-15');

      (prisma.checkResult.deleteMany as jest.Mock).mockResolvedValue({ count: 1440 });

      const result = await service.deleteChecksForDate(date);

      expect(result).toBe(1440);
      expect(prisma.checkResult.deleteMany).toHaveBeenCalled();
    });
  });
});
