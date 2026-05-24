import { Injectable } from '@nestjs/common';
import { Prisma, type BillingWebhookEvent } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BillingRepository {
  constructor(private readonly prismaService: PrismaService) {}

  findProcessedWebhookById(
    webhookId: string,
  ): Promise<BillingWebhookEvent | null> {
    return this.prismaService.billingWebhookEvent.findUnique({
      where: {
        webhookId,
      },
    });
  }

  createProcessedWebhookEvent(params: {
    webhookId: string;
    eventType: string;
    payload: Prisma.InputJsonValue;
    processedAt: Date;
  }): Promise<BillingWebhookEvent> {
    return this.prismaService.billingWebhookEvent.create({
      data: {
        webhookId: params.webhookId,
        eventType: params.eventType,
        payload: params.payload,
        processedAt: params.processedAt,
      },
    });
  }
}
