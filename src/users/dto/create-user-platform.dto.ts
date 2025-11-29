import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { Platform } from '../entities/user-platform.entity';

export class CreateUserPlatformDto {
  @ApiProperty({
    description: 'Platform type',
    enum: Platform,
    example: Platform.TELEGRAM,
  })
  @IsEnum(Platform)
  platform: Platform;

  @ApiProperty({
    description: 'Platform identifier (e.g., Telegram user ID)',
    example: '123456789',
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  platformIdentifier: string;
}

