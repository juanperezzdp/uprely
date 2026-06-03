import { queryOptions } from '@tanstack/react-query'
import { apiClient } from '@/services/http/api-client'
import type {
  IncidentDetail,
  IncidentStatus,
  PaginatedResponse,
} from '@/types/monitor'

type ListIncidentsParams = {
  endDate?: string
  limit?: number
  monitorId?: string
  page?: number
  startDate?: string
  status?: IncidentStatus
}

export const incidentQueryKeys = {
  all: ['incidents'] as const,
  list: (params: ListIncidentsParams) => [...incidentQueryKeys.all, 'list', params] as const,
  detail: (incidentId: string) => [...incidentQueryKeys.all, 'detail', incidentId] as const,
}

export const incidentService = {
  listIncidents(params: ListIncidentsParams): Promise<PaginatedResponse<IncidentDetail>> {
    const searchParams = new URLSearchParams({
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 10),
    })

    if (params.status) {
      searchParams.set('status', params.status)
    }

    if (params.startDate) {
      searchParams.set('startDate', params.startDate)
    }

    if (params.endDate) {
      searchParams.set('endDate', params.endDate)
    }

    if (params.monitorId) {
      searchParams.set('monitorId', params.monitorId)
    }

    return apiClient<PaginatedResponse<IncidentDetail>>(`/incidents?${searchParams.toString()}`)
  },

  getIncident(incidentId: string): Promise<IncidentDetail> {
    return apiClient<IncidentDetail>(`/incidents/${incidentId}`)
  },
}

export function incidentsListQueryOptions(params: ListIncidentsParams) {
  return queryOptions({
    queryKey: incidentQueryKeys.list(params),
    queryFn: () => incidentService.listIncidents(params),
    staleTime: 60_000,
  })
}

export function incidentDetailQueryOptions(incidentId: string) {
  return queryOptions({
    queryKey: incidentQueryKeys.detail(incidentId),
    queryFn: () => incidentService.getIncident(incidentId),
    staleTime: 60_000,
  })
}
