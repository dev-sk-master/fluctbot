import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
import { ConversationMessage } from './conversation-message.entity';

@Entity('conversations')
@Index('idx_conversations_user_platform_identifier', ['userId', 'platform', 'platformIdentifier'], {
  unique: true,
})
export class Conversation {
  @ApiProperty({ description: 'Conversation ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'User ID' })
  @Column({ name: 'user_id', type: 'bigint' })
  @Index('idx_conversations_user_id')
  userId: number;

  @ApiProperty({ description: 'Platform source', enum: ['telegram', 'web_chat', 'whatsapp'] })
  @Column({ type: 'varchar', length: 50 })
  @Index('idx_conversations_user_platform', ['userId', 'platform'])
  platform: string;

  @ApiProperty({ description: 'Platform-specific identifier (chat_id, session_id, etc.)' })
  @Column({ name: 'platform_identifier', type: 'varchar', length: 255 })
  @Index('idx_conversations_platform_identifier')
  platformIdentifier: string;

  @ApiProperty({ description: 'Persistent thread ID for conversation continuity' })
  @Column({ name: 'thread_id', type: 'varchar', length: 255, unique: true })
  @Index('idx_conversations_thread_id', { unique: true })
  threadId: string;

  @ApiPropertyOptional({ description: 'Conversation title' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  title?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Last message timestamp' })
  @Column({ name: 'last_message_at', type: 'timestamp', nullable: true })
  @Index('idx_conversations_last_message')
  lastMessageAt?: Date;

  @ApiProperty({ description: 'Archived status', default: false })
  @Column({ name: 'is_archived', type: 'boolean', default: false })
  isArchived: boolean;

  @ApiProperty({ description: 'User', type: () => User })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({ description: 'Conversation messages', type: () => [ConversationMessage] })
  @OneToMany(() => ConversationMessage, (message) => message.conversation, { cascade: true })
  messages: ConversationMessage[];
}

