import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { MessagePlatform } from '../../workflow/types/message.types';

export class CreateCheckoutSessionDto {
  @ApiProperty({
    description: 'Subscription plan code',
    example: 'basic',
    enum: ['free', 'basic', 'pro'],
  })
  @IsNotEmpty()
  @IsString()
  planCode: string;

  @ApiProperty({
    description: 'User ID',
    example: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @ApiProperty({
    description: 'Platform where user is subscribing',
    enum: MessagePlatform,
    example: MessagePlatform.TELEGRAM,
  })
  @IsNotEmpty()
  @IsEnum(MessagePlatform)
  platform: MessagePlatform;

  @ApiProperty({
    description: 'Platform-specific identifier (e.g., Telegram chat ID)',
    example: '123456789',
  })
  @IsNotEmpty()
  @IsString()
  platformIdentifier: string;

  @ApiPropertyOptional({
    description: 'Specific Stripe price ID (monthly/yearly). If not provided, uses first available from plan.',
    example: 'price_1234567890',
  })
  @IsOptional()
  @IsString()
  priceId?: string;

  @ApiPropertyOptional({
    description: 'Custom success URL. If not provided, uses default based on platform.',
  })
  @IsOptional()
  @IsString()
  successUrl?: string;

  @ApiPropertyOptional({
    description: 'Custom cancel URL. If not provided, uses default based on platform.',
  })
  @IsOptional()
  @IsString()
  cancelUrl?: string;
}

