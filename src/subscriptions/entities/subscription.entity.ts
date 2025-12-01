import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
import { PaymentProvider } from '../entities/payment-account.entity';

export enum CreditPeriodUnit {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('subscriptions')
export class Subscription {
  @ApiProperty({ description: 'Subscription ID' })
  @PrimaryGeneratedColumn('increment') // bigserial
  id: number;

  @ApiProperty({ description: 'User ID' })
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @ApiProperty({
    description: 'Subscription plan code (e.g., free, basic, pro)',
  })
  @Column({ type: 'varchar', length: 50, name: 'plan_code' })
  planCode: string;

  @ApiProperty({ description: 'Credit limit', example: 10.0 })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'credit_limit',
    default: 10.0,
  })
  creditLimit: number;

  @ApiProperty({
    enum: CreditPeriodUnit,
    description: 'Credit period unit',
    default: CreditPeriodUnit.DAY,
  })
  @Column({
    type: 'varchar',
    length: 20,
    name: 'credit_period_unit',
    default: CreditPeriodUnit.DAY,
  })
  creditPeriodUnit: CreditPeriodUnit;

  @ApiProperty({ description: 'Credit period value', default: 1 })
  @Column({
    type: 'int',
    name: 'credit_period_value',
    default: 1,
  })
  creditPeriodValue: number;

  @ApiProperty({ description: 'Duration in days', default: 365 })
  @Column({ type: 'int', name: 'duration_days', default: 365 })
  durationDays: number;

  @ApiProperty({ description: 'Subscription start date', required: false })
  @Column({ type: 'timestamp', name: 'start_date', default: () => 'now()', nullable: true })
  startDate?: Date;

  @ApiProperty({ description: 'Subscription end date', required: false })
  @Column({ type: 'timestamp', name: 'end_date', nullable: true })
  endDate?: Date;

  @ApiProperty({
    enum: SubscriptionStatus,
    description: 'Subscription status',
    default: SubscriptionStatus.INACTIVE,
  })
  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.INACTIVE,
    name: 'status',
  })
  @Index('idx_subscriptions_status', ['status'])
  status: SubscriptionStatus;

  @ApiPropertyOptional({
    description: 'Date when subscription cancellation was requested (null if not canceled)',
  })
  @Column({ type: 'timestamp', name: 'canceled_at', nullable: true })
  canceledAt?: Date;

  @ApiPropertyOptional({
    description: 'Payment provider (stripe, paypal, square, etc.)',
    enum: PaymentProvider,
    example: PaymentProvider.STRIPE,
  })
  @Column({
    type: 'varchar',
    length: 50,
    name: 'payment_provider',
    nullable: true,
  })
  @Index('idx_subscriptions_payment_provider', ['payment_provider', 'payment_provider_subscription_id'])
  paymentProvider?: PaymentProvider;

  @ApiPropertyOptional({
    description: 'Subscription ID from payment provider (e.g., Stripe subscription ID)',
    maxLength: 255,
    example: 'sub_1234567890',
  })
  @Column({
    type: 'varchar',
    length: 255,
    name: 'payment_provider_subscription_id',
    nullable: true,
  })
  paymentProviderSubscriptionId?: string;

  @ApiPropertyOptional({
    description: 'Payment metadata (frequency, price_id, etc.) - provider-agnostic',
    example: { frequency: 'daily', price_id: 'price_123', billing_period: 'day' },
    additionalProperties: true,
  })
  @Column({ type: 'jsonb', default: '{}', nullable: true, name: 'payment_metadata' })
  paymentMetadata?: Record<string, any>;

  @ApiProperty({ description: 'Date when subscription was created' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Date when subscription was last updated' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

