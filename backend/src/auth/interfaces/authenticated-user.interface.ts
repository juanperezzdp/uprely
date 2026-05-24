import type { Plan } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  plan: Plan;
  dodoCustomerId: string | null;
}
