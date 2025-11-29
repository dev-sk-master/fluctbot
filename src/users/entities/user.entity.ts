import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserPlatform } from './user-platform.entity';

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned',
}

@Entity('users')
export class User {
  @ApiProperty({ description: 'User ID' })
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @ApiProperty({ description: 'User name', maxLength: 100 })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ApiPropertyOptional({ description: 'User email', maxLength: 100 })
  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  @Index('users_email_key', { unique: true })
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number', maxLength: 20 })
  @Column({ type: 'varchar', length: 20, nullable: true, name: 'phone_number' })
  phoneNumber?: string;

  @ApiProperty({ description: 'Account creation date' })
  @CreateDateColumn({ type: 'timestamp', default: () => 'now()', name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  @UpdateDateColumn({ type: 'timestamp', default: () => 'now()', name: 'updated_at' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Last active timestamp' })
  @Column({ type: 'timestamp', nullable: true, name: 'last_active_at' })
  lastActiveAt?: Date;

  @ApiProperty({ description: 'User status', enum: UserStatus, default: UserStatus.ACTIVE })
  @Column({
    type: 'varchar',
    length: 20,
    default: UserStatus.ACTIVE,
    enum: UserStatus,
  })
  status: UserStatus;

  @ApiPropertyOptional({ description: 'Referral code', maxLength: 50 })
  @Column({ type: 'varchar', length: 50, nullable: true, unique: true, name: 'referral_code' })
  @Index('users_referral_code_key', { unique: true })
  referralCode?: string;

  @ApiProperty({ description: 'Email verified status', default: false })
  @Column({ type: 'boolean', default: false, name: 'email_verified' })
  emailVerified: boolean;

  @ApiProperty({ description: 'User platforms', type: () => [UserPlatform] })
  @OneToMany(() => UserPlatform, (platform) => platform.user, { cascade: true })
  platforms: UserPlatform[];
}
