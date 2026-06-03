import { resolveWorkerQueueConcurrency } from './worker.types';

describe('resolveWorkerQueueConcurrency', () => {
  it('uses the global worker concurrency as fallback for every queue', () => {
    const result = resolveWorkerQueueConcurrency({
      WORKER_CONCURRENCY: 6,
      WORKER_CONCURRENCY_HTTP: undefined,
      WORKER_CONCURRENCY_TCP: undefined,
      WORKER_CONCURRENCY_SSL: undefined,
      WORKER_CONCURRENCY_KEYWORD: undefined,
      WORKER_CONCURRENCY_ALERTS: undefined,
      WORKER_CONCURRENCY_HEARTBEAT_TIMEOUT: undefined,
    });

    expect(result).toEqual({
      'monitor-checks-http': 6,
      'monitor-checks-tcp': 6,
      'monitor-checks-ssl': 6,
      'monitor-checks-keyword': 6,
      alerts: 6,
      'heartbeat-timeout': 6,
    });
  });

  it('applies queue-specific overrides without affecting the others', () => {
    const result = resolveWorkerQueueConcurrency({
      WORKER_CONCURRENCY: 6,
      WORKER_CONCURRENCY_HTTP: 30,
      WORKER_CONCURRENCY_TCP: 20,
      WORKER_CONCURRENCY_SSL: 5,
      WORKER_CONCURRENCY_KEYWORD: 10,
      WORKER_CONCURRENCY_ALERTS: 3,
      WORKER_CONCURRENCY_HEARTBEAT_TIMEOUT: 2,
    });

    expect(result).toEqual({
      'monitor-checks-http': 30,
      'monitor-checks-tcp': 20,
      'monitor-checks-ssl': 5,
      'monitor-checks-keyword': 10,
      alerts: 3,
      'heartbeat-timeout': 2,
    });
  });
});
