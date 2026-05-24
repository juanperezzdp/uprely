import { Plan, Prisma } from '@prisma/client';
import { z } from 'zod';
import { PLAN_LIMITS } from '../users/constants/plan-limits';

const webhookMetadataValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const billingWebhookPayloadSchema = z.object({
  business_id: z.string(),
  type: z.string(),
  timestamp: z.string(),
  data: z.object({
    payload_type: z.string(),
    subscription_id: z.string().optional(),
    product_id: z.string().optional(),
    status: z.string().optional(),
    customer: z
      .object({
        customer_id: z.string().optional(),
        email: z.string().email().optional(),
        name: z.string().optional(),
      })
      .optional(),
    metadata: z.record(z.string(), webhookMetadataValueSchema).optional(),
  }),
});

export const dodoCheckoutSessionResponseSchema = z.object({
  session_id: z.string(),
  checkout_url: z.string().url(),
});

export type BillingWebhookPayload = z.infer<typeof billingWebhookPayloadSchema>;
export type DodoCheckoutSessionResponse = z.infer<
  typeof dodoCheckoutSessionResponseSchema
>;

export interface BillingPlanResponse {
  plan: Plan;
  displayName: string;
  limits: {
    maxMonitors: number;
    minMonitorIntervalSeconds: number;
    maxAlertContacts: number;
  };
  isCurrent: boolean;
  checkoutAvailable: boolean;
}

export interface BillingPlansResponse {
  provider: 'DODO_PAYMENTS';
  currentPlan: Plan;
  plans: BillingPlanResponse[];
}

export interface BillingCheckoutResponse {
  provider: 'DODO_PAYMENTS';
  plan: Plan;
  sessionId: string;
  checkoutUrl: string;
}

export interface BillingWebhookResponse {
  received: boolean;
  eventType: string;
  alreadyProcessed: boolean;
  planUpdated: boolean;
}

export interface DodoWebhookHeaders {
  webhookId: string;
  webhookSignature: string;
  webhookTimestamp: string;
}

export function buildBillingPlans(currentPlan: Plan): BillingPlanResponse[] {
  return [Plan.FREE, Plan.PRO].map((plan) => ({
    plan,
    displayName: plan,
    limits: PLAN_LIMITS[plan],
    isCurrent: currentPlan === plan,
    checkoutAvailable: plan === Plan.PRO,
  }));
}

export function asPrismaJson(
  value: BillingWebhookPayload,
): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
