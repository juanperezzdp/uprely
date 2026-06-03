import { apiClient } from '@/services/http/api-client'
import type { HealthSummary } from '@/types/api'

export const healthService = {
  getSummary() {
    return apiClient<HealthSummary>('/health')
  },
}
