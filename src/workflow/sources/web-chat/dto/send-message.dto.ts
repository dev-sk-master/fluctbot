import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsUrl,
  IsNumber,
  ValidateIf,
} from 'class-validator';
import { MessageType } from '../../../types/message.types';

export class SendMessageDto {
  @ApiProperty({
    description: 'User identifier (e.g., user ID, email, or unique identifier)',
    example: 'user123',
  })
  @IsString()
  userId: string;

  @ApiPropertyOptional({
    description: 'Chat/Conversation ID (defaults to userId if not provided)',
    example: 'chat123',
  })
  @IsString()
  @IsOptional()
  chatId?: string;

  @ApiProperty({
    description: 'Message type',
    enum: MessageType,
    example: MessageType.TEXT,
  })
  @IsEnum(MessageType)
  type: MessageType;

  @ApiPropertyOptional({
    description: 'Text content (required for TEXT type)',
    example: 'Hello, this is a test message',
  })
  @ValidateIf((o) => o.type === MessageType.TEXT)
  @IsString()
  text?: string;

  @ApiPropertyOptional({
    description: 'Audio file URL (required for AUDIO type)',
    example: 'https://example.com/audio.mp3',
  })
  @ValidateIf((o) => o.type === MessageType.AUDIO)
  @IsUrl()
  audioUrl?: string;

  @ApiPropertyOptional({
    description: 'File URL (required for FILE/DOCUMENT type)',
    example: 'https://example.com/document.pdf',
  })
  @ValidateIf((o) => o.type === MessageType.FILE || o.type === MessageType.DOCUMENT)
  @IsUrl()
  fileUrl?: string;

  @ApiPropertyOptional({
    description: 'File name',
    example: 'document.pdf',
  })
  @IsString()
  @IsOptional()
  fileName?: string;

  @ApiPropertyOptional({
    description: 'MIME type',
    example: 'application/pdf',
  })
  @IsString()
  @IsOptional()
  mimeType?: string;

  @ApiPropertyOptional({
    description: 'File size in bytes',
    example: 1024000,
  })
  @IsNumber()
  @IsOptional()
  fileSize?: number;

  @ApiPropertyOptional({
    description: 'Image URL (required for IMAGE type)',
    example: 'https://example.com/image.jpg',
  })
  @ValidateIf((o) => o.type === MessageType.IMAGE)
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Video URL (required for VIDEO type)',
    example: 'https://example.com/video.mp4',
  })
  @ValidateIf((o) => o.type === MessageType.VIDEO)
  @IsUrl()
  videoUrl?: string;

  @ApiPropertyOptional({
    description: 'Thumbnail URL',
    example: 'https://example.com/thumbnail.jpg',
  })
  @IsUrl()
  @IsOptional()
  thumbnailUrl?: string;

  @ApiPropertyOptional({
    description: 'Duration in seconds (for audio/video)',
    example: 120,
  })
  @IsNumber()
  @IsOptional()
  duration?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { customField: 'value' },
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

