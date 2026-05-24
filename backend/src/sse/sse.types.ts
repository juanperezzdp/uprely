import { MonitorType } from '@prisma/client';

export type RealtimeMonitorStatus = 'UP' | 'DOWN' | 'UNKNOWN';

export interface MonitorStatusSnapshotItem {
  monitorId: string;
  monitorName: string;
  monitorType: MonitorType;
  isActive: boolean;
  status: RealtimeMonitorStatus;
  incidentId: string | null;
  cause: string | null;
  changedAt: string | null;
  lastCheckedAt: string | null;
}

export interface MonitorStatusChangeEvent {
  userId: string;
  monitorId: string;
  monitorName: string;
  monitorType: MonitorType;
  status: Exclude<RealtimeMonitorStatus, 'UNKNOWN'>;
  incidentId: string | null;
  cause: string | null;
  changedAt: string;
}
