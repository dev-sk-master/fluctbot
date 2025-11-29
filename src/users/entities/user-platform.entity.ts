import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from './user.entity';

export enum Platform {
  TELEGRAM = 'telegram',
  WHATSAPP = 'whatsapp',
  WEB = 'web',
}

@Entity('user_platforms')
@Unique(['platform', 'platformIdentifier'])
@Unique(['userId', 'platform'])
export class UserPlatform {
  @ApiProperty({ description: 'Platform link ID' })
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @ApiProperty({ description: 'User ID' })
  @Column({ type: 'bigint', name: 'user_id' })
  @Index()
  userId: number;

  @ApiProperty({ description: 'Platform type', enum: Platform })
  @Column({
    type: 'varchar',
    length: 20,
    enum: Platform,
  })
  platform: Platform;

  @ApiProperty({ description: 'Platform identifier (e.g., Telegram user ID)', maxLength: 100 })
  @Column({ type: 'varchar', length: 100, name: 'platform_identifier' })
  platformIdentifier: string;

  @ApiProperty({ description: 'When the platform was linked' })
  @CreateDateColumn({ type: 'timestamp', default: () => 'now()', name: 'linked_at' })
  linkedAt: Date;

  @ApiProperty({ description: 'User', type: () => User })
  @ManyToOne(() => User, (user) => user.platforms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

