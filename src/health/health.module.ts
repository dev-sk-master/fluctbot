import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseModule } from '../database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TerminusModule, TypeOrmModule],
  controllers: [HealthController],
})
export class HealthModule {}

