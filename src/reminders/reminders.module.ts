import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { RemindersService } from './reminders.service';
import { ReminderExtractionService } from './reminder-extraction.service';
import { Reminder } from './entities/reminder.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Reminder]), ConfigModule],
  providers: [RemindersService, ReminderExtractionService],
  exports: [RemindersService, ReminderExtractionService],
})
export class RemindersModule {}

