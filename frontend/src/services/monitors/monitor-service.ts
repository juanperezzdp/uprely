import {
  queryOptions,
} from '@tanstack/react-query'
import { apiClient } from '@/services/http/api-client'
import type {
  AnalyticsTimeRange,
  CheckResult,
  IncidentDetail,
  Monitor,
  MonitorStats,
  PaginatedResponse,
} from '@/types/monitor'

const MONITORS_PAGE_SIZE = 100
const HISTORY_PAGE_SIZE = 100
const HISTORY_MAX_PAGES = 10

export const monitorQueryKeys = {
  all: ['monitors'] as const,
  list: () => [...monitorQueryKeys.all, 'list'] as const,
  stats: (monitorId: string) => [...monitorQueryKeys.all, 'stats', monitorId] as const,
  checks: (monitorId: string, range: AnalyticsTimeRange) =>
    [...monitorQueryKeys.all, 'checks', monitorId, range] as const,
  incidents: (monitorId: string, range: AnalyticsTimeRange) =>
    [...monitorQueryKeys.all, 'incidents', monitorId, range] as const,
  fleetIncidents: (range: AnalyticsTimeRange) =>
    [...monitorQueryKeys.all, 'fleet-incidents', range] as const,
  realtime: () => [...monitorQueryKeys.all, 'realtime'] as const,
}

type ListMonitorsParams = {
  page: number
  limit?: number
}

export type CreateMonitorPayload = {
  name: string
  type: Monitor['type']
  url?: string
  intervalSeconds: number
  timeoutMs?: number
  isActive?: boolean
  keywordExpected?: string
  keywordMustExist?: boolean
  consecutiveFailuresThreshold?: number
}

export type UpdateMonitorPayload = Partial<CreateMonitorPayload>

export type RestartMonitorResponse = {
  message: string
}

export type DeleteMonitorResponse = {
  message: string
}

export const monitorService = {
  listMonitors({
    page,
    limit = MONITORS_PAGE_SIZE,
  }: ListMonitorsParams): Promise<PaginatedResponse<Monitor>> {
    const searchParams = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    })

    return apiClient<PaginatedResponse<Monitor>>(`/monitors?${searchParams.toString()}`)
  },

  createMonitor(payload: CreateMonitorPayload): Promise<Monitor> {
    return apiClient<Monitor>('/monitors', {
      method: 'POST',
      body: payload,
    })
  },

  updateMonitor(monitorId: string, payload: UpdateMonitorPayload): Promise<Monitor> {
    return apiClient<Monitor>(`/monitors/${monitorId}`, {
      method: 'PUT',
      body: payload,
    })
  },

  restartMonitor(monitorId: string): Promise<RestartMonitorResponse> {
    return apiClient<RestartMonitorResponse>(`/monitors/${monitorId}/restart`, {
      method: 'POST',
    })
  },

  deleteMonitor(monitorId: string): Promise<DeleteMonitorResponse> {
    return apiClient<DeleteMonitorResponse>(`/monitors/${monitorId}`, {
      method: 'DELETE',
    })
  },

  getMonitorStats(monitorId: string): Promise<MonitorStats> {
    return apiClient<MonitorStats>(`/monitors/${monitorId}/stats`)
  },

  getMonitor(monitorId: string): Promise<Monitor> {
    return apiClient<Monitor>(`/monitors/${monitorId}`)
  },

  getMonitorChecksPage(params: {
    monitorId: string
    page?: number
    limit?: number
  }): Promise<PaginatedResponse<CheckResult>> {
    const searchParams = new URLSearchParams({
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 20),
    })

    return apiClient<PaginatedResponse<CheckResult>>(
      `/monitors/${params.monitorId}/checks?${searchParams.toString()}`,
    )
  },

  getMonitorIncidentsPage(params: {
    monitorId: string
    page?: number
    limit?: number
  }): Promise<PaginatedResponse<IncidentDetail>> {
    const searchParams = new URLSearchParams({
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 20),
    })

    return apiClient<PaginatedResponse<IncidentDetail>>(
      `/monitors/${params.monitorId}/incidents?${searchParams.toString()}`,
    )
  },

  async getMonitorChecksHistory(
    monitorId: string,
    range: AnalyticsTimeRange,
  ): Promise<CheckResult[]> {
    const startDate = getRangeStartDate(range)
    const items = await collectPaginatedWindow<CheckResult>({
      loadPage: (page) =>
        apiClient<PaginatedResponse<CheckResult>>(
          `/monitors/${monitorId}/checks?page=${page}&limit=${HISTORY_PAGE_SIZE}`,
        ),
      getCursorDate: (item) => item.checkedAt,
      startDate,
    })

    return items
      .filter((item) => new Date(item.checkedAt).getTime() >= startDate.getTime())
      .sort((left, right) => left.checkedAt.localeCompare(right.checkedAt))
  },

  async getMonitorIncidentsHistory(
    monitorId: string,
    range: AnalyticsTimeRange,
  ): Promise<IncidentDetail[]> {
    const startDate = getRangeStartDate(range)
    const endDate = new Date()
    const searchParams = new URLSearchParams({
      monitorId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    })

    const items = await collectPaginatedWindow<IncidentDetail>({
      loadPage: (page) =>
        apiClient<PaginatedResponse<IncidentDetail>>(
          `/incidents?${searchParams.toString()}&page=${page}&limit=${HISTORY_PAGE_SIZE}`,
        ),
      getCursorDate: (item) => item.startedAt,
      startDate,
    })

    return items.sort((left, right) => left.startedAt.localeCompare(right.startedAt))
  },

  async getFleetIncidentsHistory(range: AnalyticsTimeRange): Promise<IncidentDetail[]> {
    const startDate = getRangeStartDate(range)
    const endDate = new Date()
    const searchParams = new URLSearchParams({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    })

    const items = await collectPaginatedWindow<IncidentDetail>({
      loadPage: (page) =>
        apiClient<PaginatedResponse<IncidentDetail>>(
          `/incidents?${searchParams.toString()}&page=${page}&limit=${HISTORY_PAGE_SIZE}`,
        ),
      getCursorDate: (item) => item.startedAt,
      startDate,
    })

    return items.sort((left, right) => left.startedAt.localeCompare(right.startedAt))
  },
}

export function monitorsQueryOptions() {
  return queryOptions({
    queryKey: monitorQueryKeys.list(),
    queryFn: async () => {
      const pages = await Promise.all(
        Array.from({ length: HISTORY_MAX_PAGES }, (_, index) =>
          monitorService.listMonitors({
            page: index + 1,
          }),
        ),
      )
      const loadedPages = pages.filter((page, index) => index < page.meta.totalPages)

      return {
        items: loadedPages.flatMap((page) => page.items),
        meta: loadedPages.at(-1)?.meta ?? {
          page: 1,
          limit: MONITORS_PAGE_SIZE,
          total: 0,
          totalPages: 0,
        },
      } satisfies PaginatedResponse<Monitor>
    },
    staleTime: 60_000,
  })
}

export function monitorStatsQueryOptions(monitorId: string) {
  return queryOptions({
    queryKey: monitorQueryKeys.stats(monitorId),
    queryFn: () => monitorService.getMonitorStats(monitorId),
    staleTime: 60_000,
  })
}

export function monitorDetailQueryOptions(monitorId: string) {
  return queryOptions({
    queryKey: [...monitorQueryKeys.all, 'detail', monitorId] as const,
    queryFn: () => monitorService.getMonitor(monitorId),
    staleTime: 60_000,
  })
}

export function monitorChecksPageQueryOptions(params: {
  monitorId: string
  page?: number
  limit?: number
}) {
  return queryOptions({
    queryKey: [
      ...monitorQueryKeys.all,
      'checks-page',
      params.monitorId,
      params.page ?? 1,
      params.limit ?? 20,
    ] as const,
    queryFn: () => monitorService.getMonitorChecksPage(params),
    staleTime: 60_000,
  })
}

export function monitorIncidentsPageQueryOptions(params: {
  monitorId: string
  page?: number
  limit?: number
}) {
  return queryOptions({
    queryKey: [
      ...monitorQueryKeys.all,
      'incidents-page',
      params.monitorId,
      params.page ?? 1,
      params.limit ?? 20,
    ] as const,
    queryFn: () => monitorService.getMonitorIncidentsPage(params),
    staleTime: 60_000,
  })
}

export function monitorChecksQueryOptions(
  monitorId: string,
  range: AnalyticsTimeRange,
) {
  return queryOptions({
    queryKey: monitorQueryKeys.checks(monitorId, range),
    queryFn: () => monitorService.getMonitorChecksHistory(monitorId, range),
    staleTime: 60_000,
  })
}

export function monitorIncidentsQueryOptions(
  monitorId: string,
  range: AnalyticsTimeRange,
) {
  return queryOptions({
    queryKey: monitorQueryKeys.incidents(monitorId, range),
    queryFn: () => monitorService.getMonitorIncidentsHistory(monitorId, range),
    staleTime: 60_000,
  })
}

export function fleetIncidentsQueryOptions(range: AnalyticsTimeRange) {
  return queryOptions({
    queryKey: monitorQueryKeys.fleetIncidents(range),
    queryFn: () => monitorService.getFleetIncidentsHistory(range),
    staleTime: 60_000,
  })
}

async function collectPaginatedWindow<TItem>(params: {
  loadPage: (page: number) => Promise<PaginatedResponse<TItem>>
  getCursorDate: (item: TItem) => string
  startDate: Date
}): Promise<TItem[]> {
  const items: TItem[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages && page <= HISTORY_MAX_PAGES) {
    const response = await params.loadPage(page)
    items.push(...response.items)
    totalPages = response.meta.totalPages

    const lastItem = response.items.at(-1)

    if (!lastItem) {
      break
    }

    if (new Date(params.getCursorDate(lastItem)).getTime() < params.startDate.getTime()) {
      break
    }

    page += 1
  }

  return items
}

export function getRangeStartDate(range: AnalyticsTimeRange): Date {
  const now = Date.now()
  const rangesInMs: Record<AnalyticsTimeRange, number> = {
    '24H': 24 * 60 * 60 * 1000,
    '7D': 7 * 24 * 60 * 60 * 1000,
    '30D': 30 * 24 * 60 * 60 * 1000,
    '90D': 90 * 24 * 60 * 60 * 1000,
  }

  return new Date(now - rangesInMs[range])
}
