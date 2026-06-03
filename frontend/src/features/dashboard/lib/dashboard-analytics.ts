import type {
  AnalyticsTimeRange,
  CheckResult,
  DashboardMonitorStatus,
  IncidentDetail,
} from '@/types/monitor'

export type HistoryPoint = {
  timestamp: string
  label: string
  uptime: number
  latency: number | null
  status: 'UP' | 'DOWN'
}

export type HistoryStats = {
  averageLatencyMs: number | null
  minimumLatencyMs: number | null
  maximumLatencyMs: number | null
  uptimePercentage: number
}

export type FleetMetrics = {
  globalUptime: number
  activeMonitors: number
  downMonitors: number
  totalIncidents: number
}

export function buildHistorySeries(checks: CheckResult[]): HistoryPoint[] {
  return checks.map((check) => ({
    timestamp: check.checkedAt,
    label: formatChartLabel(check.checkedAt),
    uptime: check.isUp ? 100 : 0,
    latency: check.latencyMs,
    status: check.isUp ? 'UP' : 'DOWN',
  }))
}

export function buildHistoryStats(checks: CheckResult[]): HistoryStats {
  const latencies = checks
    .map((check) => check.latencyMs)
    .filter((latency): latency is number => latency !== null)
  const upChecks = checks.filter((check) => check.isUp).length

  return {
    averageLatencyMs: latencies.length > 0 ? round(sum(latencies) / latencies.length) : null,
    minimumLatencyMs: latencies.length > 0 ? Math.min(...latencies) : null,
    maximumLatencyMs: latencies.length > 0 ? Math.max(...latencies) : null,
    uptimePercentage:
      checks.length > 0 ? round((upChecks / checks.length) * 100, 2) : 0,
  }
}

export function buildFleetMetrics(params: {
  rows: Array<{
    isActive: boolean
    status: DashboardMonitorStatus
    uptimePercentage: number | null
  }>
  incidents: IncidentDetail[]
}): FleetMetrics {
  const activeMonitors = params.rows.filter((row) => row.isActive).length
  const downMonitors = params.rows.filter((row) => row.status === 'DOWN').length
  const uptimeValues = params.rows
    .map((row) => row.uptimePercentage)
    .filter((value): value is number => value !== null)

  return {
    globalUptime:
      uptimeValues.length > 0 ? round(sum(uptimeValues) / uptimeValues.length, 2) : 0,
    activeMonitors,
    downMonitors,
    totalIncidents: params.incidents.length,
  }
}

export function buildTimeRangeLabel(range: AnalyticsTimeRange): string {
  switch (range) {
    case '24H':
      return 'Last 24 hours'
    case '7D':
      return 'Last 7 days'
    case '30D':
      return 'Last 30 days'
    case '90D':
      return 'Last 90 days'
  }
}

export function getIncidentDurationLabel(incident: IncidentDetail): string {
  const startedAt = new Date(incident.startedAt).getTime()
  const endedAt = new Date(incident.resolvedAt ?? Date.now()).getTime()
  const totalMinutes = Math.max(1, Math.round((endedAt - startedAt) / 60_000))

  if (totalMinutes < 60) {
    return `${totalMinutes} min`
  }

  const hours = totalMinutes / 60

  if (hours < 24) {
    return `${round(hours, 1)} h`
  }

  return `${round(hours / 24, 1)} d`
}

function formatChartLabel(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function round(value: number, digits = 0): number {
  const factor = 10 ** digits

  return Math.round(value * factor) / factor
}
