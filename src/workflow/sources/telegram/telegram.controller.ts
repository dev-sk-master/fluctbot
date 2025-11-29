/**
 * Telegram Webhook Controller
 * Receives webhook updates from Telegram
 */

import { Controller, Post, Body, Headers, HttpCode, Get, Version } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TelegramService } from './telegram.service';
import { Public } from '../../../common/decorators/public.decorator';
import TelegramBot from 'node-telegram-bot-api';

@ApiTags('Telegram')
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive Telegram webhook updates' })
  @ApiResponse({ status: 200, description: 'Update processed' })
  async webhook(
    @Body() update: TelegramBot.Update,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ): Promise<{ ok: boolean }> {
    // TODO: Validate secret token if configured
    await this.telegramService.handleUpdate(update);
    return { ok: true };
  }

  @Get('set-webhook')
  @Public()
  @ApiOperation({ summary: 'Set Telegram webhook URL (for development)' })
  @ApiResponse({ status: 200, description: 'Webhook set' })
  async setWebhook(): Promise<{ ok: boolean; message: string }> {
    try {
      const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
      if (!webhookUrl) {
        return {
          ok: false,
          message: 'TELEGRAM_WEBHOOK_URL not configured in environment',
        };
      }

      await this.telegramService.setWebhook(webhookUrl);
      return {
        ok: true,
        message: `Webhook set to: ${webhookUrl}`,
      };
    } catch (error) {
      return {
        ok: false,
        message: `Failed to set webhook: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  @Get('delete-webhook')
  @Public()
  @ApiOperation({ summary: 'Delete Telegram webhook (switch to polling)' })
  @ApiResponse({ status: 200, description: 'Webhook deleted' })
  async deleteWebhook(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.telegramService.deleteWebhook();
      return {
        ok: true,
        message: 'Webhook deleted successfully',
      };
    } catch (error) {
      return {
        ok: false,
        message: `Failed to delete webhook: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
