import type { UserPlan } from '@/types/auth'

export type AlertContactType = 'EMAIL' | 'SMS' | 'WEBHOOK'

export type AlertContact = {
  id: string
  userId: string
  type: AlertContactType
  value: string
  createdAt: string
}

export type AlertContactPayload = {
  type: AlertContactType
  value: string
}

export type AlertPlanLimit = {
  current: number
  max: number
  plan: UserPlan
}
