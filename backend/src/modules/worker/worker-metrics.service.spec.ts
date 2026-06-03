import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';
import { BullQueueService } from '../../queue/bull-queue.service';
import { WorkerHttpClientService } from './worker-http-client.service';
import { WorkerMetricsService } from './worker-metrics.service';

describe('WorkerMetricsService', () => {
  let service: WorkerMetricsService;
  let bullQueueService: jest.Mocked<BullQueueService>;
  let workerHttpClientService: jest.Mocked<WorkerHttpClientService>;
  let logger: jest.Mocked<PinoLogger>;

  beforeEach(() => {
    bullQueueService = {
      getQueue: jest.fn((name: string) => ({
        getJobCounts: jest.fn().mockResolvedValue({
          wait: name === 'monitor-checks-http' ? 10 : 1,
          active: 2,
          delayed: 3,
          completed: 40,
          failed: 0,
          paused: 0,
        }),
      })),
    } as unknown as jest.Mocked<BullQueueService>;

    workerHttpClientService = {
      getStatsSummary: jest.fn().mockReturnValue({
        'https://api.example.com': {
          connected: 4,
          free: 2,
          pending: 1,
          queued: 0,
          running: 2,
          size: 3,
        },
      }),
    } as unknown as jest.Mocked<WorkerHttpClientService>;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    const configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'WORKER_METRICS_INTERVAL_MS') {
          return 30000;
        }

        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as ConfigService;

    service = new WorkerMetricsService(
      configService as ConfigService,
      logger,
      bullQueueService,
      workerHttpClientService,
    );
  });

  it('collects queue, http client and process metrics in one snapshot', async () => {
    const result = await service.collectMetrics();

    expect(result.queueMetrics.monitorChecks.wait).toBe(13);
    expect(result.queueMetrics['monitor-checks-http'].wait).toBe(10);
    expect(result.queueMetrics['monitor-checks-keyword'].wait).toBe(1);
    expect(result.httpClientMetrics['https://api.example.com']).toEqual({
      connected: 4,
      free: 2,
      pending: 1,
      queued: 0,
      running: 2,
      size: 3,
    });
    expect(result.processMetrics.rssBytes).toBeGreaterThan(0);
    expect(result.processMetrics.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
