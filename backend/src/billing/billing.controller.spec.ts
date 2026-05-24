import { BadRequestException } from '@nestjs/common';
import { Plan } from '@prisma/client';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

describe('BillingController', () => {
  let billingController: BillingController;
  let billingService: jest.Mocked<BillingService>;

  beforeEach(() => {
    billingService = {
      listPlans: jest.fn().mockReturnValue({
        provider: 'DODO_PAYMENTS',
        currentPlan: Plan.FREE,
        plans: [],
      }),
      createCheckout: jest.fn().mockResolvedValue({
        provider: 'DODO_PAYMENTS',
        plan: Plan.PRO,
        sessionId: 'cks_123',
        checkoutUrl: 'https://test.checkout.dodopayments.com/session/cks_123',
      }),
      handleWebhook: jest.fn().mockResolvedValue({
        received: true,
        eventType: 'subscription.active',
        alreadyProcessed: false,
        planUpdated: true,
      }),
    } as unknown as jest.Mocked<BillingService>;

    billingController = new BillingController(billingService);
  });

  it('returns billing plans for the authenticated user', () => {
    const result = billingController.listPlans({
      id: 'user-1',
      email: 'john@uptimewatch.dev',
      plan: Plan.FREE,
      dodoCustomerId: null,
    });

    expect(result.provider).toBe('DODO_PAYMENTS');
    expect(billingService.listPlans).toHaveBeenCalled();
  });

  it('creates a checkout session for PRO upgrades', async () => {
    const result = await billingController.createCheckout(
      {
        id: 'user-1',
        email: 'john@uptimewatch.dev',
        plan: Plan.FREE,
        dodoCustomerId: null,
      },
      {
        plan: Plan.PRO,
      },
    );

    expect(result.plan).toBe(Plan.PRO);
    expect(billingService.createCheckout).toHaveBeenCalled();
  });

  it('rejects webhook requests missing required Dodo headers', () => {
    expect(() =>
      billingController.handleWebhook(
        {},
        {},
        undefined,
        undefined,
        undefined,
      ),
    ).toThrow(BadRequestException);
  });
});
