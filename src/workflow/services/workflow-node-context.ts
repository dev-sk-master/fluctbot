/**
 * WorkflowNodeContext
 * 
 * Centralized context object that provides all dependencies needed by workflow nodes.
 * This eliminates the need to pass individual services to each factory and node.
 * 
 * Benefits:
 * - Single parameter instead of many
 * - Type-safe access to all dependencies
 * - Easy to extend with new dependencies
 * - Simple to mock for testing
 */

import { ConfigService } from '@nestjs/config';
import { CommandsService } from '../../common/services/commands.service';
import { OnboardingStateService } from '../../common/services/onboarding-state.service';
import { EmailVerificationService } from '../../common/services/email-verification.service';
import { UsersService } from '../../users/users.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { FleetsService } from '../../fleets/fleets.service';
import { RemindersService } from '../../reminders/reminders.service';
import { ReminderExtractionService } from '../../reminders/reminder-extraction.service';
import { AgentToolsService } from './agent-tools.service';
import { TelegramService } from '../sources/telegram/telegram.service';

/**
 * WorkflowNodeContext - All dependencies available to workflow nodes
 * 
 * Simple, organized structure:
 * - config: Configuration services
 * - services: All business logic services (common, domain, agent, sources)
 * - infrastructure: Optional infrastructure services (repositories, queues, cache, etc.)
 */
export interface WorkflowNodeContext {
  /** Configuration */
  config: {
    configService: ConfigService;
  };

  /** All Services - Common, Domain, Agent, and Source services */
  services: {
    // Common/Shared Services
    commandsService: CommandsService;
    onboardingStateService: OnboardingStateService;
    emailVerificationService: EmailVerificationService;

    // Domain/Business Logic Services
    usersService: UsersService;
    subscriptionsService: SubscriptionsService;
    fleetsService: FleetsService;
    remindersService: RemindersService;
    reminderExtractionService: ReminderExtractionService;

    // AI/Agent Services
    agentToolsService: AgentToolsService;

    // Source/Platform Services (for input/output nodes)
    telegramService: TelegramService;
    // Future: whatsappService, webChatService, etc.
  };

  /** Infrastructure Services (optional, for future use) */
  infrastructure?: {
    // Repositories (TypeORM)
    // userRepository?: Repository<User>;
    // fleetRepository?: Repository<Fleet>;
    
    // Event Emitters
    // eventEmitter?: EventEmitter2;
    
    // Queue Services
    // queueService?: QueueService;
    
    // Cache Services
    // cacheService?: CacheService;
    
    // HTTP Clients
    // httpClient?: AxiosInstance;
    
    // Third-party Clients
    // telegramClient?: TelegramBot;
    // openAIClient?: OpenAI;
  };
}

