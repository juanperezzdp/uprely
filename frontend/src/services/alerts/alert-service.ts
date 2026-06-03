import { queryOptions } from '@tanstack/react-query'
import { apiClient } from '@/services/http/api-client'
import type { PaginatedResponse } from '@/types/monitor'
import type { AlertContact, AlertContactPayload } from '@/types/alert'

type AlertContactsParams = {
  limit?: number
  page?: number
}

export const alertQueryKeys = {
  all: ['alert-contacts'] as const,
  list: (params: AlertContactsParams) => [...alertQueryKeys.all, 'list', params] as const,
  detail: (alertContactId: string) => [...alertQueryKeys.all, 'detail', alertContactId] as const,
}

export const alertService = {
  listAlertContacts(params: AlertContactsParams): Promise<PaginatedResponse<AlertContact>> {
    const searchParams = new URLSearchParams({
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 20),
    })

    return apiClient<PaginatedResponse<AlertContact>>(
      `/alert-contacts?${searchParams.toString()}`,
    )
  },

  getAlertContact(alertContactId: string): Promise<AlertContact> {
    return apiClient<AlertContact>(`/alert-contacts/${alertContactId}`)
  },

  createAlertContact(payload: AlertContactPayload): Promise<AlertContact> {
    return apiClient<AlertContact>('/alert-contacts', {
      method: 'POST',
      body: payload,
    })
  },

  updateAlertContact(
    alertContactId: string,
    payload: Partial<AlertContactPayload>,
  ): Promise<AlertContact> {
    return apiClient<AlertContact>(`/alert-contacts/${alertContactId}`, {
      method: 'PUT',
      body: payload,
    })
  },

  deleteAlertContact(alertContactId: string): Promise<{ message: string }> {
    return apiClient<{ message: string }>(`/alert-contacts/${alertContactId}`, {
      method: 'DELETE',
    })
  },
}

export function alertContactsQueryOptions(params: AlertContactsParams) {
  return queryOptions({
    queryKey: alertQueryKeys.list(params),
    queryFn: () => alertService.listAlertContacts(params),
    staleTime: 60_000,
  })
}
