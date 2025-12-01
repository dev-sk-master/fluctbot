import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { StripeService } from './stripe/stripe.service';
import { StripeWebhookService } from './stripe/stripe-webhook.service';
import { PaymentAccountsService } from './services/payment-accounts.service';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { PaymentAccount } from './entities/payment-account.entity';
import { UsersModule } from '../users/users.module';
import { TelegramModule } from '../workflow/sources/telegram/telegram.module';
import { NgrokModule } from '../common/ngrok/ngrok.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, SubscriptionPlan, PaymentAccount]),
    UsersModule, // For UsersService (needed by PaymentAccountsService)
    TelegramModule, // For TelegramService
    NgrokModule, // For automatic ngrok webhook setup
  ],
  providers: [SubscriptionsService, StripeService, StripeWebhookService, PaymentAccountsService],
  controllers: [SubscriptionsController],
  exports: [SubscriptionsService, StripeService, PaymentAccountsService],
})
export class SubscriptionsModule {}

