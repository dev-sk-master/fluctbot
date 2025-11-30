import { Injectable, Logger } from '@nestjs/common';
import { BaseNode } from '../../core/base-node';
import {
  NodeExecutionContext,
  NodeExecutionResult,
} from '../../types/workflow.types';
import { FluctMessage, MessageType, MessageContent } from '../../types/message.types';
import { WorkflowNodeContext } from '../../services/workflow-node-context';
import { Platform } from '../../../users/entities/user-platform.entity';

export interface CommandConfig {
  [key: string]: unknown;
}

export interface CommandResult {
  success: boolean;
  message: string;
  action?: string;
}

@Injectable()
export class CommandNode extends BaseNode {
  private readonly logger = new Logger(CommandNode.name);

  constructor(
    id: string,
    name: string,
    config: CommandConfig = {},
    private readonly context: WorkflowNodeContext,
  ) {
    super(id, name, 'command', config);
  }

  protected async prep(
    context: NodeExecutionContext,
  ): Promise<{ command: string | null; args: string }> {
    //this.logger.debug(`[prep] Context:\n${JSON.stringify(context, null, 2)}`);
    // Get message from sharedData (set by input nodes)
    const message = context.sharedData.message as FluctMessage;

    // Extract command and args
    let command: string | null = null;
    let args = '';

    if (message.content.type === MessageType.TEXT && message.content.text) {
      const text = message.content.text.trim();
      if (this.context.services.commandsService.isCommand(text)) {
        command = this.context.services.commandsService.extractCommand(text);
        args = this.context.services.commandsService.extractCommandArgs(text);
        this.logger.debug(`Command detected: /${command}, args: "${args}"`);
      }
    }

    return { command, args };
  }

  protected async exec(
    prepResult: unknown,
    context: NodeExecutionContext,
  ): Promise<CommandResult> {
    //this.logger.debug(`[exec] Context:\n${JSON.stringify(context, null, 2)}`);
    //this.logger.debug(`[exec] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    
    // Get message from sharedData (set by input nodes)
    const message = context.sharedData.message as FluctMessage;
    const { command, args } = prepResult as {
      command: string | null;
      args: string;
    };

    // Get user from sharedData (set by access-control node)
    const user = context.sharedData['user'] || null;

    // If not a command, return success to continue to next node
    if (!command) {
      this.logger.debug('Not a command, passing through');
      return {
        success: true,
        message: '',
        action: 'continue',
      };
    }

    // Route to appropriate command handler
    try {
      let result: CommandResult;

      switch (command) {
        case 'help':
          result = await this.handleHelpCommand();
          break;

        case 'credits':
          result = await this.handleCreditsCommand(user);
          break;

        case 'subscribe':
          result = await this.handleSubscribeCommand(user);
          break;

        // Fleet commands
        case 'fleet_create':
          result = await this.handleFleetCreateCommand(args, user);
          break;
        case 'fleet_list':
          result = await this.handleFleetListCommand(user);
          break;
        case 'fleet_rename':
          result = await this.handleFleetRenameCommand(args, user);
          break;
        case 'fleet_delete':
          result = await this.handleFleetDeleteCommand(args, user);
          break;
        case 'fleet_vessel_add':
          result = await this.handleFleetVesselAddCommand(args, user);
          break;
        case 'fleet_vessel_remove':
          result = await this.handleFleetVesselRemoveCommand(args, user);
          break;
        case 'fleet_vessels':
          result = await this.handleFleetVesselsCommand(args, user);
          break;

        // Reminder commands
        case 'reminder':
          result = await this.handleReminderCommand(args, user);
          break;
        case 'reminders':
          result = await this.handleListRemindersCommand(user);
          break;
        case 'delete_reminder':
          result = await this.handleDeleteReminderCommand(args, user);
          break;

        // Maritime commands (placeholder for future implementation)
        case 'vessel':
        case 'specs':
        case 'port':
          result = {
            success: false,
            message: `🚧 Command /${command} is coming soon!`,
          };
          break;

        default:
          result = {
            success: false,
            message: `❌ Unknown command: /${command}\n\nUse /help to see all available commands.`,
          };
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Error handling command /${command}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        message: 'Sorry, there was an error processing your command. Please try again later.',
      };
    }
  }

  protected async post(
    context: NodeExecutionContext,
    prepResult: unknown,
    execResult: unknown,
  ): Promise<string | undefined> {
    //this.logger.debug(`[post] Context:\n${JSON.stringify(context, null, 2)}`);
    //this.logger.debug(`[post] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    //this.logger.debug(`[post] ExecResult:\n${JSON.stringify(execResult, null, 2)}`);
    
    const result = execResult as CommandResult;

    // Command node should only receive commands (access-control routes non-commands to echo-processor)
    // This check is a safety fallback
    if (result.action === 'continue') {
      this.logger.warn('Command node received non-command message - this should not happen');
      return 'continue';
    }

    // Store command response in shared data for output node
    if (result.message) {
      context.sharedData.commandResponse = result.message;
      context.sharedData.processedContent = {
        type: MessageType.TEXT,
        text: result.message,
      } as MessageContent;
    }

    // Return action based on result
    return result.success ? 'command_success' : 'command_error';
  }

  // ==================== Command Handlers ====================

  private async handleHelpCommand(): Promise<CommandResult> {
    const helpMessage = this.context.services.commandsService.getHelpMessage();
    return {
      success: true,
      message: helpMessage,
    };
  }

  private async handleCreditsCommand(user: any): Promise<CommandResult> {
    try {
      // User is guaranteed to exist by access-control
      // Get subscription details
      const subscription = await this.context.services.subscriptionsService.getUserActiveSubscription(user.id);

      if (!subscription) {
        return {
          success: false,
          message: 'You do not have an active subscription. Please use /start to set up your account.',
        };
      }

      // Format subscription details
      let message = '💳 <b>Account & Credits</b>\n\n';
      message += '<b>📋 Subscription Details:</b>\n';
      message += `• <b>Tier:</b> ${subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)}\n`;
      message += `• <b>Status:</b> ${subscription.isActive ? '✅ Active' : '❌ Inactive'}\n`;
      message += `• <b>Credit Limit:</b> ${parseFloat(String(subscription.creditLimit)).toFixed(2)} credits\n`;
      message += `• <b>Period:</b> ${subscription.creditPeriodValue} ${subscription.creditPeriodUnit}${subscription.creditPeriodValue > 1 ? 's' : ''}\n`;

      if (subscription.startDate) {
        message += `• <b>Start Date:</b> ${this.formatDate(subscription.startDate)}\n`;
      }

      if (subscription.endDate) {
        message += `• <b>End Date:</b> ${this.formatDate(subscription.endDate)}\n`;
      } else if (subscription.durationDays) {
        const startDate = subscription.startDate || new Date();
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + subscription.durationDays);
        message += `• <b>End Date:</b> ${this.formatDate(endDate)}\n`;
      }

      // TODO: Add credit usage info when UserCreditsUsageService is available
      // const usageInfo = await this.userCreditsUsageService.getTokenUsageInfo(user.id);
      // message += `\n<b>💰 Credit Usage:</b>\n`;
      // message += `• Used: ${usageInfo.used.total.toFixed(8)} credits\n`;
      // message += `• Remaining: ${usageInfo.remaining.total.toFixed(8)} credits\n`;

      return {
        success: true,
        message,
      };
    } catch (error) {
      this.logger.error(`Error getting credits info: ${error}`);
      return {
        success: false,
        message: 'Sorry, there was an error retrieving your credit information. Please try again later.',
      };
    }
  }

  private async handleSubscribeCommand(user: any): Promise<CommandResult> {
    // TODO: Implement subscription flow
    return {
      success: false,
      message: '🚧 Subscription management is coming soon!',
    };
  }

  // ==================== Fleet Command Handlers ====================

  private async handleFleetCreateCommand(fleetName: string, user: any): Promise<CommandResult> {
    try {
      // User is guaranteed to exist by access-control
      if (!fleetName || fleetName.trim().length === 0) {
        return {
          success: false,
          message: '<b>Error:</b> Please provide a fleet name.\n\n<b>Usage:</b> /fleet_create &lt;name&gt;\n\n<b>Example:</b> /fleet_create "My Shipping Fleet"',
        };
      }

      const fleet = await this.context.services.fleetsService.createFleet({
        userId: user.id,
        name: fleetName.trim(),
        description: '',
      });

      return {
        success: true,
        message: `✅ <b>Fleet Created!</b>\n\n<b>Name:</b> ${fleet.name}\n\nUse /fleet_list to see all your fleets.`,
      };
    } catch (error) {
      this.logger.error(`Error creating fleet: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        message: 'Sorry, there was an error creating the fleet. Please try again later.',
      };
    }
  }

  private async handleFleetListCommand(user: any): Promise<CommandResult> {
    try {
      // User is guaranteed to exist by access-control
      const fleets = await this.context.services.fleetsService.getUserFleets(user.id);

      if (fleets.length === 0) {
        return {
          success: true,
          message: '📋 <b>No Fleets</b>\n\nYou don\'t have any fleets yet. Use /fleet_create to create one.',
        };
      }

      let message = `📋 <b>Your Fleets (${fleets.length})</b>\n\n`;

      // Fetch vessel counts for each fleet
      for (const [index, fleet] of fleets.entries()) {
        const createdDate = new Date(fleet.createdAt).toLocaleDateString();
        const vessels = await this.context.services.fleetsService.getFleetVessels(fleet.id, user.id);
        const vesselCount = vessels.length;

        message += `${index + 1}. <b>${fleet.name}</b> (${vesselCount} vessel${vesselCount !== 1 ? 's' : ''})\n`;
        if (fleet.description) {
          message += `   ${fleet.description}\n`;
        }
        message += `   Created: ${createdDate}\n\n`;
      }

      return {
        success: true,
        message,
      };
    } catch (error) {
      this.logger.error(`Error listing fleets: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        message: 'Sorry, there was an error retrieving your fleets. Please try again later.',
      };
    }
  }

  private async handleFleetRenameCommand(args: string, user: any): Promise<CommandResult> {
    try {
      // User is guaranteed to exist by access-control
      // Parse args: first word is index, rest is new name
      const parts = args.trim().split(/\s+/);
      if (parts.length < 2) {
        return {
          success: false,
          message: '<b>Error:</b> Please provide a fleet index and new name.\n\n<b>Usage:</b> /fleet_rename &lt;fleet_index&gt; &lt;new_name&gt;\n\n<b>Example:</b> /fleet_rename 1 "My New Fleet Name"',
        };
      }

      const listIndex = parseInt(parts[0], 10);
      const newName = parts.slice(1).join(' ');

      if (isNaN(listIndex) || listIndex < 1) {
        return {
          success: false,
          message: 'Invalid fleet number. Please provide a valid number (1, 2, 3, etc.).',
        };
      }

      const fleets = await this.context.services.fleetsService.getUserFleets(user.id);
      if (fleets.length === 0) {
        return {
          success: false,
          message: 'You have no fleets to rename.',
        };
      }

      if (listIndex > fleets.length) {
        return {
          success: false,
          message: `Invalid fleet number. You have ${fleets.length} fleet(s). Use /fleet_list to see them.`,
        };
      }

      const fleetToRename = fleets[listIndex - 1];
      await this.context.services.fleetsService.renameFleet(fleetToRename.id, newName, user.id);

      return {
        success: true,
        message: `✅ <b>Fleet Renamed</b>\n\nFleet #${listIndex} is now named "${newName}".`,
      };
    } catch (error) {
      this.logger.error(`Error renaming fleet: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        message: 'Sorry, there was an error renaming the fleet. Please try again later.',
      };
    }
  }

  private async handleFleetDeleteCommand(indexStr: string, user: any): Promise<CommandResult> {
    try {
      // User is guaranteed to exist by access-control
      const listIndex = parseInt(indexStr, 10);
      if (isNaN(listIndex) || listIndex < 1) {
        return {
          success: false,
          message: 'Invalid fleet number. Please provide a valid number (1, 2, 3, etc.).\n\n<b>Usage:</b> /fleet_delete &lt;fleet_index&gt;\n\n<b>Example:</b> /fleet_delete 2',
        };
      }

      const fleets = await this.context.services.fleetsService.getUserFleets(user.id);
      if (fleets.length === 0) {
        return {
          success: false,
          message: 'You have no fleets to delete.',
        };
      }

      if (listIndex > fleets.length) {
        return {
          success: false,
          message: `Invalid fleet number. You have ${fleets.length} fleet(s). Use /fleet_list to see them.`,
        };
      }

      const fleetToDelete = fleets[listIndex - 1];
      await this.context.services.fleetsService.deleteFleet(fleetToDelete.id, user.id);

      return {
        success: true,
        message: `✅ <b>Fleet Deleted</b>\n\nFleet #${listIndex} (${fleetToDelete.name}) has been deleted along with all its vessels.`,
      };
    } catch (error) {
      this.logger.error(`Error deleting fleet: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        message: 'Sorry, there was an error deleting the fleet. Please try again later.',
      };
    }
  }

  private async handleFleetVesselAddCommand(args: string, user: any): Promise<CommandResult> {
    try {
      // User is guaranteed to exist by access-control
      const parts = args.trim().split(/\s+/);
      if (parts.length < 2) {
        return {
          success: false,
          message: '<b>Error:</b> Please provide a fleet index and IMO number.\n\n<b>Usage:</b> /fleet_vessel_add &lt;fleet_index&gt; &lt;IMO&gt;\n\n<b>Example:</b> /fleet_vessel_add 1 9571648',
        };
      }

      const listIndex = parseInt(parts[0], 10);
      const imo = parts[1];

      if (isNaN(listIndex) || listIndex < 1) {
        return {
          success: false,
          message: 'Invalid fleet number. Please provide a valid number (1, 2, 3, etc.).',
        };
      }

      const fleets = await this.context.services.fleetsService.getUserFleets(user.id);
      if (fleets.length === 0) {
        return {
          success: false,
          message: 'You have no fleets. Create one first with /fleet_create.',
        };
      }

      if (listIndex > fleets.length) {
        return {
          success: false,
          message: `Invalid fleet number. You have ${fleets.length} fleet(s). Use /fleet_list to see them.`,
        };
      }

      const targetFleet = fleets[listIndex - 1];

      try {
        await this.context.services.fleetsService.addVesselToFleet(
          {
            fleetId: targetFleet.id,
            vesselId: imo,
          },
          user.id,
        );

        return {
          success: true,
          message: `✅ <b>Vessel Added</b>\n\nVessel with IMO ${imo} has been added to fleet "${targetFleet.name}".`,
        };
      } catch (error: any) {
        if (error.message && error.message.includes('already in this fleet')) {
          return {
            success: false,
            message: `❌ Vessel with IMO ${imo} is already in fleet "${targetFleet.name}".`,
          };
        }
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error adding vessel to fleet: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        message: 'Sorry, there was an error adding the vessel to the fleet. Please try again later.',
      };
    }
  }

  private async handleFleetVesselRemoveCommand(args: string, user: any): Promise<CommandResult> {
    try {
      // User is guaranteed to exist by access-control
      const parts = args.trim().split(/\s+/);
      if (parts.length < 2) {
        return {
          success: false,
          message: '<b>Error:</b> Please provide a fleet index and IMO number.\n\n<b>Usage:</b> /fleet_vessel_remove &lt;fleet_index&gt; &lt;IMO&gt;\n\n<b>Example:</b> /fleet_vessel_remove 1 9571648',
        };
      }

      const listIndex = parseInt(parts[0], 10);
      const imo = parts[1];

      if (isNaN(listIndex) || listIndex < 1) {
        return {
          success: false,
          message: 'Invalid fleet number. Please provide a valid number (1, 2, 3, etc.).',
        };
      }

      const fleets = await this.context.services.fleetsService.getUserFleets(user.id);
      if (fleets.length === 0) {
        return {
          success: false,
          message: 'You have no fleets.',
        };
      }

      if (listIndex > fleets.length) {
        return {
          success: false,
          message: `Invalid fleet number. You have ${fleets.length} fleet(s). Use /fleet_list to see them.`,
        };
      }

      const targetFleet = fleets[listIndex - 1];

      try {
        await this.context.services.fleetsService.removeVesselFromFleet(targetFleet.id, imo, user.id);

        return {
          success: true,
          message: `✅ <b>Vessel Removed</b>\n\nVessel with IMO ${imo} has been removed from fleet "${targetFleet.name}".`,
        };
      } catch (error: any) {
        if (error.message && error.message.includes('not found in this fleet')) {
          return {
            success: false,
            message: `❌ Vessel with IMO ${imo} is not in fleet "${targetFleet.name}".`,
          };
        }
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error removing vessel from fleet: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        message: 'Sorry, there was an error removing the vessel from the fleet. Please try again later.',
      };
    }
  }

  private async handleFleetVesselsCommand(indexStr: string, user: any): Promise<CommandResult> {
    try {
      // User is guaranteed to exist by access-control
      const listIndex = parseInt(indexStr, 10);
      if (isNaN(listIndex) || listIndex < 1) {
        return {
          success: false,
          message: 'Invalid fleet number. Please provide a valid number (1, 2, 3, etc.).\n\n<b>Usage:</b> /fleet_vessels &lt;fleet_index&gt;\n\n<b>Example:</b> /fleet_vessels 1',
        };
      }

      const fleets = await this.context.services.fleetsService.getUserFleets(user.id);
      if (fleets.length === 0) {
        return {
          success: false,
          message: 'You have no fleets. Create one first with /fleet_create.',
        };
      }

      if (listIndex > fleets.length) {
        return {
          success: false,
          message: `Invalid fleet number. You have ${fleets.length} fleet(s). Use /fleet_list to see them.`,
        };
      }

      const targetFleet = fleets[listIndex - 1];
      const vessels = await this.context.services.fleetsService.getFleetVessels(targetFleet.id, user.id);

      if (vessels.length === 0) {
        return {
          success: true,
          message: `📋 <b>${targetFleet.name}</b>\n\nNo vessels in this fleet.\n\nUse /fleet_vessel_add to add vessels.`,
        };
      }

      let message = `📋 <b>${targetFleet.name}</b> - ${vessels.length} vessel(s)\n\n`;
      vessels.forEach((vessel, index) => {
        message += `${index + 1}. IMO: ${vessel.vesselId}\n`;
      });

      return {
        success: true,
        message,
      };
    } catch (error) {
      this.logger.error(`Error listing fleet vessels: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        message: 'Sorry, there was an error retrieving fleet vessels. Please try again later.',
      };
    }
  }

  // ==================== Reminder Command Handlers ====================

  private async handleReminderCommand(query: string, user: any): Promise<CommandResult> {
    try {
      

      if (!query || query.trim().length === 0) {
        return {
          success: false,
          message: '<b>Error:</b> Please provide a reminder query.\n\n<b>Usage:</b> /reminder &lt;your query&gt;\n\n<b>Example:</b> /reminder notify me when vessel IMO 9571648 arrives at port',
        };
      }

      // Extract structured reminder data using LLM
      this.logger.debug(`Extracting reminder data from query: "${query}"`);
      const { reminderType, searchParams } = await this.context.services.reminderExtractionService.extractReminderData(
        query.trim(),
        user.id,
      );

      // Resolve fleet reference if detected
      if (searchParams.fleetIndex || searchParams.fleetName) {
        const fleets = await this.context.services.fleetsService.getUserFleets(user.id);
        let resolvedFleetId: number | undefined;

        if (searchParams.fleetIndex) {
          // Resolve by index (e.g., "fleet 1", "fleet 2")
          const fleetIndex = searchParams.fleetIndex;
          if (fleetIndex > 0 && fleetIndex <= fleets.length) {
            resolvedFleetId = fleets[fleetIndex - 1].id;
            this.logger.debug(`Resolved fleet index ${fleetIndex} → Fleet ID: ${resolvedFleetId} (${fleets[fleetIndex - 1].name})`);
          } else {
            return {
              success: false,
              message: `Fleet number ${fleetIndex} not found. Use /fleet_list to see your fleets.`,
            };
          }
        } else if (searchParams.fleetName) {
          // Resolve by name (e.g., "my fleet My Shipping Fleet")
          const fleetNameMatch = fleets.find(
            (f) =>
              f.name.toLowerCase().includes(searchParams.fleetName!.toLowerCase()) ||
              searchParams.fleetName!.toLowerCase().includes(f.name.toLowerCase()),
          );

          if (fleetNameMatch) {
            resolvedFleetId = fleetNameMatch.id;
            this.logger.debug(`Resolved fleet name "${searchParams.fleetName}" → Fleet ID: ${resolvedFleetId} (${fleetNameMatch.name})`);
          } else {
            return {
              success: false,
              message: `Fleet "${searchParams.fleetName}" not found. Use /fleet_list to see your fleets.`,
            };
          }
        }

        // Add resolved fleetId to search params
        if (resolvedFleetId) {
          searchParams.fleetId = resolvedFleetId;
          // Clean up temp fields
          delete searchParams.fleetIndex;
          delete searchParams.fleetName;
        }
      }

      this.logger.debug(`Extracted reminder type: ${reminderType}`);
      this.logger.debug(`Extracted search params: ${JSON.stringify(searchParams, null, 2)}`);

      // Create reminder with structured parameters
      const reminder = await this.context.services.remindersService.createReminder({
        user_id: user.id,
        reminder_type: reminderType,
        user_query: query.trim(),
        search_params: searchParams,
        check_interval_minutes: 5,
        notification_message: `🔔 Alert: ${query.trim()}`,
      });

      // Format search params for display
      const formattedParams = this.formatSearchParams(searchParams);
      const formattedType = reminderType.replace('_', ' ').toUpperCase();

      let successMessage = `✅ <b>Reminder Created!</b>\n\n<b>Your reminder:</b> ${query.trim()}\n<b>Trigger:</b> ${formattedType}`;
      if (formattedParams) {
        successMessage += `\n\n${formattedParams}`;
      }
      successMessage += `\n\nYou will be notified when your criteria are met. Use /reminders to see all your active reminders.`;

      return {
        success: true,
        message: successMessage,
      };
    } catch (error) {
      this.logger.error(`Error creating reminder: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        message: 'Sorry, there was an error creating the reminder. Please try again later.',
      };
    }
  }

  private async handleListRemindersCommand(user: any): Promise<CommandResult> {
    try {
      

      const reminders = await this.context.services.remindersService.getActiveReminders(user.id);

      if (reminders.length === 0) {
        return {
          success: true,
          message: '📋 <b>No Active Reminders</b>\n\nYou don\'t have any active reminders. Use /reminder to create one.',
        };
      }

      let message = `📋 <b>Your Active Reminders (${reminders.length})</b>\n\n`;

      reminders.forEach((reminder, index) => {
        const lastChecked = reminder.lastCheckedAt
          ? new Date(reminder.lastCheckedAt).toLocaleString()
          : 'Never';

        const reminderType = reminder.reminderType
          ? reminder.reminderType.replace('_', ' ').toUpperCase()
          : 'GENERAL';

        message += `${index + 1}. <b>Trigger: ${reminderType}</b>\n`;
        message += `   ${reminder.userQuery || 'N/A'}\n`;

        // Add search criteria if available
        if (reminder.searchParams && Object.keys(reminder.searchParams).length > 0) {
          const formattedParams = this.formatSearchParams(reminder.searchParams);
          if (formattedParams) {
            message += `\n   ${formattedParams.split('\n').join('\n   ')}\n`;
          }
        }

        message += `\n   Last checked: ${lastChecked}\n\n`;
      });

      return {
        success: true,
        message,
      };
    } catch (error) {
      this.logger.error(`Error listing reminders: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        message: 'Sorry, there was an error retrieving your reminders. Please try again later.',
      };
    }
  }

  private async handleDeleteReminderCommand(indexStr: string, user: any): Promise<CommandResult> {
    try {
     

      // Parse index number (1-based from the list)
      const listIndex = parseInt(indexStr, 10);

      if (isNaN(listIndex) || listIndex < 1) {
        return {
          success: false,
          message: 'Invalid reminder number. Please provide a valid number (1, 2, 3, etc.).\n\n<b>Usage:</b> /delete_reminder &lt;number&gt;\n\n<b>Example:</b> /delete_reminder 2',
        };
      }

      // Get all user's active reminders
      const reminders = await this.context.services.remindersService.getActiveReminders(user.id);

      if (reminders.length === 0) {
        return {
          success: false,
          message: 'You have no active reminders to delete.',
        };
      }

      // Check if index is within range
      if (listIndex > reminders.length) {
        return {
          success: false,
          message: `Invalid reminder number. You have ${reminders.length} reminder(s). Use /reminders to see them.`,
        };
      }

      // Get the reminder at the specified index (convert from 1-based to 0-based)
      const reminderToDelete = reminders[listIndex - 1];
      const actualReminderId = reminderToDelete.id;

      // Format reminder info for the confirmation message
      const reminderType = reminderToDelete.reminderType
        ? reminderToDelete.reminderType.replace('_', ' ').toUpperCase()
        : 'GENERAL';
      const reminderQuery = reminderToDelete.userQuery || 'N/A';

      // Delete the reminder
      await this.context.services.remindersService.deleteReminder(actualReminderId);

      return {
        success: true,
        message: `✅ <b>Reminder Deleted</b>\n\nReminder #${listIndex} (${reminderType}) has been removed.\n\n<b>Reminder:</b> ${reminderQuery}`,
      };
    } catch (error) {
      this.logger.error(`Error deleting reminder: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        message: 'Sorry, there was an error deleting the reminder. Please try again later.',
      };
    }
  }

  // ==================== Utility Methods ====================

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private formatSearchParams(searchParams: Record<string, any>): string {
    if (!searchParams || Object.keys(searchParams).length === 0) {
      return '';
    }

    const parts: string[] = [];

    if (searchParams.imo) {
      parts.push(`IMO: ${searchParams.imo}`);
    }
    if (searchParams.mmsi) {
      parts.push(`MMSI: ${searchParams.mmsi}`);
    }
    if (searchParams.vesselName) {
      parts.push(`Vessel: ${searchParams.vesselName}`);
    }
    if (searchParams.portName) {
      parts.push(`Port: ${searchParams.portName}`);
    }
    if (searchParams.portCode) {
      parts.push(`Port Code: ${searchParams.portCode}`);
    }
    if (searchParams.fleetId) {
      parts.push(`Fleet ID: ${searchParams.fleetId}`);
    }
    if (searchParams.latitude !== undefined && searchParams.longitude !== undefined) {
      parts.push(`Location: ${searchParams.latitude}, ${searchParams.longitude}`);
    }
    if (searchParams.query) {
      parts.push(`Query: ${searchParams.query}`);
    }

    return parts.length > 0 ? parts.join(' | ') : '';
  }

  validateConfig(): boolean {
    return true;
  }
}

