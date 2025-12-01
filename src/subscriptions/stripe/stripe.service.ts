import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { NgrokService } from '../../common/ngrok/ngrok.service';
import { MessagePlatform } from '../../workflow/types/message.types';
import { PaymentAccountsService } from '../services/payment-accounts.service';

export interface CreateCheckoutSessionParams {
  planCode: string;
  userId: number;
  platform: MessagePlatform;
  platformIdentifier: string;
  priceId?: string; // Optional: specific price ID (monthly/yearly)
  successUrl?: string;
  cancelUrl?: string;
}

export interface StripeMetadata {
  stripe_product_id?: string;
  stripe_price_ids?: {
    monthly?: string;
    yearly?: string;
    [key: string]: string | undefined;
  };
}

@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly ngrokService?: NgrokService,
    private readonly paymentAccountsService?: PaymentAccountsService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-11-17.clover',
      });
      this.logger.log('Stripe service initialized');
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set, Stripe service disabled');
    }
  }

  async onModuleInit() {
    if (!this.stripe) {
      return; // Stripe not configured
    }

    // Check if webhook URL is configured
    const webhookUrl = this.configService.get<string>('STRIPE_WEBHOOK_URL');

    if (webhookUrl && webhookUrl.trim() !== '') {
      // Use configured webhook URL
      try {
        const result = await this.setWebhook(webhookUrl);
        this.logger.log(`✅ Stripe webhook set to: ${webhookUrl}`);
        this.logger.log(`   Webhook ID: ${result.webhook.id}`);
        
        if (result.secret) {
          this.logger.log(`   Webhook Secret: ${result.secret}`);
          this.logger.warn(
            `⚠️  Add this to your .env file if not already set: STRIPE_WEBHOOK_SECRET=${result.secret}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `❌ Failed to set Stripe webhook: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      // Try to auto-detect ngrok URL (for local development)
      this.logger.log(
        'STRIPE_WEBHOOK_URL not set, attempting to detect ngrok tunnel...',
      );

      if (this.ngrokService) {
        const ngrokUrl = await this.ngrokService.getOrStartNgrok();

        if (ngrokUrl) {
          // Get API prefix from config
          const apiPrefix = this.configService.get<string>('API_PREFIX') || 'api/v1';
          const autoWebhookUrl = `${ngrokUrl}/${apiPrefix}/subscriptions/webhook`;

          this.logger.log(`✅ Detected ngrok URL: ${ngrokUrl}`);
          this.logger.log(`✅ Constructed Stripe webhook URL: ${autoWebhookUrl}`);

          try {
            const result = await this.setWebhook(autoWebhookUrl);
            this.logger.log(`✅ Stripe webhook automatically set to: ${autoWebhookUrl}`);
            this.logger.log(`   Webhook ID: ${result.webhook.id}`);
            
            if (result.secret) {
              this.logger.log(`   Webhook Secret: ${result.secret}`);
              this.logger.warn(
                `⚠️  Add this to your .env file: STRIPE_WEBHOOK_SECRET=${result.secret}`,
              );
            } else {
              this.logger.warn(
                `⚠️  Webhook secret not available. Retrieve it from Stripe Dashboard:`,
              );
              this.logger.warn(
                `   https://dashboard.stripe.com/webhooks/${result.webhook.id}`,
              );
            }
            
            this.logger.warn(
              '⚠️  For production, set STRIPE_WEBHOOK_URL in your .env file',
            );
          } catch (error) {
            this.logger.error(
              `❌ Failed to set Stripe webhook automatically: ${error instanceof Error ? error.message : String(error)}`,
            );
            this.logger.warn(
              'You can manually set the webhook in Stripe Dashboard or use the setWebhook method',
            );
          }
        } else {
          this.logger.warn(
            '⚠️  Ngrok not available. Stripe webhook not set. Set STRIPE_WEBHOOK_URL in .env for production.',
          );
        }
      } else {
        this.logger.warn(
          '⚠️  NgrokService not available. Set STRIPE_WEBHOOK_URL in .env file.',
        );
      }
    }
  }

  /**
   * Check if Stripe is configured
   */
  isConfigured(): boolean {
    return this.stripe !== null;
  }

  /**
   * Get Stripe instance
   */
  getStripe(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
    }
    return this.stripe;
  }

  /**
   * Get or create a Stripe customer for a user
   * This ensures one customer per user in Stripe
   */
  async getOrCreateCustomer(userId: number, userEmail?: string, userName?: string): Promise<string> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    if (!this.paymentAccountsService) {
      throw new Error('PaymentAccountsService is not available');
    }

    return await this.paymentAccountsService.getOrCreateStripeCustomer(
      userId,
      this.stripe,
      userEmail,
      userName,
    );
  }

  /**
   * Get PaymentAccountsService (for use in other services)
   */
  getPaymentAccountsService(): PaymentAccountsService | undefined {
    return this.paymentAccountsService;
  }

  /**
   * Cancel all active subscriptions for a Stripe customer
   * This ensures only one active subscription per customer
   */
  /**
   * Cancel all active subscriptions for a customer, excluding a specific subscription ID
   * This is useful when creating a new subscription and you want to cancel old ones
   * without canceling the newly created one.
   */
  async cancelActiveSubscriptions(
    customerId: string,
    excludeSubscriptionId?: string,
  ): Promise<void> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    try {
      // Get all active subscriptions for this customer
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 100,
      });

      // Filter out the subscription to exclude (if provided)
      const subscriptionsToCancel = excludeSubscriptionId
        ? subscriptions.data.filter((sub) => sub.id !== excludeSubscriptionId)
        : subscriptions.data;

      // Cancel all active subscriptions (except the excluded one)
      let canceledCount = 0;
      for (const subscription of subscriptionsToCancel) {
        await this.stripe.subscriptions.cancel(subscription.id);
        this.logger.log(`Canceled Stripe subscription ${subscription.id} for customer ${customerId}`);
        canceledCount++;
      }

      if (canceledCount > 0) {
        this.logger.log(
          `Canceled ${canceledCount} active subscription(s) for customer ${customerId}${excludeSubscriptionId ? ` (excluding new subscription ${excludeSubscriptionId})` : ''}`,
        );
      } else if (subscriptions.data.length > 0 && excludeSubscriptionId) {
        this.logger.log(
          `No old subscriptions to cancel for customer ${customerId} (only the new subscription ${excludeSubscriptionId} exists)`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to cancel active subscriptions for customer ${customerId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Create a Stripe Checkout Session for subscription
   */
  async createCheckoutSession(
    params: CreateCheckoutSessionParams,
    plan: SubscriptionPlan,
  ): Promise<Stripe.Checkout.Session> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    // Extract Stripe IDs from plan pricing (enhanced structure)
    const pricing = plan.pricing || {};
    
    // Determine which price ID to use
    let priceId: string | undefined = params.priceId;

    // If no specific price ID provided, use the first available from pricing
    if (!priceId) {
      // Prefer monthly, then yearly, then any other
      priceId = pricing.monthly?.stripe_price_id || 
                pricing.yearly?.stripe_price_id || 
                Object.values(pricing).find((tier) => tier?.stripe_price_id)?.stripe_price_id;
    }

    if (!priceId) {
      throw new Error(
        `No Stripe price ID found for plan ${params.planCode}. Please configure stripe_price_ids in plan metadata.`,
      );
    }

    // Get or create Stripe customer for this user
    let customerId: string;
    try {
      if (!this.paymentAccountsService) {
        throw new Error('PaymentAccountsService is not available');
      }
      customerId = await this.getOrCreateCustomer(params.userId);
    } catch (error) {
      this.logger.error(
        `Failed to get or create customer for user ${params.userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }

    // Build success and cancel URLs
    const baseUrl = this.configService.get<string>('APP_URL') || 'https://t.me';
    const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME') || 'your_bot';

    const successUrl =
      params.successUrl ||
      (params.platform === MessagePlatform.TELEGRAM
        ? `https://t.me/${botUsername}?start=payment_success`
        : `${baseUrl}/subscriptions/success`);
    const cancelUrl =
      params.cancelUrl ||
      (params.platform === MessagePlatform.TELEGRAM
        ? `https://t.me/${botUsername}?start=payment_cancel`
        : `${baseUrl}/subscriptions/cancel`);

    // Create checkout session with existing customer
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId, // Use existing customer
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        plan_code: params.planCode,
        user_id: String(params.userId),
        platform: params.platform, // MessagePlatform enum value (e.g., 'telegram')
        platform_identifier: params.platformIdentifier,
        price_id: priceId, // Store price ID for frequency tracking
      },
      subscription_data: {
        metadata: {
          plan_code: params.planCode,
          user_id: String(params.userId),
          platform: params.platform,
          price_id: priceId, // Store price ID in subscription metadata
        },
      },
    });

    this.logger.debug(
      `Created checkout session ${session.id} for user ${params.userId} (customer ${customerId}), plan ${params.planCode}`,
    );

    return session;
  }

  /**
   * Retrieve a checkout session
   */
  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    return await this.stripe.checkout.sessions.retrieve(sessionId);
  }

  /**
   * Retrieve a subscription
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    immediately: boolean = false,
  ): Promise<Stripe.Subscription> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    if (immediately) {
      return await this.stripe.subscriptions.cancel(subscriptionId);
    } else {
      // Cancel at period end
      return await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
  }

  /**
   * List all products from Stripe (for admin/sync purposes)
   */
  async listProducts(): Promise<Stripe.Product[]> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    const products = await this.stripe.products.list({ active: true, limit: 100 });
    return products.data;
  }

  /**
   * List prices for a product
   */
  async listPrices(productId: string): Promise<Stripe.Price[]> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    const prices = await this.stripe.prices.list({ product: productId, active: true, limit: 100 });
    return prices.data;
  }

  /**
   * Retrieve a price by ID to get currency and other details
   */
  async getPrice(priceId: string): Promise<Stripe.Price> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    return await this.stripe.prices.retrieve(priceId);
  }

  /**
   * Get currency symbol from currency code
   * Returns the symbol for common currencies, falls back to currency code
   */
  getCurrencySymbol(currency: string): string {
    const currencyMap: Record<string, string> = {
      usd: '$',
      gbp: '£',
      eur: '€',
      cad: 'C$',
      aud: 'A$',
      jpy: '¥',
      inr: '₹',
      // Add more as needed
    };

    return currencyMap[currency.toLowerCase()] || currency.toUpperCase();
  }

  /**
   * Clean up old Stripe webhooks to free up space
   * Deletes webhooks that don't match the target URL, prioritizing test mode webhooks
   */
  private async cleanupOldWebhooks(
    targetUrl: string,
  ): Promise<number> {
    if (!this.stripe) {
      return 0;
    }

    try {
      const allWebhooks = await this.stripe.webhookEndpoints.list({ limit: 100 });
      let deletedCount = 0;

      // Delete webhooks that don't match the target URL
      // Only delete webhooks matching the current mode (test/live)
      const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY') || '';
      const isTestMode = secretKey.startsWith('sk_test_');

      for (const webhook of allWebhooks.data) {
        // Keep webhook if it matches target URL
        if (webhook.url === targetUrl) {
          continue;
        }

        // Only delete webhooks in the same mode (test or live)
        if (isTestMode && webhook.livemode) {
          continue; // Skip live mode webhooks when in test mode
        }
        if (!isTestMode && !webhook.livemode) {
          continue; // Skip test mode webhooks when in live mode
        }

        try {
          await this.stripe.webhookEndpoints.del(webhook.id);
          this.logger.debug(`🗑️  Deleted old Stripe webhook: ${webhook.url} (${webhook.id})`);
          deletedCount++;
        } catch (error) {
          this.logger.warn(`⚠️  Failed to delete webhook ${webhook.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return deletedCount;
    } catch (error) {
      this.logger.error(`❌ Error cleaning up old webhooks: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }

  /**
   * Set up Stripe webhook endpoint
   * Reuses existing webhook if URL matches, creates new one if not
   * Automatically cleans up old webhooks if hitting the limit
   * Returns webhook endpoint with secret for signature verification
   */
  async setWebhook(
    webhookUrl: string,
    enabledEvents: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
      'checkout.session.completed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_failed',
    ],
  ): Promise<{ webhook: Stripe.WebhookEndpoint; secret?: string }> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    let lastError: any;
    const maxRetries = 3;
    let retryDelay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if webhook already exists
        const existing = await this.stripe.webhookEndpoints.list({ limit: 100 });
        const found = existing.data.find((e) => e.url === webhookUrl);

        if (found) {
          // Update if events changed
          if (found.status !== 'enabled' || !this.arraysEqualIgnoreOrder(found.enabled_events || [], enabledEvents)) {
            const updated = await this.stripe.webhookEndpoints.update(found.id, {
              enabled_events: enabledEvents,
              disabled: false,
            });
            
            // Note: Secret is only available when creating NEW webhooks, not when updating
            // For existing webhooks, user needs to get secret from Stripe Dashboard
            return { webhook: updated, secret: undefined };
          }
          
          // Webhook exists and is up to date
          // Note: Secret is not available via API for existing webhooks
          return { webhook: found, secret: undefined };
        }

        // If webhook doesn't exist, try to create it
        try {
          const created = await this.stripe.webhookEndpoints.create({
            url: webhookUrl,
            enabled_events: enabledEvents,
          });
          
          // Secret is available in the response when creating a NEW webhook
          // Note: Stripe API may return secret in different fields depending on version
          const secret = (created as any).secret || undefined;
          return { webhook: created, secret };
        } catch (createError: any) {
          const errorMessage = createError?.message || String(createError);
          const isMaxWebhooksError =
            errorMessage.toLowerCase().includes('maximum') ||
            errorMessage.toLowerCase().includes('16 test webhook') ||
            errorMessage.toLowerCase().includes('reached the maximum');

          // If we hit the limit, clean up old webhooks and retry
          if (isMaxWebhooksError && attempt === 1) {
            this.logger.log('🧹 Cleaning up old Stripe webhooks to free up space...');
            const deletedCount = await this.cleanupOldWebhooks(webhookUrl);
            this.logger.log(`✅ Deleted ${deletedCount} old webhook(s)`);

            // Retry creating the webhook after cleanup
            try {
              const created = await this.stripe.webhookEndpoints.create({
                url: webhookUrl,
                enabled_events: enabledEvents,
              });
              
              // Secret is available in the response when creating a NEW webhook
              const secret = (created as any).secret || undefined;
              return { webhook: created, secret };
            } catch (retryError: any) {
              lastError = retryError;
              throw retryError;
            }
          } else {
            throw createError;
          }
        }
      } catch (error: any) {
        lastError = error;
        // 4xx except rate-limit → do not retry
        const status = error?.status || error?.raw?.statusCode || error?.code;
        if (status && typeof status === 'number' && status >= 400 && status < 500 && status !== 429) {
          break;
        }

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          retryDelay *= 2;
        }
      }
    }

    throw new Error(lastError?.message || 'Failed to set Stripe webhook');
  }


  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  /**
   * Helper: Check if two arrays are equal (ignoring order)
   */
  private arraysEqualIgnoreOrder(a: any[], b: any[]): boolean {
    if (a.length !== b.length) return false;
    const as = [...a].sort();
    const bs = [...b].sort();
    for (let i = 0; i < as.length; i++) {
      if (as[i] !== bs[i]) return false;
    }
    return true;
  }
}

