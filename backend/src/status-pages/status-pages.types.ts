import { MonitorType } from '@prisma/client';

export type StatusPageMonitorStatus = 'UP' | 'DOWN' | 'UNKNOWN';
export type StatusPageOverallStatus =
  | 'OPERATIONAL'
  | 'DEGRADED'
  | 'OUTAGE'
  | 'UNKNOWN';

export interface StatusPageMonitorSummary {
  monitorId: string;
  name: string;
  type: MonitorType;
  isActive: boolean;
  status: StatusPageMonitorStatus;
  lastCheckedAt: string | null;
  cause: string | null;
  incidentId: string | null;
}

export interface StatusPageDetailResponse {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  overallStatus: StatusPageOverallStatus;
  createdAt: string;
  updatedAt: string;
  monitors: StatusPageMonitorSummary[];
}

export interface PublicStatusPageResponse {
  slug: string;
  name: string;
  description: string | null;
  overallStatus: StatusPageOverallStatus;
  monitors: StatusPageMonitorSummary[];
  updatedAt: string;
}
