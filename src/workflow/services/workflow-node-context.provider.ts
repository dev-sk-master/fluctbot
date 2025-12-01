/**
 * WorkflowNodeContextProvider
 * 
 * Provider that creates and injects the WorkflowNodeContext.
 * This service aggregates all dependencies into a single context object.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandsService } from '../../common/services/commands.service';
import { OnboardingStateService } from '../../common/services/onboarding-state.service';
import { EmailService } from '../../common/services/email.service';
import { UsersService } from '../../users/users.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { StripeService } from '../../subscriptions/stripe/stripe.service';
import { FleetsService } from '../../fleets/fleets.service';
import { RemindersService } from '../../reminders/reminders.service';
import { ReminderExtractionService } from '../../reminders/reminder-extraction.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { AgentToolsService } from './agent-tools.service';
import { TelegramService } from '../sources/telegram/telegram.service';
import { WorkflowNodeContext } from './workflow-node-context';

@Injectable()
export class WorkflowNodeContextProvider {
  constructor(
    private readonly configService: ConfigService,
    private readonly commandsService: CommandsService,
    private readonly onboardingStateService: OnboardingStateService,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly stripeService: StripeService,
    private readonly fleetsService: FleetsService,
    private readonly remindersService: RemindersService,
    private readonly reminderExtractionService: ReminderExtractionService,
    private readonly conversationsService: ConversationsService,
    private readonly agentToolsService: AgentToolsService,
    private readonly telegramService: TelegramService,
  ) {}

  /**
   * Create the WorkflowNodeContext with all dependencies
   * All services are grouped under services for simplicity
   */
  createContext(): WorkflowNodeContext {
    return {
      config: {
        configService: this.configService,
      },
      services: {
        // Common/Shared Services
        commandsService: this.commandsService,
        onboardingStateService: this.onboardingStateService,
        emailService: this.emailService,
        
        // Domain/Business Logic Services
        usersService: this.usersService,
        subscriptionsService: this.subscriptionsService,
        stripeService: this.stripeService,
        fleetsService: this.fleetsService,
        remindersService: this.remindersService,
        reminderExtractionService: this.reminderExtractionService,
        conversationsService: this.conversationsService,
        
        // AI/Agent Services
        agentToolsService: this.agentToolsService,
        
        // Source/Platform Services
        telegramService: this.telegramService,
      },
      // infrastructure is optional, add when needed
    };
  }
}

