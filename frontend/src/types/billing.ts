import type { UserPlan } from '@/types/auth'

export type BillingProvider = 'DODO_PAYMENTS'

export type BillingPlan = {
  plan: UserPlan
  displayName: string
  limits: {
    maxMonitors: number
    minMonitorIntervalSeconds: number
    maxAlertContacts: number
  }
  isCurrent: boolean
  checkoutAvailable: boolean
}

export type BillingPlansResponse = {
  provider: BillingProvider
  currentPlan: UserPlan
  plans: BillingPlan[]
}

export type BillingCheckoutPayload = {
  plan: Extract<UserPlan, 'PRO'>
}

export type BillingCheckoutResponse = {
  provider: BillingProvider
  plan: UserPlan
  sessionId: string
  checkoutUrl: string
}
