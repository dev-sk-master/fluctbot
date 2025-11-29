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
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

@Entity('reminders')
@Index('idx_reminders_is_active', ['isActive'])
@Index('idx_reminders_last_checked', ['lastCheckedAt'])
@Index('idx_reminders_user_id', ['userId'])
export class Reminder {
  @ApiProperty({ description: 'Reminder ID' })
  @PrimaryGeneratedColumn('increment') // serial
  id: number;

  @ApiProperty({ description: 'User ID' })
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @ApiProperty({ description: 'Type of reminder', required: false })
  @Column({ type: 'varchar', length: 255, name: 'reminder_type', nullable: true })
  reminderType?: string;

  @ApiProperty({ description: 'User query text', required: false })
  @Column({ type: 'text', name: 'user_query', nullable: true })
  userQuery?: string;

  @ApiProperty({
    description: 'Search parameters as JSON',
    type: 'object',
    additionalProperties: true,
  })
  @Column({ type: 'jsonb', name: 'search_params' })
  searchParams: Record<string, any>;

  @ApiProperty({ description: 'Check interval in minutes', default: 5 })
  @Column({
    type: 'int',
    name: 'check_interval_minutes',
    default: 5,
    nullable: true,
  })
  checkIntervalMinutes?: number;

  @ApiProperty({ description: 'Whether reminder is active', default: true })
  @Column({ type: 'boolean', name: 'is_active', default: true, nullable: true })
  isActive?: boolean;

  @ApiProperty({ description: 'Last time reminder was checked', required: false })
  @Column({ type: 'timestamp', name: 'last_checked_at', nullable: true })
  lastCheckedAt?: Date;

  @ApiProperty({ description: 'Last time user was notified', required: false })
  @Column({ type: 'timestamp', name: 'last_notified_at', nullable: true })
  lastNotifiedAt?: Date;

  @ApiProperty({
    description: 'Last result as JSON',
    type: 'object',
    additionalProperties: true,
  })
  @Column({ type: 'jsonb', name: 'last_result', nullable: true })
  lastResult?: Record<string, any>;

  @ApiProperty({ description: 'Notification message', required: false })
  @Column({ type: 'text', name: 'notification_message', nullable: true })
  notificationMessage?: string;

  @ApiProperty({ description: 'Date when reminder was created' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Date when reminder was last updated' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

