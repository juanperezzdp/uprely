import { cn } from '@/lib/cn'
import type { IncidentDetail } from '@/types/monitor'

export function formatIncidentDateTime(value: string | null): string {
  if (!value) {
    return '--'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function getIncidentDuration(incident: IncidentDetail): string {
  const startedAt = new Date(incident.startedAt).getTime()
  const endedAt = new Date(incident.resolvedAt ?? Date.now()).getTime()
  const diffMinutes = Math.max(1, Math.round((endedAt - startedAt) / 60_000))

  if (diffMinutes < 60) {
    return `${diffMinutes} min`
  }

  const diffHours = diffMinutes / 60

  if (diffHours < 24) {
    return `${diffHours.toFixed(1)} h`
  }

  return `${(diffHours / 24).toFixed(1)} d`
}

export function getIncidentStatusClasses(status: IncidentDetail['status']): string {
  return cn(
    'inline-flex items-center gap-2 rounded-sm px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em]',
    status === 'OPEN' ? 'bg-destructive/12 text-destructive' : 'bg-primary/12 text-primary',
  )
}
