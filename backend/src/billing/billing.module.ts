import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { DodoPaymentsService } from './dodo-payments.service';
import { BillingRepository } from './repositories/billing.repository';

@Module({
  imports: [UsersModule],
  controllers: [BillingController],
  providers: [BillingRepository, DodoPaymentsService, BillingService],
  exports: [BillingService],
})
export class BillingModule {}
