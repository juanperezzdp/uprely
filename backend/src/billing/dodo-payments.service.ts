import {
  BadGatewayException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request } from 'undici';
import { Webhook } from 'standardwebhooks';
import type { EnvironmentVariables } from '../config/env.schema';
import {
  billingWebhookPayloadSchema,
  dodoCheckoutSessionResponseSchema,
  type BillingWebhookPayload,
  type DodoCheckoutSessionResponse,
  type DodoWebhookHeaders,
} from './billing.types';

@Injectable()
export class DodoPaymentsService {
  private readonly webhookVerifier: Webhook;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.webhookVerifier = new Webhook(
      this.normalizeWebhookKey(
        this.configService.getOrThrow('DODO_PAYMENTS_WEBHOOK_KEY', {
          infer: true,
        }),
      ),
    );
  }

  async createCheckoutSession(params: {
    customer:
      | {
          customer_id: string;
        }
      | {
          email: string;
          name: string;
        };
    productId: string;
    returnUrl: string;
    metadata: Record<string, string>;
  }): Promise<DodoCheckoutSessionResponse> {
    const response = await request(`${this.getApiBaseUrl()}/checkouts`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.configService.getOrThrow(
          'DODO_PAYMENTS_API_KEY',
          {
            infer: true,
          },
        )}`,
      },
      body: JSON.stringify({
        product_cart: [
          {
            product_id: params.productId,
            quantity: 1,
          },
        ],
        customer: params.customer,
        return_url: params.returnUrl,
        metadata: params.metadata,
      }),
    });
    const responseBody = await response.body.text();
    const parsedBody = responseBody.length > 0 ? JSON.parse(responseBody) : {};

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new BadGatewayException({
        message: 'Failed to create Dodo Payments checkout session',
        statusCode: response.statusCode,
        providerResponse: parsedBody,
      });
    }

    return dodoCheckoutSessionResponseSchema.parse(parsedBody);
  }

  async verifyAndParseWebhook(params: {
    rawBody: string;
    headers: DodoWebhookHeaders;
  }): Promise<BillingWebhookPayload> {
    try {
      await this.webhookVerifier.verify(params.rawBody, {
        'webhook-id': params.headers.webhookId,
        'webhook-signature': params.headers.webhookSignature,
        'webhook-timestamp': params.headers.webhookTimestamp,
      });
    } catch {
      throw new UnauthorizedException('Invalid Dodo Payments webhook signature');
    }

    return billingWebhookPayloadSchema.parse(JSON.parse(params.rawBody));
  }

  private getApiBaseUrl(): string {
    const environment = this.configService.getOrThrow(
      'DODO_PAYMENTS_ENVIRONMENT',
      {
        infer: true,
      },
    );

    return environment === 'test_mode'
      ? 'https://test.dodopayments.com'
      : 'https://live.dodopayments.com';
  }

  private normalizeWebhookKey(value: string): string {
    return value.startsWith('whsec_') ? value.slice('whsec_'.length) : value;
  }
}
