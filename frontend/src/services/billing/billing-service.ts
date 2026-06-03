import { queryOptions } from '@tanstack/react-query'
import { apiClient } from '@/services/http/api-client'
import type {
  BillingCheckoutPayload,
  BillingCheckoutResponse,
  BillingPlansResponse,
} from '@/types/billing'

export const billingQueryKeys = {
  all: ['billing'] as const,
  plans: () => [...billingQueryKeys.all, 'plans'] as const,
}

export const billingService = {
  listPlans(): Promise<BillingPlansResponse> {
    return apiClient<BillingPlansResponse>('/billing/plans')
  },

  createCheckout(payload: BillingCheckoutPayload): Promise<BillingCheckoutResponse> {
    return apiClient<BillingCheckoutResponse>('/billing/checkout', {
      method: 'POST',
      body: payload,
    })
  },
}

export function billingPlansQueryOptions() {
  return queryOptions({
    queryKey: billingQueryKeys.plans(),
    queryFn: () => billingService.listPlans(),
    staleTime: 60_000,
  })
}
