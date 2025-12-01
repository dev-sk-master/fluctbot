import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { PaymentProvider } from './entities/payment-account.entity';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private readonly subscriptionPlanRepository: Repository<SubscriptionPlan>,
  ) {}

  /**
   * Get free tier plan configuration from subscription_plans table
   */
  async getFreeTierPlan(): Promise<SubscriptionPlan | null> {
    return await this.subscriptionPlanRepository.findOne({
      where: {
        planCode: 'free',
        active: true,
      },
    });
  }

  /**
   * Check if user has already used their free trial
   */
  async hasUsedFreeTrial(userId: number): Promise<boolean> {
    const freeSubscription = await this.subscriptionRepository.findOne({
      where: {
        userId: userId,
        planCode: 'free',
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return !!freeSubscription;
  }

  /**
   * Create a free tier subscription for a user
   */
  async createFreeTierSubscription(userId: number): Promise<Subscription> {
    // Get free tier plan configuration
    const freePlan = await this.getFreeTierPlan();

    if (!freePlan) {
      throw new Error('Free tier plan not found in subscription_plans table');
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + freePlan.durationDays);

    const subscription = this.subscriptionRepository.create({
      userId: userId,
      planCode: 'free',
      creditLimit: freePlan.creditLimit,
      creditPeriodUnit: freePlan.creditPeriodUnit,
      creditPeriodValue: freePlan.creditPeriodValue,
      durationDays: freePlan.durationDays,
      startDate: startDate,
      endDate: endDate,
      status: SubscriptionStatus.ACTIVE,
    });

    this.logger.debug(
      `Creating free tier subscription for user ${userId} with plan: ${JSON.stringify({
        creditLimit: freePlan.creditLimit,
        creditPeriodUnit: freePlan.creditPeriodUnit,
        creditPeriodValue: freePlan.creditPeriodValue,
        durationDays: freePlan.durationDays,
      })}`,
    );

    return await this.subscriptionRepository.save(subscription);
  }

  /**
   * Get user's active subscription
   * A subscription is considered active if:
   * - status is 'active' AND
   * - endDate is null or in the future
   */
  async getUserActiveSubscription(
    userId: number,
  ): Promise<Subscription | null> {
    const now = new Date();
    return await this.subscriptionRepository
      .createQueryBuilder('subscription')
      .where('subscription.user_id = :userId', { userId })
      .andWhere('subscription.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('(subscription.end_date IS NULL OR subscription.end_date > :now)', { now })
      .orderBy('subscription.created_at', 'DESC')
      .getOne();
  }

  /**
   * Get user's last subscription (regardless of status)
   * Useful for displaying subscription history even if inactive
   */
  async getUserLastSubscription(
    userId: number,
  ): Promise<Subscription | null> {
    return await this.subscriptionRepository.findOne({
      where: {
        userId: userId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Deactivate all active subscriptions for a user
   * Sets them to INACTIVE (not EXPIRED) since they're being replaced by a new subscription
   */
  async deactivateUserActiveSubscriptions(userId: number): Promise<void> {
    // Get all active subscriptions first
    const activeSubscriptions = await this.subscriptionRepository.find({
      where: {
        userId: userId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    // Set each to INACTIVE explicitly (not EXPIRED, since they're being replaced)
    for (const subscription of activeSubscriptions) {
      subscription.status = SubscriptionStatus.INACTIVE;
      await this.subscriptionRepository.save(subscription);
    }

    this.logger.debug(`Deactivated ${activeSubscriptions.length} active subscription(s) for user ${userId} (set to INACTIVE)`);
  }

  /**
   * Create a subscription from plan code
   */
  async createSubscriptionFromPlan(
    userId: number,
    planCode: string,
    paymentProviderSubscriptionId?: string,
    paymentProvider: PaymentProvider = PaymentProvider.STRIPE,
    paymentMetadata?: Record<string, any>,
  ): Promise<Subscription> {
    const plan = await this.subscriptionPlanRepository.findOne({
      where: {
        planCode: planCode,
        active: true,
      },
    });

    if (!plan) {
      throw new Error(`Plan with code '${planCode}' not found`);
    }

    // Deactivate existing subscriptions
    await this.deactivateUserActiveSubscriptions(userId);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + plan.durationDays);

    const subscription = this.subscriptionRepository.create({
      userId: userId,
      planCode: plan.planCode,
      creditLimit: plan.creditLimit,
      creditPeriodUnit: plan.creditPeriodUnit,
      creditPeriodValue: plan.creditPeriodValue,
      durationDays: plan.durationDays,
      startDate: startDate,
      endDate: endDate,
      status: SubscriptionStatus.ACTIVE,
      paymentProvider: paymentProvider,
      paymentProviderSubscriptionId: paymentProviderSubscriptionId,
      paymentMetadata: paymentMetadata || {},
    });

    return await this.subscriptionRepository.save(subscription);
  }

  /**
   * Get plan by code
   */
  async getPlanByCode(planCode: string): Promise<SubscriptionPlan | null> {
    return await this.subscriptionPlanRepository.findOne({
      where: {
        planCode: planCode,
        active: true,
      },
    });
  }

  /**
   * Get all active plans
   */
  async getAllPlans(): Promise<SubscriptionPlan[]> {
    return await this.subscriptionPlanRepository.find({
      where: {
        active: true,
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  /**
   * Find subscription by payment provider subscription ID
   */
  async getSubscriptionByProviderId(
    paymentProvider: PaymentProvider,
    paymentProviderSubscriptionId: string,
  ): Promise<Subscription | null> {
    return await this.subscriptionRepository.findOne({
      where: {
        paymentProvider: paymentProvider,
        paymentProviderSubscriptionId: paymentProviderSubscriptionId,
      },
    });
  }

  /**
   * Find subscription by any provider subscription ID (searches across all providers)
   */
  async getSubscriptionByProviderSubscriptionId(
    paymentProviderSubscriptionId: string,
  ): Promise<Subscription | null> {
    return await this.subscriptionRepository.findOne({
      where: {
        paymentProviderSubscriptionId: paymentProviderSubscriptionId,
      },
    });
  }

  /**
   * Calculate subscription status based on conditions
   * Priority order:
   * 1. If period has ended → EXPIRED (regardless of cancelled status)
   * 2. If cancelled and period hasn't ended → CANCELLED (user still has access)
   * 3. If currently active → ACTIVE
   * 4. Default → INACTIVE
   */
  private calculateStatus(
    canceledAt: Date | null | undefined,
    endDate: Date | undefined,
    isCurrentlyActive: boolean,
  ): SubscriptionStatus {
    const now = new Date();
    
    // Priority 1: If period has ended, it's EXPIRED (even if it was cancelled)
    if (endDate && endDate < now) {
      return SubscriptionStatus.EXPIRED;
    }
    
    // Priority 2: If cancelled but period hasn't ended, it's CANCELLED (user still has access)
    if (canceledAt && (!endDate || endDate > now)) {
      return SubscriptionStatus.CANCELLED;
    }
    
    // Priority 3: If currently active and period hasn't ended, it's ACTIVE
    if (isCurrentlyActive && (!endDate || endDate > now)) {
      return SubscriptionStatus.ACTIVE;
    }
    
    // Default: INACTIVE (for subscriptions that are not active, not cancelled, and period hasn't ended)
    return SubscriptionStatus.INACTIVE;
  }

  /**
   * Update subscription status based on payment provider subscription status
   */
  async updateSubscriptionStatus(
    paymentProvider: PaymentProvider,
    paymentProviderSubscriptionId: string,
    isActive: boolean,
    endDate?: Date,
    canceledAt?: Date | null,
  ): Promise<Subscription | null> {
    const subscription = await this.getSubscriptionByProviderId(
      paymentProvider,
      paymentProviderSubscriptionId,
    );
    if (!subscription) {
      this.logger.warn(
        `Subscription not found for ${paymentProvider} ID: ${paymentProviderSubscriptionId}`,
      );
      return null;
    }

    // Update dates first (important for status calculation)
    if (endDate) {
      subscription.endDate = endDate;
      this.logger.debug(
        `Updated subscription ${subscription.id} endDate to: ${endDate.toISOString()}`,
      );
    }
    if (canceledAt !== undefined) {
      subscription.canceledAt = canceledAt || undefined;
      if (canceledAt) {
        this.logger.debug(
          `Updated subscription ${subscription.id} canceledAt to: ${canceledAt.toISOString()}`,
        );
      }
    }
    
    // Calculate status based on updated conditions
    // Use the updated endDate (either the new one or the existing one)
    const calculatedStatus = this.calculateStatus(
      subscription.canceledAt,
      subscription.endDate,
      isActive,
    );
    
    subscription.status = calculatedStatus;
    
    this.logger.debug(
      `Calculated status for subscription ${subscription.id}: ${calculatedStatus} (canceledAt: ${subscription.canceledAt ? 'set' : 'null'}, endDate: ${subscription.endDate ? subscription.endDate.toISOString() : 'null'}, isActive: ${isActive})`,
    );

    return await this.subscriptionRepository.save(subscription);
  }

  /**
   * Deactivate subscription by payment provider subscription ID
   */
  async deactivateSubscriptionByProviderId(
    paymentProvider: PaymentProvider,
    paymentProviderSubscriptionId: string,
  ): Promise<void> {
    const subscription = await this.getSubscriptionByProviderId(
      paymentProvider,
      paymentProviderSubscriptionId,
    );
    if (subscription) {
      // Determine status: if endDate is past, it's expired, otherwise inactive
      const now = new Date();
      subscription.status = subscription.endDate && subscription.endDate < now
        ? SubscriptionStatus.EXPIRED
        : SubscriptionStatus.INACTIVE;
      
      await this.subscriptionRepository.save(subscription);
      this.logger.log(
        `Deactivated subscription ${subscription.id} for ${paymentProvider} subscription ${paymentProviderSubscriptionId} (status: ${subscription.status})`,
      );
    } else {
      this.logger.warn(
        `Subscription not found for ${paymentProvider} ID: ${paymentProviderSubscriptionId}`,
      );
    }
  }

  /**
   * Update subscription when cancelled (deleted event)
   * Sets status to INACTIVE, updates endDate and canceledAt
   */
  async updateCancelledSubscription(
    paymentProvider: PaymentProvider,
    paymentProviderSubscriptionId: string,
    endDate: Date,
    canceledAt: Date | null,
  ): Promise<Subscription | null> {
    const subscription = await this.getSubscriptionByProviderId(
      paymentProvider,
      paymentProviderSubscriptionId,
    );
    if (!subscription) {
      this.logger.warn(
        `Subscription not found for ${paymentProvider} ID: ${paymentProviderSubscriptionId}`,
      );
      return null;
    }

    subscription.endDate = endDate;
    if (canceledAt) {
      subscription.canceledAt = canceledAt;
    }
    subscription.status = SubscriptionStatus.INACTIVE;

    return await this.subscriptionRepository.save(subscription);
  }
}

