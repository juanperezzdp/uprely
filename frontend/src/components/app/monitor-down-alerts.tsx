import { useRouter } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { buildApiUrl } from '@/services/http/api-client'
import type {
  MonitorStatusChangeEvent,
  MonitorStatusSnapshotEvent,
} from '@/types/monitor'

type MonitorDownAlertsProps = {
  enabled: boolean
}

export function MonitorDownAlerts({ enabled }: MonitorDownAlertsProps) {
  const router = useRouter()
  const seenEventsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled) {
      return
    }

    const eventSource = new EventSource(buildApiUrl('/sse/monitors'), {
      withCredentials: true,
    })

    const showDownAlert = ({
      cause,
      changedAt,
      monitorId,
      monitorName,
    }: {
      cause: string | null
      changedAt: string | null
      monitorId: string
      monitorName: string
    }) => {
      const eventKey = `${monitorId}:${changedAt ?? 'snapshot'}:DOWN`

      if (seenEventsRef.current.has(eventKey)) {
        return
      }

      seenEventsRef.current.add(eventKey)

      toast.error('Monitoring alert', {
        description: `${monitorName} is down. ${cause ?? 'Open the monitor details to review the incident.'}`,
        duration: 15000,
        action: {
          label: 'View details',
          onClick: () =>
            void router.navigate({
              to: '/monitors/$id',
              params: {
                id: monitorId,
              },
            }),
        },
      })
    }

    const handleSnapshot = (event: MessageEvent<string>) => {
      const payload = parseSsePayload<MonitorStatusSnapshotEvent>(event)

      if (!payload) {
        return
      }

      for (const monitor of payload.monitors) {
        if (monitor.status !== 'DOWN') {
          continue
        }

        showDownAlert({
          cause: monitor.cause,
          changedAt: monitor.changedAt,
          monitorId: monitor.monitorId,
          monitorName: monitor.monitorName,
        })
      }
    }

    const handleMonitorChange = (event: MessageEvent<string>) => {
      const payload = parseSsePayload<MonitorStatusChangeEvent>(event)

      if (!payload || payload.status !== 'DOWN') {
        return
      }

      showDownAlert({
        cause: payload.cause,
        changedAt: payload.changedAt,
        monitorId: payload.monitorId,
        monitorName: payload.monitorName,
      })
    }

    eventSource.addEventListener('snapshot', handleSnapshot as EventListener)
    eventSource.addEventListener(
      'monitor-status-changed',
      handleMonitorChange as EventListener,
    )

    return () => {
      eventSource.removeEventListener('snapshot', handleSnapshot as EventListener)
      eventSource.removeEventListener(
        'monitor-status-changed',
        handleMonitorChange as EventListener,
      )
      eventSource.close()
    }
  }, [enabled, router])

  return null
}

function parseSsePayload<TPayload>(event: MessageEvent<string>): TPayload | null {
  try {
    return JSON.parse(event.data) as TPayload
  } catch {
    return null
  }
}
