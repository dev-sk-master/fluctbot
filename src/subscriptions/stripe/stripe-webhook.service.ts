import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { SubscriptionsService } from '../subscriptions.service';
import { UsersService } from '../../users/users.service';
import { TelegramService } from '../../workflow/sources/telegram/telegram.service';
import { EmailService } from '../../common/services/email.service';
import { StripeService } from './stripe.service';
import { PaymentAccountsService } from '../services/payment-accounts.service';
import { PaymentProvider } from '../entities/payment-account.entity';
import { SubscriptionStatus } from '../entities/subscription.entity';
import { MessagePlatform, MessageType } from '../../workflow/types/message.types';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly usersService: UsersService,
    private readonly telegramService: TelegramService,
    private readonly emailService: EmailService,
    private readonly stripeService: StripeService,
    private readonly paymentAccountsService: PaymentAccountsService,
  ) {}

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    this.logger.debug(`Received Stripe webhook event: ${event.type}`);
console.log('handleWebhookEvent',JSON.stringify(event,null,2))
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event);
          break;

        default:
          this.logger.debug(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(
        `Error handling webhook event ${event.type}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Handle checkout.session.completed event
   * This is fired when a customer successfully completes a checkout session
   */
  private async handleCheckoutSessionCompleted(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;

    this.logger.log(`Checkout session completed: ${session.id}`);

    // Extract metadata
    const planCode = session.metadata?.plan_code;
    const userId = session.metadata?.user_id;
    const platformStr = session.metadata?.platform;
    const platformIdentifier = session.metadata?.platform_identifier;

    // Log metadata for debugging
    this.logger.debug(`Checkout session metadata: ${JSON.stringify(session.metadata, null, 2)}`);

    if (!planCode || !userId) {
      this.logger.warn(`Missing metadata in checkout session ${session.id}: plan_code or user_id`);
      return;
    }

    // Convert platform string to MessagePlatform enum
    let platform: MessagePlatform | undefined;
    if (platformStr) {
      // Normalize platform string to match enum values
      const normalizedPlatform = platformStr.toLowerCase();
      if (normalizedPlatform === 'telegram') {
        platform = MessagePlatform.TELEGRAM;
      } else if (normalizedPlatform === 'web_chat' || normalizedPlatform === 'webchat') {
        platform = MessagePlatform.WEB_CHAT;
      } else if (normalizedPlatform === 'whatsapp') {
        platform = MessagePlatform.WHATSAPP;
      } else {
        this.logger.warn(`Unknown platform value in metadata: ${platformStr}`);
      }
    }

    if (!platformIdentifier) {
      this.logger.warn(`Missing platform_identifier in checkout session ${session.id}`);
    }

    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum)) {
      this.logger.warn(`Invalid user_id in checkout session ${session.id}: ${userId}`);
      return;
    }

    // Get subscription ID from session
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

    try {
      // Get user details for email notification
      let user = null;
      try {
        user = await this.usersService.findOne(userIdNum);
      } catch (userError) {
        this.logger.warn(`User ${userIdNum} not found, skipping email notification`);
      }

      // Get plan details for email notification
      const plan = await this.subscriptionsService.getPlanByCode(planCode);
      const planName = plan?.name || planCode.toUpperCase();

      // Extract payment metadata: frequency and price_id
      // Get price_id from session metadata or subscription metadata
      const priceId = session.metadata?.price_id;
      
      // Determine frequency and amount from price_id by checking plan pricing
      let frequency: string | undefined;
      let amount: number | undefined;
      if (priceId && plan?.pricing) {
        // Check which pricing tier this price_id belongs to
        for (const [tierKey, tier] of Object.entries(plan.pricing)) {
          if (tier?.stripe_price_id === priceId) {
            frequency = tierKey; // 'daily', 'monthly', 'yearly', etc.
            amount = tier?.amount; // Get amount from pricing tier
            break;
          }
        }
      }

      // Build payment metadata (provider-agnostic)
      const paymentMetadata: Record<string, any> = {};
      if (priceId) {
        paymentMetadata.price_id = priceId;
      }
      if (frequency) {
        paymentMetadata.frequency = frequency; // 'daily', 'monthly', 'yearly' - from our pricing structure
      }
      if (amount !== undefined) {
        paymentMetadata.amount = amount; // Store amount for reference
      }
      
      // Optionally store billing_interval for edge cases (e.g., "every 2 months")
      // This is useful for future providers that might have different intervals
      if (subscriptionId) {
        try {
          const stripeSubscription = await this.stripeService.getSubscription(subscriptionId);
          const items = stripeSubscription.items.data;
          if (items.length > 0) {
            const price = items[0].price;
            if (price.recurring && price.recurring.interval_count > 1) {
              // Only store if interval_count > 1 (e.g., every 2 months, every 3 weeks)
              paymentMetadata.billing_interval = price.recurring.interval_count;
            }
          }
        } catch (subError) {
          this.logger.warn(
            `Failed to fetch Stripe subscription ${subscriptionId} for metadata: ${subError instanceof Error ? subError.message : String(subError)}`,
          );
        }
      }

      // Cancel old active subscriptions in Stripe, EXCLUDING the new one that was just created
      // This ensures only one active subscription per customer without canceling the new subscription
      const stripeAccount = await this.paymentAccountsService.getPaymentAccount(
        userIdNum,
        PaymentProvider.STRIPE,
      );
      if (stripeAccount?.paymentProviderIdentifier && subscriptionId) {
        try {
          // Pass the new subscription ID to exclude it from cancellation
          await this.stripeService.cancelActiveSubscriptions(
            stripeAccount.paymentProviderIdentifier,
            subscriptionId, // Exclude the newly created subscription
          );
          this.logger.log(
            `Canceled old active subscriptions for customer ${stripeAccount.paymentProviderIdentifier} (excluding new subscription ${subscriptionId})`,
          );
        } catch (cancelError) {
          this.logger.warn(
            `Failed to cancel old subscriptions for customer ${stripeAccount.paymentProviderIdentifier}: ${cancelError instanceof Error ? cancelError.message : String(cancelError)}`,
          );
          // Continue with subscription creation even if cancellation fails
        }
      }

      // Deactivate old subscriptions in database and create new one with payment metadata
      await this.subscriptionsService.createSubscriptionFromPlan(
        userIdNum,
        planCode,
        subscriptionId,
        PaymentProvider.STRIPE,
        paymentMetadata,
      );

      this.logger.log(`✅ Subscription created for user ${userIdNum}, plan ${planCode}`);

      // Send confirmation message to user via platform (Telegram, etc.)
      if (platform && platformIdentifier) {
        this.logger.log(
          `Sending confirmation message to platform: ${platform}, identifier: ${platformIdentifier}`,
        );
        await this.sendConfirmationMessage(platform, platformIdentifier, planCode);
      } else {
        this.logger.warn(
          `Cannot send confirmation message: platform=${platform}, platformIdentifier=${platformIdentifier}`,
        );
      }

      // Send email confirmation if user has email
      if (user?.email) {
        try {
          await this.emailService.sendSubscriptionConfirmationEmail(
            user.email,
            planName,
            planCode,
            user.name || undefined,
          );
          this.logger.log(`✅ Subscription confirmation email sent to ${user.email}`);
        } catch (emailError) {
          this.logger.warn(
            `Failed to send subscription confirmation email to ${user.email}: ${emailError instanceof Error ? emailError.message : String(emailError)}`,
          );
          // Don't throw - email failure shouldn't break subscription creation
        }
      } else {
        this.logger.debug(`User ${userIdNum} has no email, skipping email notification`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to create subscription for user ${userIdNum}, plan ${planCode}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Handle customer.subscription.updated event
   * This is fired when a subscription is updated (e.g., plan change, renewal, status change)
   */
  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const stripeSubscription = event.data.object as Stripe.Subscription;

    this.logger.log(`Subscription updated: ${stripeSubscription.id}, status: ${stripeSubscription.status}`);

    try {
      // Find subscription in database by payment provider subscription ID
      const subscription = await this.subscriptionsService.getSubscriptionByProviderId(
        PaymentProvider.STRIPE,
        stripeSubscription.id,
      );

      if (!subscription) {
        this.logger.warn(
          `Subscription not found in database for Stripe subscription ${stripeSubscription.id}`,
        );
        return;
      }

      // Check if subscription is set to cancel at period end or is already canceled
      const cancelAtPeriodEnd = (stripeSubscription as any).cancel_at_period_end;
      const currentPeriodEnd = (stripeSubscription as any).current_period_end;
      const cancelAt = (stripeSubscription as any).cancel_at;
      const isCanceledInStripe = stripeSubscription.status === 'canceled';
      
      // Determine if subscription is cancelled (either at period end or immediately)
      const isCancelled = cancelAtPeriodEnd || isCanceledInStripe;
      
      // Calculate end date based on cancellation status:
      // IMPORTANT: When cancelled, endDate should be the CURRENT billing period end (current_period_end),
      // NOT the original subscription end date. This ensures user has access until the current billing period ends.
      let endDate: Date | undefined;
      if (isCancelled) {
        // When cancelled, always use current_period_end (end of current billing period)
        // This is the date when access should actually end
        if (currentPeriodEnd) {
          endDate = new Date(currentPeriodEnd * 1000);
        } else if (cancelAt) {
          // Fallback to cancel_at if current_period_end not available
          endDate = new Date(cancelAt * 1000);
        }
        // Always update endDate when cancelled to reflect current billing period end
      } else {
        // Not cancelled - use current_period_end if available, otherwise keep existing
        endDate = currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000)
          : subscription.endDate; // Keep existing endDate if no current_period_end
      }

      // Determine if subscription is currently active in Stripe
      // Stripe statuses: active, canceled, past_due, unpaid, incomplete, incomplete_expired, trialing, paused
      // Note: When cancel_at_period_end is true, status is still 'active' until period ends
      const isCurrentlyActive = stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing';

      // Determine canceledAt: Set if subscription is cancelled and not already set
      // This handles both cancel_at_period_end (cancel at period end) and immediate cancellation
      const canceledAt = isCancelled && !subscription.canceledAt
        ? new Date() // Mark as canceled now
        : isCancelled
          ? subscription.canceledAt // Keep existing canceledAt
          : null; // Not canceled or renewal

      // When cancel_at_period_end is true, subscription is still active in Stripe but should be CANCELLED in our system
      // IMPORTANT: When cancelled, we MUST update endDate to current_period_end (current billing period end)
      // This ensures the user has access until the current billing period ends, not the original subscription end date
      if (isCancelled && endDate) {
        this.logger.log(
          `🔄 Cancellation detected: Updating endDate from ${subscription.endDate?.toISOString()} to ${endDate.toISOString()} (current billing period end)`,
        );
      }

      await this.subscriptionsService.updateSubscriptionStatus(
        PaymentProvider.STRIPE,
        stripeSubscription.id,
        isCurrentlyActive, // Still true even when cancelled (until period ends)
        endDate, // This should be current_period_end when cancelled
        canceledAt,
      );

      // Get updated subscription to log status
      const updatedSubscription = await this.subscriptionsService.getSubscriptionByProviderId(
        PaymentProvider.STRIPE,
        stripeSubscription.id,
      );

      this.logger.log(
        `✅ Updated subscription ${subscription.id}: status=${updatedSubscription?.status}, canceledAt=${canceledAt ? canceledAt.toISOString() : 'null'}, endDate=${endDate ? endDate.toISOString() : 'null'} (Stripe: cancel_at_period_end=${cancelAtPeriodEnd}, is_cancelled=${isCancelled}, status=${stripeSubscription.status})`,
      );

      // If subscription was just canceled (cancel_at_period_end set or immediately canceled), notify user
      if (isCancelled && !subscription.canceledAt) {
        // Get user and plan details for notifications
        const user = await this.usersService.findOne(subscription.userId);
        if (user) {
          const plan = await this.subscriptionsService.getPlanByCode(subscription.planCode);
          const planName = plan?.name || subscription.planCode.toUpperCase();

          // Format end date for user-friendly message
          const endDateFormatted = endDate
            ? new Date(endDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            : 'the end of your current billing period';

          // Send email notification
          if (user.email) {
            try {
              await this.emailService.sendSubscriptionCancellationEmail(
                user.email,
                planName,
                subscription.planCode,
                user.name || undefined,
              );
              this.logger.log(`✅ Subscription cancellation email sent to ${user.email}`);
            } catch (emailError) {
              this.logger.warn(
                `Failed to send subscription cancellation email to ${user.email}: ${emailError instanceof Error ? emailError.message : String(emailError)}`,
              );
            }
          }

          // Send platform notifications
          if (user.platforms && user.platforms.length > 0) {
            const cancellationMessage = `⚠️ Your ${planName} subscription has been canceled. You'll continue to have access until ${endDateFormatted}.`;

            for (const userPlatform of user.platforms) {
              try {
                let messagePlatform: MessagePlatform | null = null;
                if (userPlatform.platform === 'telegram') {
                  messagePlatform = MessagePlatform.TELEGRAM;
                } else if (userPlatform.platform === 'web') {
                  messagePlatform = MessagePlatform.WEB_CHAT;
                } else if (userPlatform.platform === 'whatsapp') {
                  messagePlatform = MessagePlatform.WHATSAPP;
                }

                if (messagePlatform) {
                  await this.sendCancellationMessage(
                    messagePlatform,
                    userPlatform.platformIdentifier,
                    cancellationMessage,
                  );
                  this.logger.log(
                    `✅ Subscription cancellation message sent to ${userPlatform.platform} (${userPlatform.platformIdentifier})`,
                  );
                }
              } catch (platformError) {
                this.logger.warn(
                  `Failed to send cancellation message to ${userPlatform.platform} (${userPlatform.platformIdentifier}): ${platformError instanceof Error ? platformError.message : String(platformError)}`,
                );
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to update subscription for Stripe subscription ${stripeSubscription.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - webhook processing should continue
    }
  }

  /**
   * Handle customer.subscription.deleted event
   * This is fired when a subscription period actually ends (after cancel_at_period_end)
   * At this point, the subscription should be deactivated
   */
  private async handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
    const stripeSubscription = event.data.object as Stripe.Subscription;

    this.logger.log(`Subscription deleted (period ended): ${stripeSubscription.id}`);

    try {
      // Get subscription before deactivating to check if it was canceled
      const subscription = await this.subscriptionsService.getSubscriptionByProviderId(
        PaymentProvider.STRIPE,
        stripeSubscription.id,
      );

      if (!subscription) {
        this.logger.warn(
          `Subscription not found in database for Stripe subscription ${stripeSubscription.id}`,
        );
        return;
      }

      // Get current_period_end from subscription items (this is the actual billing period end)
      const items = (stripeSubscription as any).items || {};
      const currentPeriodEnd = items.data && items.data.length > 0 
        ? items.data[0].current_period_end 
        : (stripeSubscription as any).current_period_end;
  
      const endDate = currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : new Date();

      // Get canceled_at from Stripe subscription object (when cancellation actually happened)
      const stripeCanceledAt = (stripeSubscription as any).canceled_at;
      const canceledAt = stripeCanceledAt 
        ? new Date(stripeCanceledAt * 1000) 
        : subscription.canceledAt || null;

      // When subscription is deleted (cancelled), set status to INACTIVE (not EXPIRED)
      // EXPIRED is for subscriptions that naturally ended, INACTIVE is for cancelled subscriptions
      await this.subscriptionsService.updateCancelledSubscription(
        PaymentProvider.STRIPE,
        stripeSubscription.id,
        endDate,
        canceledAt,
      );
      
      this.logger.log(
        `✅ Updated cancelled subscription ${subscription.id}: status=INACTIVE, canceledAt=${canceledAt ? canceledAt.toISOString() : 'null'}, endDate=${endDate.toISOString()}`,
      );

      this.logger.log(`✅ Deactivated subscription in database for Stripe subscription ${stripeSubscription.id} (period ended)`);

      // Check if user has a newer active subscription (upgrade/downgrade scenario)
      // If they do, this cancellation is automatic and we should NOT send notifications
      const activeSubscription = await this.subscriptionsService.getUserActiveSubscription(
        subscription.userId,
      );

      if (activeSubscription && activeSubscription.id !== subscription.id) {
        // User has a newer active subscription - this is an upgrade/downgrade
        // Don't send cancellation notifications
        this.logger.log(
          `Subscription ${subscription.id} was canceled as part of upgrade/downgrade to subscription ${activeSubscription.id}. Skipping cancellation notifications.`,
        );
        return;
      }

      // This is a real cancellation (no active subscription or this was the active one)
      // Get user with platforms
      const user = await this.usersService.findOne(subscription.userId);
      if (!user) {
        this.logger.warn(`User ${subscription.userId} not found for subscription ${subscription.id}`);
        return;
      }

      // Get plan details for notifications
      const plan = await this.subscriptionsService.getPlanByCode(subscription.planCode);
      const planName = plan?.name || subscription.planCode.toUpperCase();

      // Send email notification
      if (user.email) {
        try {
          await this.emailService.sendSubscriptionCancellationEmail(
            user.email,
            planName,
            subscription.planCode,
            user.name || undefined,
          );
          this.logger.log(`✅ Subscription cancellation email sent to ${user.email}`);
        } catch (emailError) {
          this.logger.warn(
            `Failed to send subscription cancellation email to ${user.email}: ${emailError instanceof Error ? emailError.message : String(emailError)}`,
          );
          // Don't throw - email failure shouldn't break webhook processing
        }
      } else {
        this.logger.debug(`User ${user.id} has no email, skipping email notification`);
      }

      // Send platform notifications to all user platforms
      if (user.platforms && user.platforms.length > 0) {
        // Format end date for user-friendly message (subscription.endDate should be set from updateSubscriptionStatus)
        const endDateFormatted = endDate
          ? new Date(endDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : 'the end of your current billing period';

        const cancellationMessage = `⚠️ Your ${planName} subscription has been canceled and deactivated. Your access will end on ${endDateFormatted}.`;

        for (const userPlatform of user.platforms) {
          try {
            // Map Platform enum to MessagePlatform
            let messagePlatform: MessagePlatform | null = null;
            if (userPlatform.platform === 'telegram') {
              messagePlatform = MessagePlatform.TELEGRAM;
            } else if (userPlatform.platform === 'web') {
              messagePlatform = MessagePlatform.WEB_CHAT;
            } else if (userPlatform.platform === 'whatsapp') {
              messagePlatform = MessagePlatform.WHATSAPP;
            }

            if (messagePlatform) {
              await this.sendCancellationMessage(
                messagePlatform,
                userPlatform.platformIdentifier,
                cancellationMessage,
              );
              this.logger.log(
                `✅ Subscription cancellation message sent to ${userPlatform.platform} (${userPlatform.platformIdentifier})`,
              );
            }
          } catch (platformError) {
            this.logger.warn(
              `Failed to send cancellation message to ${userPlatform.platform} (${userPlatform.platformIdentifier}): ${platformError instanceof Error ? platformError.message : String(platformError)}`,
            );
            // Continue with other platforms
          }
        }
      } else {
        this.logger.debug(`User ${user.id} has no linked platforms, skipping platform notifications`);
      }

      this.logger.log(
        `✅ Subscription ${subscription.id} was deactivated. Notifications sent to user ${user.id}.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to deactivate subscription for Stripe subscription ${stripeSubscription.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - webhook processing should continue
    }
  }

  /**
   * Handle invoice.payment_failed event
   * This is fired when a payment attempt fails
   */
  private async handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    this.logger.warn(`Invoice payment failed: ${invoice.id}`);

    try {
      // Get subscription from invoice
      const invoiceSubscription = (invoice as any).subscription;
      const stripeSubscriptionId =
        typeof invoiceSubscription === 'string' ? invoiceSubscription : invoiceSubscription?.id;

      if (!stripeSubscriptionId) {
        this.logger.warn(`No subscription found in invoice ${invoice.id}`);
        return;
      }

      // Find subscription in database
      const subscription = await this.subscriptionsService.getSubscriptionByProviderId(
        PaymentProvider.STRIPE,
        stripeSubscriptionId,
      );

      if (!subscription) {
        this.logger.warn(
          `Subscription not found in database for Stripe subscription ${stripeSubscriptionId}`,
        );
        return;
      }

      // Get payment metadata to determine frequency and grace period
      const paymentMetadata = subscription.paymentMetadata || {};
      const frequency = paymentMetadata.frequency || 'monthly'; // Use frequency from our pricing structure
      
      // Calculate grace period based on frequency
      const gracePeriodDays = this.getGracePeriodDays(frequency);
      
      // Get Stripe subscription to check retry attempts
      let stripeSubscription: Stripe.Subscription | null = null;
      let attemptCount = 0;
      let nextRetryDate: Date | null = null;
      
      try {
        stripeSubscription = await this.stripeService.getSubscription(stripeSubscriptionId);
        // Check invoice attempts (Stripe Invoice uses snake_case)
        attemptCount = (invoice as any).attempt_count || 0;
        
        // Calculate next retry date (Stripe retries based on their schedule)
        const nextPaymentAttempt = (invoice as any).next_payment_attempt;
        if (nextPaymentAttempt) {
          nextRetryDate = new Date(nextPaymentAttempt * 1000);
        }
      } catch (subError) {
        this.logger.warn(
          `Failed to fetch Stripe subscription ${stripeSubscriptionId}: ${subError instanceof Error ? subError.message : String(subError)}`,
        );
      }

      // Determine subscription status
      const stripeStatus = stripeSubscription?.status || 'unknown';
      const isPastDue = stripeStatus === 'past_due' || stripeStatus === 'unpaid';
      
      // Check if we should restrict access (after grace period)
      const subscriptionStartDate = subscription.startDate || subscription.createdAt;
      const daysSinceStart = Math.floor(
        (Date.now() - subscriptionStartDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const isInGracePeriod = daysSinceStart < gracePeriodDays;

      // Update subscription status if needed
      if (isPastDue && !isInGracePeriod) {
        // Grace period expired - set status to expired
        await this.subscriptionsService.updateSubscriptionStatus(
          PaymentProvider.STRIPE,
          stripeSubscriptionId,
          false, // isCurrentlyActive = false
        );
        this.logger.log(
          `Subscription ${subscription.id} deactivated due to payment failure after grace period`,
        );
      }

      // Get user and plan details for notifications
      const user = await this.usersService.findOne(subscription.userId);
      if (!user) {
        this.logger.warn(`User ${subscription.userId} not found for subscription ${subscription.id}`);
        return;
      }

      const plan = await this.subscriptionsService.getPlanByCode(subscription.planCode);
      const planName = plan?.name || subscription.planCode.toUpperCase();

      // Send notifications
      await this.sendPaymentFailureNotifications(
        user,
        subscription,
        planName,
        frequency,
        attemptCount,
        nextRetryDate,
        isInGracePeriod,
        gracePeriodDays,
      );

      this.logger.log(
        `✅ Payment failure handled for subscription ${subscription.id} (attempt ${attemptCount}, grace period: ${isInGracePeriod ? 'active' : 'expired'})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle payment failure for invoice ${invoice.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - webhook processing should continue
    }
  }

  /**
   * Get grace period in days based on billing frequency
   */
  private getGracePeriodDays(frequency: string): number {
    const frequencyLower = frequency.toLowerCase();
    
    // Grace periods:
    // - Daily: 1 day (very short grace period)
    // - Weekly: 2 days
    // - Monthly: 3 days
    // - Yearly: 7 days (longer grace period for annual subscriptions)
    
    if (frequencyLower === 'daily' || frequencyLower === 'day') {
      return 1;
    } else if (frequencyLower === 'weekly' || frequencyLower === 'week') {
      return 2;
    } else if (frequencyLower === 'monthly' || frequencyLower === 'month') {
      return 3;
    } else if (frequencyLower === 'yearly' || frequencyLower === 'year') {
      return 7;
    }
    
    // Default to 3 days for unknown frequencies
    return 3;
  }

  /**
   * Send payment failure notifications (email + platform)
   */
  private async sendPaymentFailureNotifications(
    user: any,
    subscription: any,
    planName: string,
    frequency: string,
    attemptCount: number,
    nextRetryDate: Date | null,
    isInGracePeriod: boolean,
    gracePeriodDays: number,
  ): Promise<void> {
    // Send email notification
    if (user.email) {
      try {
        await this.emailService.sendPaymentFailureEmail(
          user.email,
          planName,
          subscription.tier,
          frequency,
          attemptCount,
          nextRetryDate,
          isInGracePeriod,
          gracePeriodDays,
          user.name || undefined,
        );
        this.logger.log(`✅ Payment failure email sent to ${user.email}`);
      } catch (emailError) {
        this.logger.warn(
          `Failed to send payment failure email to ${user.email}: ${emailError instanceof Error ? emailError.message : String(emailError)}`,
        );
      }
    }

    // Send platform notifications
    if (user.platforms && user.platforms.length > 0) {
      const frequencyDisplay = frequency.charAt(0).toUpperCase() + frequency.slice(1);
      let message: string;

      if (isInGracePeriod) {
        message = `⚠️ Payment Failed for Your ${planName} Subscription\n\n` +
          `Your ${frequencyDisplay} payment could not be processed. We'll retry automatically.\n\n` +
          `You have ${gracePeriodDays} day(s) to update your payment method before access is restricted.\n\n` +
          (nextRetryDate
            ? `Next retry: ${nextRetryDate.toLocaleDateString()} ${nextRetryDate.toLocaleTimeString()}\n\n`
            : '') +
          `Please update your payment method to avoid service interruption.`;
      } else {
        message = `🚫 Payment Failed - Access Restricted\n\n` +
          `Your ${planName} subscription payment failed after ${gracePeriodDays} day(s) grace period.\n\n` +
          `Your subscription has been deactivated. Please update your payment method and resubscribe to regain access.`;
      }

      for (const userPlatform of user.platforms) {
        try {
          // Map Platform enum to MessagePlatform
          let messagePlatform: MessagePlatform | null = null;
          if (userPlatform.platform === 'telegram') {
            messagePlatform = MessagePlatform.TELEGRAM;
          } else if (userPlatform.platform === 'web') {
            messagePlatform = MessagePlatform.WEB_CHAT;
          } else if (userPlatform.platform === 'whatsapp') {
            messagePlatform = MessagePlatform.WHATSAPP;
          }

          if (messagePlatform) {
            await this.sendCancellationMessage(
              messagePlatform,
              userPlatform.platformIdentifier,
              message,
            );
            this.logger.log(
              `✅ Payment failure message sent to ${userPlatform.platform} (${userPlatform.platformIdentifier})`,
            );
          }
        } catch (platformError) {
          this.logger.warn(
            `Failed to send payment failure message to ${userPlatform.platform} (${userPlatform.platformIdentifier}): ${platformError instanceof Error ? platformError.message : String(platformError)}`,
          );
          // Continue with other platforms
        }
      }
    }
  }

  /**
   * Send confirmation message to user after successful subscription
   */
  private async sendConfirmationMessage(
    platform: MessagePlatform,
    platformIdentifier: string,
    planCode: string,
  ): Promise<void> {
    try {
      // Get plan details to show proper plan name
      const plan = await this.subscriptionsService.getPlanByCode(planCode);
      const planName = plan?.name || planCode.charAt(0).toUpperCase() + planCode.slice(1);
      const message = `✅ Your ${planName} plan subscription is now active! You can start using all the features.`;

      this.logger.debug(
        `Attempting to send confirmation message: platform=${platform}, identifier=${platformIdentifier}, message=${message}`,
      );

      switch (platform) {
        case MessagePlatform.TELEGRAM:
          this.logger.log(`Sending Telegram message to ${platformIdentifier}`);
          await this.telegramService.sendMessage(platformIdentifier, {
            type: MessageType.TEXT,
            text: message,
          });
          this.logger.log(`✅ Telegram confirmation message sent successfully to ${platformIdentifier}`);
          break;

        case MessagePlatform.WEB_CHAT:
          // Web chat notification can be handled here
          this.logger.debug(`Web chat confirmation for ${platformIdentifier}: ${message}`);
          break;

        case MessagePlatform.WHATSAPP:
          // WhatsApp notification can be handled here
          this.logger.debug(`WhatsApp confirmation for ${platformIdentifier}: ${message}`);
          break;

        default:
          this.logger.warn(`Unknown platform for confirmation: ${platform}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send confirmation message to ${platform} (${platformIdentifier}): ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - confirmation message failure shouldn't fail the webhook
    }
  }

  /**
   * Send cancellation message to user when subscription is canceled
   */
  private async sendCancellationMessage(
    platform: MessagePlatform,
    platformIdentifier: string,
    message: string,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Attempting to send cancellation message: platform=${platform}, identifier=${platformIdentifier}`,
      );

      switch (platform) {
        case MessagePlatform.TELEGRAM:
          this.logger.log(`Sending Telegram cancellation message to ${platformIdentifier}`);
          await this.telegramService.sendMessage(platformIdentifier, {
            type: MessageType.TEXT,
            text: message,
          });
          this.logger.log(`✅ Telegram cancellation message sent successfully to ${platformIdentifier}`);
          break;

        case MessagePlatform.WEB_CHAT:
          // Web chat notification can be handled here
          this.logger.debug(`Web chat cancellation for ${platformIdentifier}: ${message}`);
          break;

        case MessagePlatform.WHATSAPP:
          // WhatsApp notification can be handled here
          this.logger.debug(`WhatsApp cancellation for ${platformIdentifier}: ${message}`);
          break;

        default:
          this.logger.warn(`Unknown platform for cancellation: ${platform}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send cancellation message to ${platform} (${platformIdentifier}): ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - cancellation message failure shouldn't fail the webhook
    }
  }
}

