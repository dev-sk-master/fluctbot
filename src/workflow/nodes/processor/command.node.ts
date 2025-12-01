import { Injectable, Logger } from '@nestjs/common';
import { BaseNode } from '../../core/base-node';
import {
  NodeExecutionContext,
  NodeExecutionResult,
} from '../../types/workflow.types';
import { FluctMessage, MessageType, MessageContent, MessagePlatform } from '../../types/message.types';
import { WorkflowNodeContext } from '../../services/workflow-node-context';
import { Platform } from '../../../users/entities/user-platform.entity';
import { SubscriptionStatus } from '../../../subscriptions/entities/subscription.entity';

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
          result = await this.handleSubscribeCommand(user, message);
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
    const message = context.sharedData.message as FluctMessage;
    const user = context.sharedData['user'] as any;

    // Command node should only receive commands (access-control routes non-commands to echo-processor)
    // This check is a safety fallback
    if (result.action === 'continue') {
      this.logger.warn('Command node received non-command message - this should not happen');
      return 'continue';
    }

    // Store command response in shared data for output node
    // Note: Conversation tracking is handled by unified-output node
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
      // First try to get active subscription
      let subscription = await this.context.services.subscriptionsService.getUserActiveSubscription(user.id);
      
      // If no active subscription, get the last subscription (even if inactive)
      if (!subscription) {
        subscription = await this.context.services.subscriptionsService.getUserLastSubscription(user.id);
      }

      // Format subscription details
      let message = '💳 <b>Account & Credits</b>\n\n';
      message += '<b>📋 Subscription Details:</b>\n';

      if (!subscription) {
        message += '\nYou do not have an active subscription.';
        return {
          success: true,
          message,
        };
      }
      // Get plan name from plan_code
      const plan = await this.context.services.subscriptionsService.getPlanByCode(subscription.planCode);
      const planName = plan?.name || subscription.planCode.charAt(0).toUpperCase() + subscription.planCode.slice(1);
      message += `• <b>Plan:</b> ${planName}\n`;
      // Format status display
      const statusDisplay = {
        [SubscriptionStatus.ACTIVE]: '✅ Active',
        [SubscriptionStatus.INACTIVE]: '❌ Inactive',
        [SubscriptionStatus.CANCELLED]: '⚠️ Cancelled',
        [SubscriptionStatus.EXPIRED]: '⏰ Expired',
      }[subscription.status] || '❓ Unknown';
      
      message += `• <b>Status:</b> ${statusDisplay}\n`;
      message += `• <b>Credit Limit:</b> ${parseFloat(String(subscription.creditLimit)).toFixed(2)} credits\n`;
      message += `• <b>Period:</b> ${subscription.creditPeriodValue} ${subscription.creditPeriodUnit}${subscription.creditPeriodValue > 1 ? 's' : ''}\n`;
      
      // Add billing frequency and amount if available (from payment metadata)
      if (subscription.paymentMetadata?.frequency) {
        const frequency = subscription.paymentMetadata.frequency;
        
        // Get amount and currency if available
        let billingInfo = frequency.charAt(0).toUpperCase() + frequency.slice(1); // 'daily' -> 'Daily', 'monthly' -> 'Monthly'
        if (subscription.paymentMetadata.amount !== undefined) {
          const amount = parseFloat(String(subscription.paymentMetadata.amount));
          
          // Try to get currency from Stripe if price_id is available
          let currencySymbol = '£'; // Default to GBP
          if (subscription.paymentMetadata.price_id) {
            try {
              const price = await this.context.services.stripeService.getPrice(
                subscription.paymentMetadata.price_id,
              );
              currencySymbol = this.context.services.stripeService.getCurrencySymbol(price.currency);
            } catch (error) {
              // If fetching currency fails, use default
              this.logger.debug(`Could not fetch currency for price ${subscription.paymentMetadata.price_id}, using default`);
            }
          }
          
          billingInfo = `${currencySymbol}${amount.toFixed(2)}/${frequency}`;
        }
        
        message += `• <b>Billing:</b> ${billingInfo}\n`;
      }

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

  private async handleSubscribeCommand(
    user: any,
    message: FluctMessage,
  ): Promise<CommandResult> {
    try {
      // Check if Stripe is configured
      const stripeService = this.context.services.stripeService;
      if (!stripeService || !stripeService.isConfigured()) {
        return {
          success: false,
          message: '💳 Stripe payment is not configured. Please contact support.',
        };
      }

      // Get all available plans (excluding free)
      const allPlans = await this.context.services.subscriptionsService.getAllPlans();
      const paidPlans = allPlans.filter((plan) => plan.planCode !== 'free' && plan.active);

      if (paidPlans.length === 0) {
        return {
          success: false,
          message: '💳 No subscription plans are available at the moment. Please try again later.',
        };
      }

      // Get message metadata for platform info
      const platform = message?.metadata.platform || MessagePlatform.TELEGRAM;
      const platformIdentifier = message?.metadata.platformIdentifier || '';

      // Build subscription message with checkout links
      let subscriptionMessage = '💳 <b>Subscribe to a Plan</b>\n\n';
      subscriptionMessage += 'Choose a plan to subscribe:\n\n';

      for (const plan of paidPlans) {
        const pricing = plan.pricing || {};
        
        subscriptionMessage += `🔹 <b>${plan.name || plan.planCode.toUpperCase()}</b>\n`;
        subscriptionMessage += `   📊 Credits: ${plan.creditLimit} per ${plan.creditPeriodValue} ${plan.creditPeriodUnit}${plan.creditPeriodValue > 1 ? 's' : ''}\n`;

        if (plan.capabilities) {
          const caps = plan.capabilities;
          if (caps.fleets) {
            subscriptionMessage += `   🚢 Fleets: ${caps.fleets === 'unlimited' ? 'Unlimited' : caps.fleets}\n`;
          }
          if (caps.reminders) {
            subscriptionMessage += `   🔔 Reminders: ${caps.reminders === 'unlimited' ? 'Unlimited' : caps.reminders}\n`;
          }
        }

        subscriptionMessage += `   💵 Pricing:\n`;

        // Process all pricing tiers generically
        const pricingTierLabels: Record<string, string> = {
          daily: '/day',
          weekly: '/week',
          monthly: '/month',
          yearly: '/year',
          one_time: ' one-time',
          fixed: '',
        };

        // Define preferred order for display
        const pricingOrder = ['daily', 'weekly', 'monthly', 'yearly', 'one_time', 'fixed'];

        let hasPricing = false;

        // Process pricing tiers in preferred order, then any others
        const processedTiers = new Set<string>();

        // First, process known tiers in order
        for (const tierKey of pricingOrder) {
          const tier = pricing[tierKey];
          if (tier?.amount && tier?.stripe_price_id) {
            processedTiers.add(tierKey);
            const label = pricingTierLabels[tierKey] || '';
            const pricingLine = await this.processPricingTier(
              plan,
              tierKey,
              tier,
              label,
              user,
              platform,
              platformIdentifier,
            );
            if (pricingLine) {
              subscriptionMessage += pricingLine;
              hasPricing = true;
            }
          }
        }

        // Then process any other pricing tiers not in the known list
        for (const [tierKey, tier] of Object.entries(pricing)) {
          if (!processedTiers.has(tierKey) && tier?.amount && tier?.stripe_price_id) {
            const label = pricingTierLabels[tierKey] || ` (${tierKey})`;
            const pricingLine = await this.processPricingTier(
              plan,
              tierKey,
              tier,
              label,
              user,
              platform,
              platformIdentifier,
            );
            if (pricingLine) {
              subscriptionMessage += pricingLine;
              hasPricing = true;
            }
          }
        }

        if (!hasPricing) {
          subscriptionMessage += `      Contact for pricing\n`;
        }

        subscriptionMessage += `\n`;
      }

      subscriptionMessage += 'Click on any plan above to subscribe!';

      return {
        success: true,
        message: subscriptionMessage,
      };
    } catch (error) {
      this.logger.error(
        `Error handling subscribe command: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        message: 'Sorry, there was an error loading subscription plans. Please try again later.',
      };
    }
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

  /**
   * Generic method to process any pricing tier and return formatted message line
   * Returns the formatted pricing line string, or null on error
   */
  private async processPricingTier(
    plan: any,
    tierKey: string,
    tier: { amount: number; stripe_price_id: string },
    label: string,
    user: any,
    platform: any,
    platformIdentifier: string,
  ): Promise<string | null> {
    try {
      // Get currency from Stripe Price object (source of truth)
      const stripePrice = await this.context.services.stripeService.getPrice(
        tier.stripe_price_id,
      );
      const currencySymbol = this.context.services.stripeService.getCurrencySymbol(
        stripePrice.currency,
      );

      // Create checkout session
      const session = await this.context.services.stripeService.createCheckoutSession(
        {
          planCode: plan.planCode,
          userId: user.id,
          platform: platform,
          platformIdentifier: platformIdentifier,
          priceId: tier.stripe_price_id,
        },
        plan,
      );

      // Return formatted pricing line
      return `      • <a href="${session.url}">${currencySymbol}${tier.amount}${label}</a>\n`;
    } catch (error) {
      this.logger.warn(
        `Failed to create ${tierKey} checkout session for plan ${plan.planCode}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  validateConfig(): boolean {
    return true;
  }
}

