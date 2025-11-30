/**
 * Workflow Module
 * Main module for workflow functionality
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { WorkflowEngine } from './core/workflow-engine';
import { NodeRegistry } from './core/node-registry';
import { WorkflowService } from './services/workflow.service';
import { TelegramInputNodeFactory } from './nodes/factories/telegram-input.factory';
import { TelegramOutputNodeFactory } from './nodes/factories/telegram-output.factory';
import { EchoProcessorNodeFactory } from './nodes/factories/echo-processor.factory';
import { AccessControlNodeFactory } from './nodes/factories/access-control.factory';
import { OnboardingNodeFactory } from './nodes/factories/onboarding.factory';
import { WebChatInputNodeFactory } from './nodes/factories/web-chat-input.factory';
import { WebChatOutputNodeFactory } from './nodes/factories/web-chat-output.factory';
import { UnifiedInputNodeFactory } from './nodes/factories/unified-input.factory';
import { UnifiedOutputNodeFactory } from './nodes/factories/unified-output.factory';
import { CommandNodeFactory } from './nodes/factories/command.factory';
import { AIAgentNodeFactory } from './nodes/factories/ai-agent.factory';
import { WorkflowBuilder } from './builders/workflow.builder';
import { TelegramModule } from './sources/telegram/telegram.module';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CommonModule } from '../common/common.module';
import { FleetsModule } from '../fleets/fleets.module';
import { AgentToolsService } from './services/agent-tools.service';
import { WebSearchToolsRegistry } from './services/tool-registries/web-search-tools.registry';
import { DatalisticToolsRegistry } from './services/tool-registries/datalistic-tools.registry';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    forwardRef(() => TelegramModule),
    UsersModule,
    SubscriptionsModule,
    CommonModule,
    FleetsModule,
  ],
  providers: [
    WorkflowEngine,
    NodeRegistry,
    WorkflowService,
    WebSearchToolsRegistry,
    DatalisticToolsRegistry,
    AgentToolsService,
    TelegramInputNodeFactory,
    TelegramOutputNodeFactory,
    EchoProcessorNodeFactory,
    AccessControlNodeFactory,
    OnboardingNodeFactory,
    WebChatInputNodeFactory,
    WebChatOutputNodeFactory,
    UnifiedInputNodeFactory,
    UnifiedOutputNodeFactory,
    CommandNodeFactory,
    AIAgentNodeFactory,
  ],
  exports: [WorkflowService, WorkflowEngine, NodeRegistry],
})
export class WorkflowModule implements OnModuleInit {
  constructor(
    private readonly nodeRegistry: NodeRegistry,
    private readonly workflowService: WorkflowService,
    private readonly telegramInputFactory: TelegramInputNodeFactory,
    private readonly telegramOutputFactory: TelegramOutputNodeFactory,
    private readonly echoProcessorFactory: EchoProcessorNodeFactory,
    private readonly accessControlFactory: AccessControlNodeFactory,
    private readonly onboardingFactory: OnboardingNodeFactory,
    private readonly webChatInputFactory: WebChatInputNodeFactory,
    private readonly webChatOutputFactory: WebChatOutputNodeFactory,
    private readonly unifiedInputFactory: UnifiedInputNodeFactory,
    private readonly unifiedOutputFactory: UnifiedOutputNodeFactory,
    private readonly commandFactory: CommandNodeFactory,
    private readonly aiAgentFactory: AIAgentNodeFactory,
  ) {}

  async onModuleInit() {
    // Register node factories
    this.nodeRegistry.register(this.telegramInputFactory);
    this.nodeRegistry.register(this.telegramOutputFactory);
    this.nodeRegistry.register(this.echoProcessorFactory);
    this.nodeRegistry.register(this.accessControlFactory);
    this.nodeRegistry.register(this.onboardingFactory);
    this.nodeRegistry.register(this.webChatInputFactory);
    this.nodeRegistry.register(this.webChatOutputFactory);
    this.nodeRegistry.register(this.unifiedInputFactory);
    this.nodeRegistry.register(this.unifiedOutputFactory);
    this.nodeRegistry.register(this.commandFactory);
    this.nodeRegistry.register(this.aiAgentFactory);

    // Create unified workflow
    this.createUnifiedWorkflow();
  }

  private createUnifiedWorkflow(): void {
    const builder = new WorkflowBuilder(
      'unified-workflow',
      'Unified Workflow',
    );

    builder.withDescription(
      'Unified workflow that handles messages from any source (Telegram, Web Chat, etc.) with user check and onboarding support',
    );

    // Create nodes
    const unifiedInputNode = {
      id: 'unified-input',
      type: 'unified-input',
      name: 'Unified Input',
      config: {},
    };

    const telegramInputNode = {
      id: 'telegram-input',
      type: 'telegram-input',
      name: 'Telegram Input',
      config: {},
    };

    const webChatInputNode = {
      id: 'web-chat-input',
      type: 'web-chat-input',
      name: 'Web Chat Input',
      config: {},
    };

    const accessControlNode = {
      id: 'access-control',
      type: 'access-control',
      name: 'Access Control',
      config: {},
    };

    const onboardingNode = {
      id: 'onboarding',
      type: 'onboarding',
      name: 'Onboarding',
      config: {},
    };

    const commandNode = {
      id: 'command',
      type: 'command',
      name: 'Command Processor',
      config: {},
    };

    const echoProcessorNode = {
      id: 'echo-processor',
      type: 'echo-processor',
      name: 'Echo Processor',
      config: {
        transformText: false,
      },
    };

    const aiAgentNode = {
      id: 'ai-agent',
      type: 'ai-agent',
      name: 'AI Agent',
      config: {
        framework: 'deepagents',
        modelProvider: 'openrouter',
        modelName: 'openai/gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 2000,
      },
    };

    const unifiedOutputNode = {
      id: 'unified-output',
      type: 'unified-output',
      name: 'Unified Output',
      config: {},
    };

    const telegramOutputNode = {
      id: 'telegram-output',
      type: 'telegram-output',
      name: 'Telegram Output',
      config: {},
    };

    const webChatOutputNode = {
      id: 'web-chat-output',
      type: 'web-chat-output',
      name: 'Web Chat Output',
      config: {},
    };

    builder
      .addNode(unifiedInputNode)
      .addNode(telegramInputNode)
      .addNode(webChatInputNode)
      .addNode(accessControlNode)
      .addNode(onboardingNode)
      .addNode(commandNode)
      .addNode(echoProcessorNode)
      .addNode(aiAgentNode)
      .addNode(unifiedOutputNode)
      .addNode(telegramOutputNode)
      .addNode(webChatOutputNode)
      // Flow: Unified Input → (Telegram/Web Chat Input) → AccessControl → (Onboarding OR Processor) → Unified Output → (Telegram/Web Chat Output)
      .connect('unified-input', 'telegram-input', 'telegram_input') // Route to Telegram input
      .connect('unified-input', 'web-chat-input', 'web_chat_input') // Route to Web Chat input
      .connect('telegram-input', 'access-control')
      .connect('web-chat-input', 'access-control')
      .connect('access-control', 'onboarding', 'onboarding') // If user incomplete → onboarding
      .connect('access-control', 'command', 'command') // If command detected → command processor
      .connect('access-control', 'ai-agent', 'default') // If user complete and not command → AI agent (replaces echo-processor)
      // .connect('access-control', 'echo-processor', 'default') // Echo processor kept as fallback
      .connect('onboarding', 'unified-output', 'send_response') // Send onboarding messages
      .connect('onboarding', 'unified-output', 'completed') // After onboarding complete, send completion message
      .connect('command', 'unified-output', 'command_success') // Command handled successfully
      .connect('command', 'unified-output', 'command_error') // Command error
      .connect('ai-agent', 'unified-output') // AI Agent output
      .connect('echo-processor', 'unified-output') // Echo processor output (kept for fallback)
      .connect('unified-output', 'telegram-output', 'telegram_output') // Route to Telegram output
      .connect('unified-output', 'web-chat-output', 'web_chat_output') // Route to Web Chat output
      .setStartNode('unified-input');

    const workflow = builder.build();
    this.workflowService.registerWorkflow(workflow);
  }
}
