import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Plan, type User } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { EnvironmentVariables } from '../config/env.schema';
import { UsersService } from '../users/users.service';
import { BillingService } from './billing.service';
import { DodoPaymentsService } from './dodo-payments.service';
import { BillingRepository } from './repositories/billing.repository';

describe('BillingService', () => {
  let billingService: BillingService;
  let billingRepository: jest.Mocked<BillingRepository>;
  let dodoPaymentsService: jest.Mocked<DodoPaymentsService>;
  let usersService: jest.Mocked<UsersService>;
  let configService: jest.Mocked<ConfigService<EnvironmentVariables, true>>;

  const currentUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'john@uptimewatch.dev',
    plan: Plan.FREE,
    dodoCustomerId: null,
  };

  const storedUser: User = {
    id: 'user-1',
    email: 'john@uptimewatch.dev',
    passwordHash: 'hashed',
    plan: Plan.FREE,
    dodoCustomerId: null,
    createdAt: new Date('2026-05-24T10:00:00.000Z'),
    updatedAt: new Date('2026-05-24T10:00:00.000Z'),
  };

  beforeEach(() => {
    billingRepository = {
      findProcessedWebhookById: jest.fn(),
      createProcessedWebhookEvent: jest.fn(),
    } as unknown as jest.Mocked<BillingRepository>;

    dodoPaymentsService = {
      createCheckoutSession: jest.fn(),
      verifyAndParseWebhook: jest.fn(),
    } as unknown as jest.Mocked<DodoPaymentsService>;

    usersService = {
      updatePlanForBilling: jest.fn(),
      findUserEntityById: jest.fn(),
      findUserEntityByEmail: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    configService = {
      getOrThrow: jest.fn((key: keyof EnvironmentVariables) => {
        switch (key) {
          case 'DODO_PAYMENTS_PRO_PRODUCT_ID':
            return 'pdt_pro';
          case 'DODO_PAYMENTS_RETURN_URL':
            return 'http://localhost:5173/billing';
          default:
            throw new Error(`Unexpected config key: ${key}`);
        }
      }),
    } as unknown as jest.Mocked<ConfigService<EnvironmentVariables, true>>;

    billingService = new BillingService(
      billingRepository,
      dodoPaymentsService,
      usersService,
      configService,
    );
  });

  it('lists available plans for the authenticated user', () => {
    const result = billingService.listPlans(currentUser);

    expect(result.currentPlan).toBe(Plan.FREE);
    expect(result.plans).toHaveLength(2);
    expect(result.plans.find((plan) => plan.plan === Plan.PRO)?.checkoutAvailable).toBe(
      true,
    );
  });

  it('rejects checkout creation for unsupported plan targets', async () => {
    await expect(
      billingService.createCheckout(currentUser, {
        plan: Plan.FREE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a Dodo checkout session for upgrading to PRO', async () => {
    dodoPaymentsService.createCheckoutSession.mockResolvedValue({
      session_id: 'cks_123',
      checkout_url: 'https://test.checkout.dodopayments.com/session/cks_123',
    });

    const result = await billingService.createCheckout(currentUser, {
      plan: Plan.PRO,
    });

    expect(result.plan).toBe(Plan.PRO);
    expect(dodoPaymentsService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'pdt_pro',
        metadata: {
          userId: currentUser.id,
          targetPlan: Plan.PRO,
        },
      }),
    );
  });

  it('rejects checkout creation when the user is already on PRO', async () => {
    await expect(
      billingService.createCheckout(
        {
          ...currentUser,
          plan: Plan.PRO,
        },
        {
          plan: Plan.PRO,
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('ignores duplicate webhook deliveries using webhook-id idempotency', async () => {
    billingRepository.findProcessedWebhookById.mockResolvedValue({
      id: 'billing-webhook-event-1',
      webhookId: 'wh_123',
      eventType: 'subscription.active',
      payload: {},
      processedAt: new Date('2026-05-24T10:00:00.000Z'),
      createdAt: new Date('2026-05-24T10:00:00.000Z'),
    });
    dodoPaymentsService.verifyAndParseWebhook.mockResolvedValue({
      business_id: 'bus_123',
      type: 'subscription.active',
      timestamp: '2026-05-24T10:00:00.000Z',
      data: {
        payload_type: 'Subscription',
        product_id: 'pdt_pro',
        status: 'active',
      },
    });

    const result = await billingService.handleWebhook({
      rawBody: '{}',
      headers: {
        webhookId: 'wh_123',
        webhookSignature: 'sig',
        webhookTimestamp: '1716544800',
      },
    });

    expect(result.alreadyProcessed).toBe(true);
    expect(usersService.updatePlanForBilling).not.toHaveBeenCalled();
  });

  it('upgrades the user to PRO when a valid subscription activation webhook is received', async () => {
    billingRepository.findProcessedWebhookById.mockResolvedValue(null);
    dodoPaymentsService.verifyAndParseWebhook.mockResolvedValue({
      business_id: 'bus_123',
      type: 'subscription.active',
      timestamp: '2026-05-24T10:00:00.000Z',
      data: {
        payload_type: 'Subscription',
        product_id: 'pdt_pro',
        status: 'active',
        customer: {
          customer_id: 'cus_123',
          email: currentUser.email,
          name: 'John',
        },
        metadata: {
          userId: currentUser.id,
          targetPlan: Plan.PRO,
        },
      },
    });
    usersService.findUserEntityById.mockResolvedValue(storedUser);
    usersService.updatePlanForBilling.mockResolvedValue({
      ...currentUser,
      plan: Plan.PRO,
      dodoCustomerId: 'cus_123',
    });
    billingRepository.createProcessedWebhookEvent.mockResolvedValue({
      id: 'billing-webhook-event-1',
      webhookId: 'wh_123',
      eventType: 'subscription.active',
      payload: {},
      processedAt: new Date('2026-05-24T10:00:00.000Z'),
      createdAt: new Date('2026-05-24T10:00:00.000Z'),
    });

    const result = await billingService.handleWebhook({
      rawBody: '{"type":"subscription.active"}',
      headers: {
        webhookId: 'wh_123',
        webhookSignature: 'sig',
        webhookTimestamp: '1716544800',
      },
    });

    expect(result.planUpdated).toBe(true);
    expect(usersService.updatePlanForBilling).toHaveBeenCalledWith({
      userId: currentUser.id,
      plan: Plan.PRO,
      dodoCustomerId: 'cus_123',
    });
    expect(billingRepository.createProcessedWebhookEvent).toHaveBeenCalled();
  });

  it('acknowledges irrelevant webhook events without updating plans', async () => {
    billingRepository.findProcessedWebhookById.mockResolvedValue(null);
    dodoPaymentsService.verifyAndParseWebhook.mockResolvedValue({
      business_id: 'bus_123',
      type: 'payment.succeeded',
      timestamp: '2026-05-24T10:00:00.000Z',
      data: {
        payload_type: 'Payment',
      },
    });
    billingRepository.createProcessedWebhookEvent.mockResolvedValue({
      id: 'billing-webhook-event-1',
      webhookId: 'wh_123',
      eventType: 'payment.succeeded',
      payload: {},
      processedAt: new Date('2026-05-24T10:00:00.000Z'),
      createdAt: new Date('2026-05-24T10:00:00.000Z'),
    });

    const result = await billingService.handleWebhook({
      rawBody: '{"type":"payment.succeeded"}',
      headers: {
        webhookId: 'wh_123',
        webhookSignature: 'sig',
        webhookTimestamp: '1716544800',
      },
    });

    expect(result.planUpdated).toBe(false);
    expect(usersService.updatePlanForBilling).not.toHaveBeenCalled();
  });
});
