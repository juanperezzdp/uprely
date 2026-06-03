import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';
import { CheckResultsRetentionService } from './check-results-retention.service';
import { WorkerRepository } from './repositories/worker.repository';

describe('CheckResultsRetentionService', () => {
  let service: CheckResultsRetentionService;
  let workerRepository: jest.Mocked<WorkerRepository>;
  let logger: jest.Mocked<PinoLogger>;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-26T12:00:00.000Z'));

    workerRepository = {
      findCheckResultIdsOlderThan: jest.fn(),
      deleteCheckResultsByIds: jest.fn(),
    } as unknown as jest.Mocked<WorkerRepository>;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    const configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'CHECK_RESULTS_RETENTION_DAYS') {
          return 30;
        }

        if (key === 'CHECK_RESULTS_CLEANUP_INTERVAL_MS') {
          return 3600000;
        }

        if (key === 'CHECK_RESULTS_CLEANUP_BATCH_SIZE') {
          return 2;
        }

        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as ConfigService;

    service = new CheckResultsRetentionService(
      configService as ConfigService,
      logger,
      workerRepository,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deletes expired check results in batches until there are no more rows', async () => {
    workerRepository.findCheckResultIdsOlderThan
      .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
      .mockResolvedValueOnce([{ id: 'c' }]);
    workerRepository.deleteCheckResultsByIds
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await service.cleanupExpiredResults();

    expect(workerRepository.findCheckResultIdsOlderThan).toHaveBeenNthCalledWith(1, {
      cutoff: new Date('2026-04-26T12:00:00.000Z'),
      take: 2,
    });
    expect(workerRepository.findCheckResultIdsOlderThan).toHaveBeenNthCalledWith(2, {
      cutoff: new Date('2026-04-26T12:00:00.000Z'),
      take: 2,
    });
    expect(workerRepository.deleteCheckResultsByIds).toHaveBeenNthCalledWith(1, [
      'a',
      'b',
    ]);
    expect(workerRepository.deleteCheckResultsByIds).toHaveBeenNthCalledWith(2, ['c']);
    expect(result).toEqual({
      deletedCount: 3,
      batches: 2,
      cutoff: '2026-04-26T12:00:00.000Z',
    });
  });
});
