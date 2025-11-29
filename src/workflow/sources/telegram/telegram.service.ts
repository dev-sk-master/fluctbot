/**
 * Telegram Bot Service
 * Handles Telegram Bot API integration using node-telegram-bot-api
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import TelegramBot from 'node-telegram-bot-api';
import {
  FluctMessage,
  MessageSource,
  MessageType,
  MessageStatus,
  MessageMetadata,
  MessageContent,
} from '../../types/message.types';
import { WorkflowService } from '../../services/workflow.service';
import { forwardRef, Inject } from '@nestjs/common';
import { MessageResponse } from '../../types/message.types';
import { NgrokService } from '../../../common/ngrok/ngrok.service';
import { CommandsService } from '../../../common/services/commands.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: TelegramBot | null = null;
  private botToken: string;
  private botUsername: string;
  private defaultWorkflowId: string;
  private useWebhook: boolean;
  private webhookUrl?: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WorkflowService))
    private readonly workflowService?: WorkflowService,
    private readonly ngrokService?: NgrokService,
    private readonly commandsService?: CommandsService,
  ) {}

  async onModuleInit() {
    this.botToken =
      this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    this.botUsername =
      this.configService.get<string>('TELEGRAM_BOT_USERNAME') || '';
    this.useWebhook =
      this.configService.get<string>('TELEGRAM_USE_WEBHOOK') === 'true';
    this.webhookUrl = this.configService.get<string>('TELEGRAM_WEBHOOK_URL');

    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not configured');
      return;
    }

    try {
      // Initialize bot
      if (this.useWebhook) {
        // Webhook mode - don't set up polling handlers
        // Webhook will be handled via controller endpoint
        this.bot = new TelegramBot(this.botToken);

        let webhookSet = false;

        // If webhook URL is not set, try to get it from ngrok
        if (!this.webhookUrl || this.webhookUrl.trim() === '') {
          this.logger.log(
            'TELEGRAM_WEBHOOK_URL not set, attempting to detect ngrok tunnel...',
          );

          if (this.ngrokService) {
            // Get or start ngrok automatically
            const ngrokUrl = await this.ngrokService.getOrStartNgrok();

            if (ngrokUrl) {
              // Get API prefix from config
              const apiPrefix = this.configService.get<string>('API_PREFIX') || 'api/v1';
              this.webhookUrl = `${ngrokUrl}/${apiPrefix}/telegram/webhook`;
              this.logger.log(
                `✅ Detected ngrok URL: ${ngrokUrl}`,
              );
              this.logger.log(
                `✅ Constructed webhook URL: ${this.webhookUrl}`,
              );
              
              // Automatically set the webhook
              try {
                await this.setWebhook(this.webhookUrl);
                webhookSet = true;
                this.logger.log(
                  `✅ Webhook automatically set to: ${this.webhookUrl}`,
                );
              } catch (error) {
                this.logger.error(
                  `❌ Failed to set webhook automatically: ${error instanceof Error ? error.message : String(error)}`,
                );
                this.logger.warn(
                  'You can manually set the webhook using: GET /api/v1/telegram/set-webhook',
                );
              }
            } else {
              const appPort = this.configService.get<string>('PORT') || '3000';
              this.logger.error(
                `❌ Failed to start ngrok for port ${appPort}.`,
              );
              this.logger.error(
                `Please ensure ngrok is installed and in your PATH, or start ngrok manually with: ngrok http ${appPort}`,
              );
              this.logger.error(
                `Install ngrok from: https://ngrok.com/download`,
              );
              this.logger.warn(
                'Falling back to polling mode. Set TELEGRAM_USE_WEBHOOK=false or fix ngrok setup.',
              );
              // Fallback to polling
              this.bot = new TelegramBot(this.botToken, { polling: true });
              this.setupHandlers();
              return;
            }
          } else {
            this.logger.error(
              'NgrokService not available. Please set TELEGRAM_WEBHOOK_URL or install ngrok dependencies.',
            );
            this.logger.warn('Falling back to polling mode.');
            // Fallback to polling
            this.bot = new TelegramBot(this.botToken, { polling: true });
            this.setupHandlers();
            return;
          }
        }

        this.logger.log(
          `Telegram bot initialized in webhook mode. Webhook URL: ${this.webhookUrl}`,
        );

        // Set webhook if URL is available and not already set (from ngrok detection above)
        if (this.webhookUrl && !webhookSet) {
          // Set webhook if it was provided manually via TELEGRAM_WEBHOOK_URL
          await this.setWebhook(this.webhookUrl);
          this.logger.log(`✅ Webhook set to: ${this.webhookUrl}`);
        } else if (webhookSet) {
          // Webhook was already set during ngrok detection
          this.logger.log('Webhook already set during ngrok auto-detection');
        }
      } else {
        // Polling mode (for development)
        this.bot = new TelegramBot(this.botToken, { polling: true });
        this.logger.log('Telegram bot initialized in polling mode');

        // Set up message handlers for polling
        this.setupHandlers();
      }

      this.logger.log(
        `Telegram bot initialized${this.botUsername ? ` (@${this.botUsername})` : ''}`,
      );

      // Set up bot commands
      await this.setupBotCommands();
    } catch (error) {
      this.logger.error(
        `Failed to initialize Telegram bot: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.bot) {
      if (this.useWebhook) {
        // Optionally delete webhook on shutdown
         await this.bot.deleteWebHook();
      } else {
        this.bot.stopPolling();
      }
      this.logger.log('Telegram bot stopped');
    }
  }

  /**
   * Set up bot message handlers
   */
  private setupHandlers(): void {
    if (!this.bot) return;

    // Handle text messages
    this.bot.on('message', async (msg: TelegramBot.Message) => {
      try {
        const message = this.convertToFluctMessage(msg);
        if (!message) {
          this.logger.debug('No message content, skipping');
          return;
        }

        this.logger.log(
          `Received message ${message.id} from chat ${message.metadata.chatId}`,
        );

        // Execute workflow if available
        // Note: The TelegramOutputNode will handle sending the response,
        // so we don't need to send it again here
        if (this.workflowService) {
          await this.workflowService.executeWorkflow(
            'unified-workflow',
            message,
          );
        } else {
          this.logger.warn('WorkflowService not available, skipping workflow execution');
        }
      } catch (error) {
        this.logger.error(
          `Error handling message: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    // Handle errors
    this.bot.on('error', (error: Error) => {
      this.logger.error(`Telegram bot error: ${error.message}`);
    });

    // Handle polling errors
    this.bot.on('polling_error', (error: Error) => {
      this.logger.error(`Telegram polling error: ${error.message}`);
    });
  }

  /**
   * Convert Telegram message to FluctMessage
   */
  convertToFluctMessage(msg: TelegramBot.Message): FluctMessage | null {
    if (!msg) {
      return null;
    }

    const messageId = `tg_${msg.message_id}_${msg.date}`;
    const userId = msg.from?.id.toString() || 'unknown';
    const chatId = msg.chat.id.toString();

    // Determine message type and content
    let content: MessageContent;

    if (msg.text) {
      content = {
        type: MessageType.TEXT,
        text: msg.text,
      };
    } else if (msg.audio) {
      content = {
        type: MessageType.AUDIO,
        audioUrl: msg.audio.file_id,
        duration: msg.audio.duration,
        mimeType: msg.audio.mime_type,
        fileSize: msg.audio.file_size,
      };
    } else if (msg.document) {
      content = {
        type: MessageType.DOCUMENT,
        fileUrl: msg.document.file_id,
        fileName: msg.document.file_name,
        mimeType: msg.document.mime_type,
        fileSize: msg.document.file_size,
      };
    } else if (msg.photo && msg.photo.length > 0) {
      const photo = msg.photo[msg.photo.length - 1]; // Get largest
      content = {
        type: MessageType.IMAGE,
        fileUrl: photo.file_id,
        fileSize: photo.file_size,
      };
    } else if (msg.video) {
      content = {
        type: MessageType.VIDEO,
        fileUrl: msg.video.file_id,
        duration: msg.video.duration,
        mimeType: msg.video.mime_type,
        fileSize: msg.video.file_size,
      };
    } else if (msg.voice) {
      content = {
        type: MessageType.AUDIO,
        audioUrl: msg.voice.file_id,
        duration: msg.voice.duration,
        mimeType: msg.voice.mime_type,
        fileSize: msg.voice.file_size,
      };
    } else {
      // Unknown type, default to text
      content = {
        type: MessageType.TEXT,
        text: '[Unsupported message type]',
      };
    }

    const metadata: MessageMetadata = {
      source: MessageSource.TELEGRAM,
      sourceId: msg.message_id.toString(),
      userId,
      chatId,
      timestamp: new Date(msg.date * 1000),

      // Raw source payload for downstream nodes (mentions, entities, etc.)
      payload: msg,
    };

    const message: FluctMessage = {
      id: messageId,
      metadata,
      content,
      status: MessageStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return message;
  }

  /**
   * Process Telegram webhook update (for webhook mode)
   */
  async handleUpdate(update: TelegramBot.Update): Promise<void> {
    try {
      if (update.message) {
        const message = this.convertToFluctMessage(update.message);
        if (!message) {
          this.logger.debug('No message content, skipping');
          return;
        }

        this.logger.log(
          `Processing Telegram message ${message.id} from chat ${message.metadata.chatId}`,
        );

        // Execute workflow if available
        // Note: The TelegramOutputNode will handle sending the response,
        // so we don't need to send it again here
        if (this.workflowService) {
          await this.workflowService.executeWorkflow(
            'unified-workflow',
            message,
          );
        } else {
          this.logger.warn('WorkflowService not available, skipping workflow execution');
        }
      }
    } catch (error) {
      this.logger.error(
        `Error processing Telegram update: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send message to Telegram using Bot API
   */
  async sendMessage(
    chatId: string,
    content: MessageContent,
  ): Promise<TelegramBot.Message | null> {
    if (!this.bot) {
      this.logger.error('Bot not initialized');
      return null;
    }

    try {
      switch (content.type) {
        case MessageType.TEXT:
          if (content.text) {
            const sent = await this.bot.sendMessage(chatId, content.text, {
              parse_mode: 'HTML',
            });
            this.logger.debug(`Sent text message to chat ${chatId}`);
            return sent;
          }
          break;

        case MessageType.AUDIO:
          if (content.audioUrl) {
            // For audio, we need to download the file first if it's a file_id
            // For now, we'll send it as a document
            const sent = await this.bot.sendAudio(chatId, content.audioUrl, {
              duration: content.duration,
            });
            this.logger.debug(`Sent audio message to chat ${chatId}`);
            return sent;
          }
          break;

        case MessageType.IMAGE:
          if (content.fileUrl) {
            const sent = await this.bot.sendPhoto(chatId, content.fileUrl);
            this.logger.debug(`Sent image to chat ${chatId}`);
            return sent;
          }
          break;

        case MessageType.VIDEO:
          if (content.fileUrl) {
            const sent = await this.bot.sendVideo(chatId, content.fileUrl, {
              duration: content.duration,
            });
            this.logger.debug(`Sent video to chat ${chatId}`);
            return sent;
          }
          break;

        case MessageType.DOCUMENT:
          if (content.fileUrl) {
            const sent = await this.bot.sendDocument(chatId, content.fileUrl, {
              caption: content.fileName,
            });
            this.logger.debug(`Sent document to chat ${chatId}`);
            return sent;
          }
          break;

        default:
          this.logger.warn(`Unsupported message type: ${content.type}`);
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Error sending message to Telegram: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get bot instance (for advanced usage)
   */
  getBot(): TelegramBot | null {
    return this.bot;
  }

  /**
   * Set webhook URL (for webhook mode)
   */
  async setWebhook(url: string, secretToken?: string): Promise<void> {
    if (!this.bot) {
      throw new Error('Bot not initialized');
    }

    try {
      await this.bot.setWebHook(url, {
        secret_token: secretToken,
      });
      this.logger.log(`Webhook set to: ${url}`);
    } catch (error) {
      this.logger.error(
        `Failed to set webhook: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(): Promise<void> {
    if (!this.bot) {
      throw new Error('Bot not initialized');
    }

    try {
      await this.bot.deleteWebHook();
      this.logger.log('Webhook deleted');
    } catch (error) {
      this.logger.error(
        `Failed to delete webhook: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Set up bot commands for Telegram
   * This uses the platform-agnostic CommandsService
   * Other platforms (WhatsApp, Web Chat) can use the same service with their own implementations
   */
  async setupBotCommands(): Promise<void> {

    if (!this.bot) {
      this.logger.warn(
        '⚠️  Bot not initialized, skipping bot commands setup',
      );
      return;
    }

    if (!this.commandsService) {
      this.logger.warn(
        '⚠️  CommandsService not available, skipping bot commands setup',
      );
      return;
    }

    try {
      this.logger.log('🔄 Setting up bot commands...');

      // Get commands from the platform-agnostic CommandsService
      const commands = this.commandsService.getTelegramCommands();

      await this.bot.setMyCommands(commands);
      this.logger.log('✅ Bot commands registered successfully!');
      this.logCommandsSummary();
    } catch (error) {
      this.logger.error(
        `❌ Failed to setup bot commands automatically: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Log a summary of registered commands
   */
  private logCommandsSummary(): void {
    if (!this.commandsService) return;

    const categories = this.commandsService.getAllCommands().reduce(
      (acc, cmd) => {
        const category = cmd.category || 'General';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(cmd.command);
        return acc;
      },
      {} as Record<string, string[]>,
    );

    this.logger.log('   Registered command categories:');
    for (const [category, commands] of Object.entries(categories)) {
      this.logger.log(`   ${category}: ${commands.map((c) => `/${c}`).join(', ')}`);
    }
  }
}

