import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsBoolean, IsEmail, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { UserStatus } from '../entities/user.entity';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe', description: 'User name', maxLength: 100 })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'user@example.com', description: 'User email', maxLength: 100 })
  @IsEmail()
  @IsOptional()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ example: '+1234567890', description: 'Phone number', maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'REF123', description: 'Referral code', maxLength: 50 })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Matches(/^[A-Z0-9]+$/, { message: 'Referral code must be alphanumeric uppercase' })
  referralCode?: string;

  @ApiPropertyOptional({ description: 'User status', enum: UserStatus })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Email verified status', type: Boolean })
  @IsBoolean()
  @IsOptional()
  emailVerified?: boolean;
}
