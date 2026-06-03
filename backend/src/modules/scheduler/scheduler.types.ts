import { MonitorType } from '@prisma/client';
import type { BullQueueName } from '../../queue/queue.constants';

export const MONITOR_CHECK_JOB_NAME = 'monitor-check-execute';
export const SCHEDULER_SYNC_LOCK_KEY = 'scheduler:sync:lock';
export const MONITOR_CHECK_QUEUE_NAMES = [
  'monitor-checks-http',
  'monitor-checks-tcp',
  'monitor-checks-ssl',
  'monitor-checks-keyword',
] as const satisfies BullQueueName[];

export type MonitorCheckQueueName = (typeof MONITOR_CHECK_QUEUE_NAMES)[number];

export interface SchedulerMonitorTarget {
  id: string;
  type: MonitorType;
  isActive: boolean;
  intervalSeconds: number;
  timeoutMs: number;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MonitorCheckJobPayload {
  monitorId: string;
}

export function getMonitorCheckSchedulerId(monitorId: string): string {
  return `monitor-check:${monitorId}`;
}

export function getMonitorCheckQueueName(
  monitorType: MonitorType,
): MonitorCheckQueueName {
  switch (monitorType) {
    case MonitorType.HTTP:
      return 'monitor-checks-http';
    case MonitorType.TCP:
      return 'monitor-checks-tcp';
    case MonitorType.SSL:
      return 'monitor-checks-ssl';
    case MonitorType.KEYWORD:
      return 'monitor-checks-keyword';
    default:
      throw new Error(`Monitor type ${monitorType} does not use a monitor check queue`);
  }
}

export function getMonitorCheckSchedulerOffsetMs(
  monitorId: string,
  intervalSeconds: number,
): number {
  const intervalMs = Math.max(intervalSeconds * 1000, 1);
  let hash = 0;

  for (let index = 0; index < monitorId.length; index += 1) {
    hash = (hash * 33 + monitorId.charCodeAt(index)) >>> 0;
  }

  return hash % intervalMs;
}
