import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reminder } from './entities/reminder.entity';

export interface CreateReminderData {
  user_id: number;
  reminder_type: string;
  user_query: string;
  search_params: Record<string, any>;
  check_interval_minutes?: number;
  notification_message?: string;
}

@Injectable()
export class RemindersService {
  constructor(
    @InjectRepository(Reminder)
    private readonly reminderRepository: Repository<Reminder>,
  ) {}

  async createReminder(reminderData: CreateReminderData): Promise<Reminder> {
    const reminder = this.reminderRepository.create({
      userId: reminderData.user_id,
      reminderType: reminderData.reminder_type,
      userQuery: reminderData.user_query,
      searchParams: reminderData.search_params,
      checkIntervalMinutes: reminderData.check_interval_minutes || 5,
      notificationMessage: reminderData.notification_message,
      isActive: true,
    });

    return await this.reminderRepository.save(reminder);
  }

  async getActiveReminders(userId?: number): Promise<Reminder[]> {
    const where: any = { isActive: true };
    if (userId) {
      where.userId = userId;
    }

    return await this.reminderRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async getReminderById(reminderId: number): Promise<Reminder | null> {
    return await this.reminderRepository.findOne({
      where: { id: reminderId },
    });
  }

  async updateReminderLastChecked(reminderId: number, result: any): Promise<void> {
    await this.reminderRepository.update(reminderId, {
      lastCheckedAt: new Date(),
      lastResult: result,
    });
  }

  async updateReminderLastNotified(reminderId: number): Promise<void> {
    await this.reminderRepository.update(reminderId, {
      lastNotifiedAt: new Date(),
    });
  }

  async deactivateReminder(reminderId: number): Promise<void> {
    await this.reminderRepository.update(reminderId, {
      isActive: false,
    });
  }

  async deleteReminder(reminderId: number): Promise<void> {
    await this.reminderRepository.delete(reminderId);
  }
}

