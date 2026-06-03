import type {
  DashboardMonitorStatus,
  Monitor,
  RealtimeMonitorStatus,
} from '@/types/monitor'

export function toDashboardMonitorStatus(
  status: RealtimeMonitorStatus | undefined,
): DashboardMonitorStatus {
  if (status === 'UP' || status === 'DOWN') {
    return status
  }

  return 'CHECKING'
}

export function formatMonitorTarget(monitor: Monitor): string {
  if (monitor.type === 'HEARTBEAT') {
    return monitor.heartbeatToken
      ? `/heartbeat/${monitor.heartbeatToken}/ping`
      : 'Awaiting heartbeat token'
  }

  return monitor.url ?? 'No target configured'
}

export function formatUptime(value: number | null): string {
  if (value === null) {
    return '--'
  }

  return `${value.toFixed(2)}%`
}

export function formatLatency(value: number | null): string {
  if (value === null) {
    return '--'
  }

  return `${Math.round(value)} ms`
}

export function formatLastCheck(value: string | null): string {
  if (!value) {
    return 'Waiting for first check'
  }

  const date = new Date(value)
  const deltaMs = date.getTime() - Date.now()
  const absoluteDeltaMs = Math.abs(deltaMs)
  const minuteMs = 60_000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs
  const formatter = new Intl.RelativeTimeFormat('en', {
    numeric: 'auto',
  })

  if (absoluteDeltaMs < hourMs) {
    return formatter.format(Math.round(deltaMs / minuteMs), 'minute')
  }

  if (absoluteDeltaMs < dayMs) {
    return formatter.format(Math.round(deltaMs / hourMs), 'hour')
  }

  return formatter.format(Math.round(deltaMs / dayMs), 'day')
}
