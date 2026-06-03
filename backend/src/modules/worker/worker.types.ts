import { MonitorType } from '@prisma/client';
import type { EnvironmentVariables } from '../../config/env.schema';
import {
  MONITOR_CHECK_QUEUE_NAMES,
  type MonitorCheckQueueName,
} from '../scheduler/scheduler.types';

export const WORKER_SSL_EXPIRY_THRESHOLD_DAYS = 7;
export const MONITOR_FAILURE_COUNTER_TTL_MS = 24 * 60 * 60 * 1000;
export const WORKER_RUNTIME_QUEUE_NAMES = [
  ...MONITOR_CHECK_QUEUE_NAMES,
  'heartbeat-timeout',
  'alerts',
] as const;

export type WorkerRuntimeQueueName = (typeof WORKER_RUNTIME_QUEUE_NAMES)[number];
export type WorkerQueueConcurrencyMap = Record<WorkerRuntimeQueueName, number>;

export interface MonitorExecutionTarget {
  id: string;
  userId: string;
  name: string;
  url: string | null;
  type: MonitorType;
  intervalSeconds: number;
  timeoutMs: number;
  isActive: boolean;
  keywordExpected: string | null;
  keywordMustExist: boolean | null;
  consecutiveFailuresThreshold: number;
  lastCheckedAt: Date | null;
}

export interface MonitorCheckExecutionResult {
  checkedAt: Date;
  isUp: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
  keywordFound: boolean | null;
}

export type MonitorCheckOutcome =
  | 'SKIPPED'
  | 'UP'
  | 'UNCONFIRMED_DOWN'
  | 'DOWN'
  | 'RECOVERED';

export interface MonitorCheckProcessingResult {
  processed: boolean;
  outcome: MonitorCheckOutcome;
  monitorId: string;
  monitorType: MonitorType | null;
  checkedAt: string | null;
  isUp: boolean | null;
  consecutiveFailures: number;
  incidentId: string | null;
  error: string | null;
}

export function getMonitorFailureCountKey(monitorId: string): string {
  return `worker:monitor:${monitorId}:failure-count`;
}

export function getMonitorFirstFailureAtKey(monitorId: string): string {
  return `worker:monitor:${monitorId}:first-failure-at`;
}

export function resolveWorkerQueueConcurrency(
  env: Pick<
    EnvironmentVariables,
    | 'WORKER_CONCURRENCY'
    | 'WORKER_CONCURRENCY_HTTP'
    | 'WORKER_CONCURRENCY_TCP'
    | 'WORKER_CONCURRENCY_SSL'
    | 'WORKER_CONCURRENCY_KEYWORD'
    | 'WORKER_CONCURRENCY_ALERTS'
    | 'WORKER_CONCURRENCY_HEARTBEAT_TIMEOUT'
  >,
): WorkerQueueConcurrencyMap {
  const fallback = env.WORKER_CONCURRENCY;

  return {
    'monitor-checks-http': env.WORKER_CONCURRENCY_HTTP ?? fallback,
    'monitor-checks-tcp': env.WORKER_CONCURRENCY_TCP ?? fallback,
    'monitor-checks-ssl': env.WORKER_CONCURRENCY_SSL ?? fallback,
    'monitor-checks-keyword': env.WORKER_CONCURRENCY_KEYWORD ?? fallback,
    alerts: env.WORKER_CONCURRENCY_ALERTS ?? fallback,
    'heartbeat-timeout': env.WORKER_CONCURRENCY_HEARTBEAT_TIMEOUT ?? fallback,
  };
}

export function isMonitorCheckQueueName(
  queueName: WorkerRuntimeQueueName,
): queueName is MonitorCheckQueueName {
  return (MONITOR_CHECK_QUEUE_NAMES as readonly string[]).includes(queueName);
}
