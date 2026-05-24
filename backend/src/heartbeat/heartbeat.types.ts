import { MonitorType } from '@prisma/client';

export const HEARTBEAT_TIMEOUT_JOB_NAME = 'heartbeat-timeout-expire';
export const HEARTBEAT_TIMEOUT_CAUSE = 'Heartbeat timeout exceeded';

export interface HeartbeatTimeoutJobPayload {
  monitorId: string;
  expectedBy: string;
}

export interface HeartbeatMonitorQueueTarget {
  id: string;
  type: MonitorType;
  isActive: boolean;
  intervalSeconds: number;
  timeoutMs: number;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function getHeartbeatTimeoutJobId(monitorId: string): string {
  return `heartbeat-timeout:${monitorId}`;
}

export function getHeartbeatTimeoutDelayMs(
  intervalSeconds: number,
  timeoutMs: number,
): number {
  return intervalSeconds * 1000 + timeoutMs;
}

export function buildHeartbeatTimeoutPayload(params: {
  monitorId: string;
  intervalSeconds: number;
  timeoutMs: number;
  referenceTime: Date;
}): HeartbeatTimeoutJobPayload {
  const expectedBy = new Date(
    params.referenceTime.getTime() +
      getHeartbeatTimeoutDelayMs(params.intervalSeconds, params.timeoutMs),
  );

  return {
    monitorId: params.monitorId,
    expectedBy: expectedBy.toISOString(),
  };
}
