import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

export enum PaymentProvider {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  SQUARE = 'square',
  // Add more providers as needed
}

@Entity('payment_accounts')
@Unique(['paymentProvider', 'paymentProviderIdentifier'])
@Unique(['userId', 'paymentProvider'])
export class PaymentAccount {
  @ApiProperty({ description: 'Payment account ID' })
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @ApiProperty({ description: 'User ID' })
  @Column({ type: 'bigint', name: 'user_id' })
  @Index('idx_payment_accounts_user_id')
  userId: number;

  @ApiProperty({
    description: 'Payment provider (stripe, paypal, square, etc.)',
    enum: PaymentProvider,
    example: PaymentProvider.STRIPE,
  })
  @Column({
    type: 'varchar',
    length: 50,
    name: 'payment_provider',
  })
  @Index('idx_payment_accounts_payment_provider')
  paymentProvider: PaymentProvider;

  @ApiProperty({
    description: 'Customer/Account identifier from payment provider (e.g., Stripe customer ID)',
    maxLength: 255,
    example: 'cus_1234567890',
  })
  @Column({
    type: 'varchar',
    length: 255,
    name: 'payment_provider_identifier',
  })
  paymentProviderIdentifier: string;

  @ApiProperty({
    description: 'Whether this is the primary payment account for the user',
    default: false,
  })
  @Column({ type: 'boolean', default: false, name: 'is_primary' })
  @Index('idx_payment_accounts_is_primary', { where: 'is_primary = true' })
  isPrimary: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata as JSON',
    example: {},
  })
  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Account creation date' })
  @CreateDateColumn({ type: 'timestamp', default: () => 'now()', name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  @UpdateDateColumn({ type: 'timestamp', default: () => 'now()', name: 'updated_at' })
  updatedAt: Date;

  @ApiProperty({ description: 'User', type: () => User })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

