import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Conversation } from './conversation.entity';

@Entity('conversation_messages')
export class ConversationMessage {
  @ApiProperty({ description: 'Message ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Conversation ID' })
  @Column({ name: 'conversation_id', type: 'uuid' })
  @Index('idx_conversation_messages_conversation_id')
  conversationId: string;

  @ApiProperty({ description: 'Original FluctMessage ID' })
  @Column({ name: 'message_id', type: 'varchar', length: 255 })
  messageId: string;

  @ApiProperty({ description: 'Message role', enum: ['user', 'assistant', 'system', 'tool'] })
  @Column({ type: 'varchar', length: 20 })
  @Index('idx_conversation_messages_role')
  role: 'user' | 'assistant' | 'system' | 'tool';

  @ApiProperty({ description: 'Content type', enum: ['text', 'image', 'audio', 'file', 'multimodal'] })
  @Column({ name: 'content_type', type: 'varchar', length: 50 })
  contentType: string;

  @ApiPropertyOptional({ description: 'Text content or caption' })
  @Column({ name: 'content_text', type: 'text', nullable: true })
  contentText?: string;

  @ApiPropertyOptional({ description: 'Full message content structure (for multimodal)' })
  @Column('jsonb', { name: 'content_data', nullable: true })
  contentData?: any;

  @ApiPropertyOptional({ description: 'Original message metadata' })
  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @ApiPropertyOptional({ description: 'Tool execution details', type: 'array' })
  @Column('jsonb', { name: 'tool_calls', nullable: true })
  toolCalls?: any[];

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  @Index('idx_conversation_messages_created_at')
  createdAt: Date;

  @ApiProperty({ description: 'Conversation', type: () => Conversation })
  @ManyToOne(() => Conversation, (conversation) => conversation.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;
}

