import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { SubscriptionTier } from './entities/subscription.entity';

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
        tier: SubscriptionTier.FREE,
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
      tier: SubscriptionTier.FREE,
      creditLimit: freePlan.creditLimit,
      creditPeriodUnit: freePlan.creditPeriodUnit,
      creditPeriodValue: freePlan.creditPeriodValue,
      durationDays: freePlan.durationDays,
      startDate: startDate,
      endDate: endDate,
      isActive: true,
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
   */
  async getUserActiveSubscription(
    userId: number,
  ): Promise<Subscription | null> {
    return await this.subscriptionRepository.findOne({
      where: {
        userId: userId,
        isActive: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Deactivate all active subscriptions for a user
   */
  async deactivateUserActiveSubscriptions(userId: number): Promise<void> {
    await this.subscriptionRepository
      .createQueryBuilder()
      .update(Subscription)
      .set({ isActive: false })
      .where('user_id = :userId', { userId })
      .andWhere('is_active = :active', { active: true })
      .execute();

    this.logger.debug(`Deactivated all active subscriptions for user ${userId}`);
  }

  /**
   * Create a subscription from plan code
   */
  async createSubscriptionFromPlan(
    userId: number,
    planCode: string,
    stripeSubscriptionId?: string,
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
      tier: plan.planCode as SubscriptionTier,
      creditLimit: plan.creditLimit,
      creditPeriodUnit: plan.creditPeriodUnit,
      creditPeriodValue: plan.creditPeriodValue,
      durationDays: plan.durationDays,
      startDate: startDate,
      endDate: endDate,
      isActive: true,
      stripeSubscriptionId: stripeSubscriptionId,
    });

    return await this.subscriptionRepository.save(subscription);
  }
}

