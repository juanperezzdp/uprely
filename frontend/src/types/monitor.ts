export type MonitorType = 'HTTP' | 'TCP' | 'SSL' | 'KEYWORD' | 'HEARTBEAT'

export type RealtimeMonitorStatus = 'UP' | 'DOWN' | 'UNKNOWN'

export type DashboardMonitorStatus = 'UP' | 'DOWN' | 'CHECKING'

export type PaginatedMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type PaginatedResponse<TItem> = {
  items: TItem[]
  meta: PaginatedMeta
}

export type Monitor = {
  id: string
  userId: string
  name: string
  url: string | null
  type: MonitorType
  intervalSeconds: number
  timeoutMs: number
  isActive: boolean
  keywordExpected: string | null
  keywordMustExist: boolean | null
  consecutiveFailuresThreshold: number
  heartbeatToken: string | null
  lastCheckedAt: string | null
  createdAt: string
  updatedAt: string
}

export type CheckResult = {
  id: string
  monitorId: string
  checkedAt: string
  statusCode: number | null
  latencyMs: number | null
  isUp: boolean
  error: string | null
  keywordFound: boolean | null
  createdAt: string
}

export type MonitorStats = {
  monitorId: string
  currentStatus: RealtimeMonitorStatus
  totalChecks: number
  upChecks: number
  downChecks: number
  uptimePercentage: number | null
  averageLatencyMs: number | null
  latestCheckAt: string | null
  totalIncidents: number
}

export type MonitorStatusSnapshotItem = {
  monitorId: string
  monitorName: string
  monitorType: MonitorType
  isActive: boolean
  status: RealtimeMonitorStatus
  incidentId: string | null
  cause: string | null
  changedAt: string | null
  lastCheckedAt: string | null
}

export type MonitorStatusSnapshotEvent = {
  monitors: MonitorStatusSnapshotItem[]
}

export type MonitorStatusChangeEvent = {
  userId: string
  monitorId: string
  monitorName: string
  monitorType: MonitorType
  status: Exclude<RealtimeMonitorStatus, 'UNKNOWN'>
  incidentId: string | null
  cause: string | null
  changedAt: string
}

export type MonitorRealtimeState = Record<string, MonitorStatusSnapshotItem>

export type IncidentStatus = 'OPEN' | 'RESOLVED'

export type IncidentDetail = {
  id: string
  monitorId: string
  startedAt: string
  confirmedAt: string | null
  resolvedAt: string | null
  cause: string
  createdAt: string
  status: IncidentStatus
}

export type AnalyticsTimeRange = '24H' | '7D' | '30D' | '90D'
