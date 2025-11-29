import { Injectable, Logger } from '@nestjs/common';

export interface BotCommand {
  command: string;
  description: string;
  category?: string;
}

export enum CommandCategory {
  ACCOUNT = 'Account & Credits',
  MARITIME = 'Maritime Operations',
  FLEET = 'Fleet Management',
  REMINDERS = 'Reminders',
  GENERAL = 'General',
}

@Injectable()
export class CommandsService {
  private readonly logger = new Logger(CommandsService.name);
  private readonly commands: BotCommand[] = [];

  constructor() {
    this.initializeCommands();
  }

  /**
   * Initialize all bot commands
   * This is platform-agnostic and can be used by Telegram, WhatsApp, Web Chat, etc.
   */
  private initializeCommands(): void {
    // Account & Credits
    this.commands.push(
      {
        command: 'credits',
        description: 'View your credit usage and subscription details',
        category: CommandCategory.ACCOUNT,
      },
      {
        command: 'subscribe',
        description: 'Subscribe to Basic or Pro plans',
        category: CommandCategory.ACCOUNT,
      },
    );

    // Maritime Operations
    this.commands.push(
      {
        command: 'vessel',
        description: 'Fetch AIS details by name/IMO/MMSI',
        category: CommandCategory.MARITIME,
      },
      {
        command: 'specs',
        description: 'Fetch vessel specifications by name/IMO/MMSI',
        category: CommandCategory.MARITIME,
      },
      {
        command: 'port',
        description: 'Search ports by WPI number or name',
        category: CommandCategory.MARITIME,
      },
    );

    // Fleet Management
    this.commands.push(
      {
        command: 'fleet_create',
        description: 'Create a new fleet',
        category: CommandCategory.FLEET,
      },
      {
        command: 'fleet_list',
        description: 'View all your fleets',
        category: CommandCategory.FLEET,
      },
      {
        command: 'fleet_rename',
        description: 'Rename a fleet',
        category: CommandCategory.FLEET,
      },
      {
        command: 'fleet_delete',
        description: 'Delete a fleet and all its vessels',
        category: CommandCategory.FLEET,
      },
      {
        command: 'fleet_vessel_add',
        description: 'Add a vessel to a fleet',
        category: CommandCategory.FLEET,
      },
      {
        command: 'fleet_vessel_remove',
        description: 'Remove a vessel from a fleet',
        category: CommandCategory.FLEET,
      },
      {
        command: 'fleet_vessels',
        description: 'List all vessels in a fleet',
        category: CommandCategory.FLEET,
      },
    );

    // Reminders
    this.commands.push(
      {
        command: 'reminder',
        description: 'Create a vessel reminder',
        category: CommandCategory.REMINDERS,
      },
      {
        command: 'reminders',
        description: 'List your active reminders',
        category: CommandCategory.REMINDERS,
      },
      {
        command: 'delete_reminder',
        description: 'Delete a reminder by list number',
        category: CommandCategory.REMINDERS,
      },
    );

    // General
    this.commands.push({
      command: 'help',
      description: 'Show help message with all commands',
      category: CommandCategory.GENERAL,
    });

    this.logger.debug(`Initialized ${this.commands.length} bot commands`);
  }

  /**
   * Get all commands
   */
  getAllCommands(): BotCommand[] {
    return [...this.commands];
  }

  /**
   * Get commands by category
   */
  getCommandsByCategory(category: CommandCategory): BotCommand[] {
    return this.commands.filter((cmd) => cmd.category === category);
  }

  /**
   * Get commands formatted for Telegram Bot API
   * Returns array in format: [{ command: string, description: string }]
   */
  getTelegramCommands(): Array<{ command: string; description: string }> {
    return this.commands.map((cmd) => ({
      command: cmd.command,
      description: cmd.description,
    }));
  }

  /**
   * Get commands formatted for WhatsApp (if needed in future)
   */
  getWhatsAppCommands(): BotCommand[] {
    // WhatsApp might have different format, can be customized later
    return this.commands;
  }

  /**
   * Get commands formatted for Web Chat (if needed in future)
   */
  getWebChatCommands(): BotCommand[] {
    // Web Chat might have different format, can be customized later
    return this.commands;
  }

  /**
   * Get help message formatted for display
   */
  getHelpMessage(platform?: string): string {
    const categories = Object.values(CommandCategory);
    let helpText = '📋 *Available Commands*\n\n';

    for (const category of categories) {
      const categoryCommands = this.getCommandsByCategory(category);
      if (categoryCommands.length > 0) {
        helpText += `*${category}:*\n`;
        for (const cmd of categoryCommands) {
          helpText += `  /${cmd.command} - ${cmd.description}\n`;
        }
        helpText += '\n';
      }
    }

    return helpText.trim();
  }

  /**
   * Check if a message is a command
   */
  isCommand(text: string): boolean {
    if (!text) return false;
    const trimmed = text.trim();
    return trimmed.startsWith('/') && trimmed.length > 1;
  }

  /**
   * Extract command from message text
   */
  extractCommand(text: string): string | null {
    if (!this.isCommand(text)) return null;
    const trimmed = text.trim();
    const parts = trimmed.split(/\s+/);
    return parts[0].substring(1); // Remove the leading '/'
  }

  /**
   * Get command arguments (everything after the command)
   */
  extractCommandArgs(text: string): string {
    if (!this.isCommand(text)) return '';
    const trimmed = text.trim();
    const parts = trimmed.split(/\s+/);
    parts.shift(); // Remove the command
    return parts.join(' ');
  }
}

