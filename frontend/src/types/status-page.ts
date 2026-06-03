import type { MonitorType } from '@/types/monitor'

export type StatusPageMonitorStatus = 'UP' | 'DOWN' | 'UNKNOWN'

export type StatusPageOverallStatus =
  | 'OPERATIONAL'
  | 'DEGRADED'
  | 'OUTAGE'
  | 'UNKNOWN'

export type StatusPageMonitorSummary = {
  monitorId: string
  name: string
  type: MonitorType
  isActive: boolean
  status: StatusPageMonitorStatus
  lastCheckedAt: string | null
  cause: string | null
  incidentId: string | null
}

export type StatusPage = {
  id: string
  slug: string
  name: string
  description: string | null
  isPublic: boolean
  overallStatus: StatusPageOverallStatus
  createdAt: string
  updatedAt: string
  monitors: StatusPageMonitorSummary[]
}

export type PublicStatusPage = {
  slug: string
  name: string
  description: string | null
  overallStatus: StatusPageOverallStatus
  monitors: StatusPageMonitorSummary[]
  updatedAt: string
}

export type StatusPagePayload = {
  slug: string
  name: string
  description?: string
  isPublic?: boolean
  monitorIds?: string[]
}
