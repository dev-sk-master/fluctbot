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

export enum ReferralStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
}

@Entity('referrals')
export class Referral {
  @ApiProperty({ description: 'Referral ID' })
  @PrimaryGeneratedColumn('increment') // bigserial
  id: number;

  @ApiProperty({ description: 'User ID who made the referral' })
  @Column({ type: 'bigint', name: 'referrer_id' })
  referrerId: number;

  @ApiProperty({ description: 'User ID who was referred', required: false })
  @Column({ type: 'bigint', name: 'referred_user_id', nullable: true })
  referredUserId?: number;

  @ApiProperty({ description: 'Credit reward amount', example: 5.0 })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'credit_reward',
    default: 5.0,
    nullable: true,
  })
  creditReward?: number;

  @ApiProperty({
    enum: ReferralStatus,
    description: 'Referral status',
    default: ReferralStatus.PENDING,
  })
  @Column({
    type: 'varchar',
    length: 20,
    default: ReferralStatus.PENDING,
    nullable: true,
  })
  status?: ReferralStatus;

  @ApiProperty({ description: 'Date when referral was created' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Date when referral was last updated' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referrer_id' })
  referrer: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'referred_user_id' })
  referredUser?: User;
}

