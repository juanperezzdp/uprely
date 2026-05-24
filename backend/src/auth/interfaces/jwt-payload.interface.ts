import type { Plan } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  plan: Plan;
}
