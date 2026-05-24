import { AlertContactType, MonitorType } from '@prisma/client';

export enum AlertEventType {
  MONITOR_DOWN = 'MONITOR_DOWN',
  MONITOR_RECOVERED = 'MONITOR_RECOVERED',
}

export interface AlertContactJobTarget {
  id: string;
  type: AlertContactType;
  value: string;
}

export interface AlertJobPayload {
  eventType: AlertEventType;
  userId: string;
  incidentId: string;
  monitorId: string;
  monitorName: string;
  monitorType: MonitorType;
  monitorUrl: string | null;
  cause: string;
  startedAt: string;
  resolvedAt: string | null;
  contacts: AlertContactJobTarget[];
}
