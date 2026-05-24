import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Plan } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.schema';
import { UsersService } from '../users/users.service';
import { DodoPaymentsService } from './dodo-payments.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { BillingRepository } from './repositories/billing.repository';
import {
  asPrismaJson,
  buildBillingPlans,
  type BillingCheckoutResponse,
  type BillingPlansResponse,
  type BillingWebhookPayload,
  type BillingWebhookResponse,
  type DodoWebhookHeaders,
} from './billing.types';

const PRO_ACTIVATION_EVENTS = new Set([
  'subscription.active',
  'subscription.updated',
  'subscription.renewed',
  'subscription.plan_changed',
]);

@Injectable()
export class BillingService {
  constructor(
    private readonly billingRepository: BillingRepository,
    private readonly dodoPaymentsService: DodoPaymentsService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  listPlans(user: AuthenticatedUser): BillingPlansResponse {
    return {
      provider: 'DODO_PAYMENTS',
      currentPlan: user.plan,
      plans: buildBillingPlans(user.plan),
    };
  }

  async createCheckout(
    user: AuthenticatedUser,
    dto: CreateCheckoutDto,
  ): Promise<BillingCheckoutResponse> {
    if (dto.plan !== Plan.PRO) {
      throw new BadRequestException('Only PRO checkout is supported');
    }

    if (user.plan === Plan.PRO) {
      throw new ConflictException('User is already on the PRO plan');
    }

    const session = await this.dodoPaymentsService.createCheckoutSession({
      customer: user.dodoCustomerId
        ? {
            customer_id: user.dodoCustomerId,
          }
        : {
            email: user.email,
            name: this.deriveCustomerName(user.email),
          },
      productId: this.configService.getOrThrow('DODO_PAYMENTS_PRO_PRODUCT_ID', {
        infer: true,
      }),
      returnUrl: this.configService.getOrThrow('DODO_PAYMENTS_RETURN_URL', {
        infer: true,
      }),
      metadata: {
        userId: user.id,
        targetPlan: dto.plan,
      },
    });

    return {
      provider: 'DODO_PAYMENTS',
      plan: dto.plan,
      sessionId: session.session_id,
      checkoutUrl: session.checkout_url,
    };
  }

  async handleWebhook(params: {
    rawBody: string;
    headers: DodoWebhookHeaders;
  }): Promise<BillingWebhookResponse> {
    const payload = await this.dodoPaymentsService.verifyAndParseWebhook(params);
    const existingWebhook = await this.billingRepository.findProcessedWebhookById(
      params.headers.webhookId,
    );

    if (existingWebhook) {
      return {
        received: true,
        eventType: existingWebhook.eventType,
        alreadyProcessed: true,
        planUpdated: false,
      };
    }

    const planUpdated = await this.processWebhookPayload(payload);

    await this.billingRepository.createProcessedWebhookEvent({
      webhookId: params.headers.webhookId,
      eventType: payload.type,
      payload: asPrismaJson(payload),
      processedAt: new Date(),
    });

    return {
      received: true,
      eventType: payload.type,
      alreadyProcessed: false,
      planUpdated,
    };
  }

  private async processWebhookPayload(
    payload: BillingWebhookPayload,
  ): Promise<boolean> {
    if (!this.shouldActivateProPlan(payload)) {
      return false;
    }

    const user = await this.resolveUserForWebhook(payload);

    if (!user) {
      return false;
    }

    await this.usersService.updatePlanForBilling({
      userId: user.id,
      plan: Plan.PRO,
      dodoCustomerId: payload.data.customer?.customer_id ?? user.dodoCustomerId,
    });

    return true;
  }

  private shouldActivateProPlan(payload: BillingWebhookPayload): boolean {
    return (
      payload.data.payload_type === 'Subscription' &&
      PRO_ACTIVATION_EVENTS.has(payload.type) &&
      payload.data.product_id ===
        this.configService.getOrThrow('DODO_PAYMENTS_PRO_PRODUCT_ID', {
          infer: true,
        }) &&
      (payload.data.status === undefined || payload.data.status === 'active')
    );
  }

  private async resolveUserForWebhook(
    payload: BillingWebhookPayload,
  ): Promise<AuthenticatedUser | null> {
    const metadataUserId = payload.data.metadata?.userId;

    if (typeof metadataUserId === 'string' && metadataUserId.length > 0) {
      const user = await this.usersService.findUserEntityById(metadataUserId);

      return user
        ? {
            id: user.id,
            email: user.email,
            plan: user.plan,
            dodoCustomerId: user.dodoCustomerId,
          }
        : null;
    }

    const email = payload.data.customer?.email;

    if (!email) {
      return null;
    }

    const user = await this.usersService.findUserEntityByEmail(email);

    return user
      ? {
          id: user.id,
          email: user.email,
          plan: user.plan,
          dodoCustomerId: user.dodoCustomerId,
        }
      : null;
  }

  private deriveCustomerName(email: string): string {
    const localPart = email.split('@')[0]?.trim() ?? 'Customer';
    const normalized = localPart.replace(/[._-]+/g, ' ').trim();

    return normalized.length > 0 ? normalized : 'Customer';
  }
}
