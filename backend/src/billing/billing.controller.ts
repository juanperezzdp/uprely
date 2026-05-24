import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

interface BillingWebhookRequest extends Request {
  rawBody?: Buffer;
}

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({
    description: 'List available billing plans for the authenticated user',
  })
  @ApiOperation({
    summary: 'List billing plans',
  })
  listPlans(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.listPlans(user);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOkResponse({
    description: 'Create a Dodo Payments checkout session',
  })
  @ApiOperation({
    summary: 'Create a checkout session for a billing plan',
  })
  createCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.billingService.createCheckout(user, dto);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
    },
  })
  @ApiOkResponse({
    description: 'Receive and process Dodo Payments webhooks',
  })
  @ApiOperation({
    summary: 'Receive Dodo Payments webhooks',
  })
  handleWebhook(
    @Req() request: BillingWebhookRequest,
    @Body() payload: Record<string, unknown>,
    @Headers('webhook-id') webhookId: string | undefined,
    @Headers('webhook-signature') webhookSignature: string | undefined,
    @Headers('webhook-timestamp') webhookTimestamp: string | undefined,
  ) {
    if (!webhookId || !webhookSignature || !webhookTimestamp) {
      throw new BadRequestException('Missing Dodo Payments webhook headers');
    }

    const rawBody =
      request.rawBody?.toString('utf8') ?? JSON.stringify(payload);

    return this.billingService.handleWebhook({
      rawBody,
      headers: {
        webhookId,
        webhookSignature,
        webhookTimestamp,
      },
    });
  }
}
