import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreditPeriodUnit } from './subscription.entity';

export interface SubscriptionPlanCapabilities {
  fleets?: number | 'unlimited';
  reminders?: number | 'unlimited';
  [key: string]: number | 'unlimited' | undefined;
}

export interface PricingTier {
  amount: number;
  stripe_price_id: string;
}

export interface SubscriptionPlanPricing {
  // Recurring pricing
  monthly?: PricingTier;
  yearly?: PricingTier;
  weekly?: PricingTier;
  // One-time pricing
  one_time?: PricingTier;
  // Fixed pricing
  fixed?: PricingTier;
  [key: string]: PricingTier | undefined;
}

@Entity('subscription_plans')
export class SubscriptionPlan {
  @ApiProperty({ description: 'Subscription plan ID' })
  @PrimaryGeneratedColumn('increment') // SERIAL
  id: number;

  @ApiProperty({
    description: 'Plan code (unique identifier)',
    example: 'free',
    maxLength: 50,
  })
  @Column({ type: 'varchar', length: 50, unique: true, name: 'plan_code' })
  @Index('subscription_plans_plan_code_key', { unique: true })
  planCode: string;

  @ApiPropertyOptional({
    description: 'Plan name',
    example: 'Free Plan',
    maxLength: 100,
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  name?: string;

  @ApiProperty({
    description: 'Credit limit',
    example: 10,
  })
  @Column({ type: 'int', name: 'credit_limit' })
  creditLimit: number;

  @ApiProperty({
    enum: CreditPeriodUnit,
    description: 'Credit period unit',
    example: CreditPeriodUnit.DAY,
  })
  @Column({
    type: 'varchar',
    length: 10,
    name: 'credit_period_unit',
  })
  creditPeriodUnit: CreditPeriodUnit;

  @ApiProperty({
    description: 'Credit period value',
    example: 1,
  })
  @Column({ type: 'int', name: 'credit_period_value' })
  creditPeriodValue: number;

  @ApiProperty({
    description: 'Duration in days',
    example: 365,
  })
  @Column({ type: 'int', name: 'duration_days' })
  durationDays: number;

  @ApiProperty({
    description: 'Whether plan is active',
    default: true,
  })
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata as JSON',
    example: {},
  })
  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Plan capabilities (limits for features)',
    example: { fleets: 1, reminders: 3 },
  })
  @Column({ type: 'jsonb', nullable: true, default: '{}' })
  capabilities?: SubscriptionPlanCapabilities;

  @ApiPropertyOptional({
    description: 'Plan pricing (supports recurring, one-time, or fixed pricing)',
    example: { monthly: 5, yearly: 50 },
  })
  @Column({ type: 'jsonb', nullable: true, default: '{}' })
  pricing?: SubscriptionPlanPricing;

  @ApiProperty({ description: 'Date when plan was created' })
  @CreateDateColumn({ type: 'timestamp', default: () => 'now()', name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Date when plan was last updated' })
  @UpdateDateColumn({ type: 'timestamp', default: () => 'now()', name: 'updated_at' })
  updatedAt: Date;
}

