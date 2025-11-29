import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

export enum SubscriptionTier {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
}

export enum CreditPeriodUnit {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
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
    enum: SubscriptionTier,
    description: 'Subscription tier',
  })
  @Column({ type: 'varchar', length: 50 })
  tier: SubscriptionTier;

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

  @ApiProperty({ description: 'Whether subscription is active', default: true })
  @Column({ type: 'boolean', name: 'is_active', default: true, nullable: true })
  isActive?: boolean;

  @ApiProperty({ description: 'Stripe subscription ID', required: false })
  @Column({
    type: 'varchar',
    length: 255,
    name: 'stripe_subscription_id',
    nullable: true,
  })
  stripeSubscriptionId?: string;

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

