import {
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { buildApiUrl } from '@/services/http/api-client'
import { monitorQueryKeys } from '@/services/monitors/monitor-service'
import type {
  Monitor,
  MonitorRealtimeState,
  MonitorStatusChangeEvent,
  MonitorStatusSnapshotEvent,
  PaginatedResponse,
} from '@/types/monitor'

type ConnectionState = 'connecting' | 'connected' | 'disconnected'

export type DashboardActivityItem = {
  id: string
  monitorId: string
  monitorName: string
  monitorType: MonitorStatusChangeEvent['monitorType']
  status: MonitorStatusChangeEvent['status']
  changedAt: string
  cause: string | null
}

type UseMonitorsRealtimeOptions = {
  enabled: boolean
}

export function useMonitorsRealtime({
  enabled,
}: UseMonitorsRealtimeOptions) {
  const queryClient = useQueryClient()
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [activities, setActivities] = useState<DashboardActivityItem[]>([])
  const realtimeStateQuery = useQuery({
    queryKey: monitorQueryKeys.realtime(),
    queryFn: async (): Promise<MonitorRealtimeState> => ({}),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  })

  useEffect(() => {
    if (!enabled) {
      return
    }

    const eventSource = new EventSource(buildApiUrl('/sse/monitors'), {
      withCredentials: true,
    })

    const handleOpen = () => {
      setConnectionState('connected')
    }

    const handleError = () => {
      setConnectionState('disconnected')
    }

    const handleSnapshot = (event: MessageEvent<string>) => {
      const payload = parseSsePayload<MonitorStatusSnapshotEvent>(event)

      if (!payload) {
        return
      }

      const nextState = Object.fromEntries(
        payload.monitors.map((monitor) => [monitor.monitorId, monitor]),
      ) satisfies MonitorRealtimeState

      queryClient.setQueryData(monitorQueryKeys.realtime(), nextState)
      queryClient.setQueryData(
        monitorQueryKeys.list(),
        (
          current:
            | PaginatedResponse<Monitor>
            | undefined,
        ) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            items: current.items.map((monitor) => {
              const snapshot = nextState[monitor.id]

              if (!snapshot) {
                return monitor
              }

              return {
                ...monitor,
                name: snapshot.monitorName,
                type: snapshot.monitorType,
                isActive: snapshot.isActive,
                lastCheckedAt: snapshot.lastCheckedAt,
              }
            }),
          }
        },
      )
    }

    const handleMonitorChange = (event: MessageEvent<string>) => {
      const payload = parseSsePayload<MonitorStatusChangeEvent>(event)

      if (!payload) {
        return
      }

      const currentState =
        queryClient.getQueryData<MonitorRealtimeState>(monitorQueryKeys.realtime()) ?? {}
      const previousMonitor = currentState[payload.monitorId]
      const nextMonitor = {
        monitorId: payload.monitorId,
        monitorName: payload.monitorName,
        monitorType: payload.monitorType,
        isActive: previousMonitor?.isActive ?? true,
        status: payload.status,
        incidentId: payload.incidentId,
        cause: payload.cause,
        changedAt: payload.changedAt,
        lastCheckedAt: payload.changedAt,
      }

      queryClient.setQueryData(
        monitorQueryKeys.realtime(),
        (current: MonitorRealtimeState | undefined) => ({
          ...(current ?? {}),
          [payload.monitorId]: nextMonitor,
        }),
      )
      queryClient.setQueryData(
        monitorQueryKeys.list(),
        (
          current:
            | PaginatedResponse<Monitor>
            | undefined,
        ) =>
          updateMonitorListItem(current, payload.monitorId, (monitor) => ({
            ...monitor,
            name: payload.monitorName,
            type: payload.monitorType,
            lastCheckedAt: payload.changedAt,
          })),
      )
      void queryClient.invalidateQueries({
        queryKey: monitorQueryKeys.stats(payload.monitorId),
      })

      setActivities((current) => [
        {
          id: `${payload.monitorId}:${payload.changedAt}`,
          monitorId: payload.monitorId,
          monitorName: payload.monitorName,
          monitorType: payload.monitorType,
          status: payload.status,
          changedAt: payload.changedAt,
          cause: payload.cause,
        },
        ...current,
      ].slice(0, 20))
    }

    eventSource.addEventListener('open', handleOpen)
    eventSource.addEventListener('error', handleError)
    eventSource.addEventListener('snapshot', handleSnapshot as EventListener)
    eventSource.addEventListener(
      'monitor-status-changed',
      handleMonitorChange as EventListener,
    )

    return () => {
      eventSource.removeEventListener('open', handleOpen)
      eventSource.removeEventListener('error', handleError)
      eventSource.removeEventListener('snapshot', handleSnapshot as EventListener)
      eventSource.removeEventListener(
        'monitor-status-changed',
        handleMonitorChange as EventListener,
      )
      eventSource.close()
    }
  }, [enabled, queryClient])

  return {
    connectionState: enabled ? connectionState : 'disconnected',
    activities,
    realtimeState: realtimeStateQuery.data ?? {},
  }
}

function parseSsePayload<TPayload>(event: MessageEvent<string>): TPayload | null {
  try {
    return JSON.parse(event.data) as TPayload
  } catch {
    return null
  }
}

function updateMonitorListItem(
  current: PaginatedResponse<Monitor> | undefined,
  monitorId: string,
  updater: (monitor: Monitor) => Monitor,
): PaginatedResponse<Monitor> | undefined {
  if (!current) {
    return current
  }

  return {
    ...current,
    items: current.items.map((monitor) =>
      monitor.id === monitorId ? updater(monitor) : monitor,
    ),
  }
}
