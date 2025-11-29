import { ApiProperty } from '@nestjs/swagger';
import { MessageType } from '../../../types/message.types';

export class MessageResponseDto {
  @ApiProperty({
    description: 'Message ID',
    example: 'msg_1234567890',
  })
  messageId: string;

  @ApiProperty({
    description: 'Message type',
    enum: MessageType,
    example: MessageType.TEXT,
  })
  type: MessageType;

  @ApiProperty({
    description: 'Response content',
    example: {
      type: 'text',
      text: 'Hello! Your message has been processed.',
    },
  })
  content: {
    type: MessageType;
    text?: string;
    audioUrl?: string;
    fileUrl?: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    thumbnailUrl?: string;
    duration?: number;
    [key: string]: unknown;
  };

  @ApiProperty({
    description: 'Response metadata',
    example: {
      workflowId: 'workflow_123',
      timestamp: '2025-11-29T00:00:00.000Z',
    },
  })
  metadata?: Record<string, unknown>;
}

