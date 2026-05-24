import { Plan } from '@prisma/client';

export interface PlanLimits {
  maxMonitors: number;
  minMonitorIntervalSeconds: number;
  maxAlertContacts: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  [Plan.FREE]: {
    maxMonitors: 5,
    minMonitorIntervalSeconds: 300,
    maxAlertContacts: 1,
  },
  [Plan.PRO]: {
    maxMonitors: 50,
    minMonitorIntervalSeconds: 60,
    maxAlertContacts: 10,
  },
};
