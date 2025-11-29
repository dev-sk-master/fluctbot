import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

export enum CreditSource {
  SUBSCRIPTION = 'subscription',
  REFERRAL = 'referral',
}

@Entity('user_credits_usage')
@Unique(['userId', 'date', 'creditSource'])
export class UserCreditsUsage {
  @ApiProperty({ description: 'Usage ID' })
  @PrimaryGeneratedColumn('increment') // bigint with sequence
  id: number;

  @ApiProperty({ description: 'User ID' })
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @ApiProperty({ description: 'Date of usage' })
  @Column({ type: 'date', default: () => 'CURRENT_DATE', nullable: true })
  date: Date;

  @ApiProperty({ description: 'Tokens used', default: 0 })
  @Column({ type: 'int', name: 'tokens_used', default: 0 })
  tokensUsed: number;

  @ApiProperty({
    enum: CreditSource,
    description: 'Source of credits',
    default: CreditSource.SUBSCRIPTION,
  })
  @Column({
    type: 'varchar',
    length: 20,
    name: 'credit_source',
    default: CreditSource.SUBSCRIPTION,
  })
  creditSource: CreditSource;

  @ApiProperty({ description: 'Credits used', default: 0 })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 8,
    name: 'credits_used',
    default: 0,
  })
  creditsUsed: number;

  @ApiProperty({ description: 'Date when record was created' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Date when record was last updated' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

