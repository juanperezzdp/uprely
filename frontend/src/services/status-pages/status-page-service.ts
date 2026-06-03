import { queryOptions } from '@tanstack/react-query'
import { apiClient } from '@/services/http/api-client'
import type { PaginatedResponse } from '@/types/monitor'
import type {
  PublicStatusPage,
  StatusPage,
  StatusPagePayload,
} from '@/types/status-page'

type StatusPagesParams = {
  limit?: number
  page?: number
}

export const statusPageQueryKeys = {
  all: ['status-pages'] as const,
  list: (params: StatusPagesParams) => [...statusPageQueryKeys.all, 'list', params] as const,
  detail: (statusPageId: string) => [...statusPageQueryKeys.all, 'detail', statusPageId] as const,
  public: (slug: string) => [...statusPageQueryKeys.all, 'public', slug] as const,
}

export const statusPageService = {
  listStatusPages(params: StatusPagesParams): Promise<PaginatedResponse<StatusPage>> {
    const searchParams = new URLSearchParams({
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 20),
    })

    return apiClient<PaginatedResponse<StatusPage>>(
      `/status-pages?${searchParams.toString()}`,
    )
  },

  getStatusPage(statusPageId: string): Promise<StatusPage> {
    return apiClient<StatusPage>(`/status-pages/manage/${statusPageId}`)
  },

  createStatusPage(payload: StatusPagePayload): Promise<StatusPage> {
    return apiClient<StatusPage>('/status-pages', {
      method: 'POST',
      body: payload,
    })
  },

  updateStatusPage(statusPageId: string, payload: Partial<StatusPagePayload>): Promise<StatusPage> {
    return apiClient<StatusPage>(`/status-pages/${statusPageId}`, {
      method: 'PUT',
      body: payload,
    })
  },

  deleteStatusPage(statusPageId: string): Promise<{ message: string }> {
    return apiClient<{ message: string }>(`/status-pages/${statusPageId}`, {
      method: 'DELETE',
    })
  },

  getPublicStatusPage(slug: string): Promise<PublicStatusPage> {
    return apiClient<PublicStatusPage>(`/status-pages/${slug}`)
  },
}

export function statusPagesQueryOptions(params: StatusPagesParams) {
  return queryOptions({
    queryKey: statusPageQueryKeys.list(params),
    queryFn: () => statusPageService.listStatusPages(params),
    staleTime: 60_000,
  })
}

export function statusPageDetailQueryOptions(statusPageId: string) {
  return queryOptions({
    queryKey: statusPageQueryKeys.detail(statusPageId),
    queryFn: () => statusPageService.getStatusPage(statusPageId),
    staleTime: 60_000,
  })
}

export function publicStatusPageQueryOptions(slug: string) {
  return queryOptions({
    queryKey: statusPageQueryKeys.public(slug),
    queryFn: () => statusPageService.getPublicStatusPage(slug),
    staleTime: 60_000,
  })
}
