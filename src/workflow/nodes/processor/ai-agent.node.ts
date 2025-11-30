/**
 * AI Agent Node
 * Uses UniversalAgent to process user input with LLM and tool execution
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseNode } from '../../core/base-node';
import { NodeExecutionContext } from '../../types/workflow.types';
import { FluctMessage, MessageType, MessageContent } from '../../types/message.types';
import { UniversalAgent, UniversalAgentConfig, UniversalTool } from '../../../universal-agent';
import { AgentToolsService } from '../../services/agent-tools.service';
import { ChatOpenAI } from '@langchain/openai';

export interface AIAgentConfig {
  framework?: 'langchain' | 'langgraph' | 'crewai' | 'deepagents' | 'openai-agents' | 'pocketflow' | 'custom';
  modelProvider?: 'openai' | 'openrouter' | 'anthropic' | 'custom';
  modelName?: string;
  apiKey?: string;
  baseURL?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

@Injectable()
export class AIAgentNode extends BaseNode {
  private readonly logger = new Logger(AIAgentNode.name);
  private agent: UniversalAgent | null = null;
  private agentInitialized = false;

  constructor(
    id: string,
    name: string,
    config: AIAgentConfig = {},
    private readonly configService: ConfigService,
    private readonly agentToolsService: AgentToolsService,
  ) {
    super(id, name, 'ai-agent', config);
  }

  /**
   * Prepare input from context
   */
  protected async prep(
    context: NodeExecutionContext,
  ): Promise<{ message: FluctMessage; user: any; userInput: string }> {
    this.logger.debug(`[prep] Context:\n${JSON.stringify(context, null, 2)}`);
    const message = context.sharedData.inputMessage as FluctMessage;
    const user = context.sharedData.user as any;

    if (!message || !message.content) {
      throw new Error('No input message content found');
    }

    if (message.content.type !== MessageType.TEXT || !message.content.text) {
      throw new Error('AI Agent only supports text messages');
    }

    const userInput = message.content.text;

    return { message, user, userInput };
  }

  /**
   * Execute AI Agent processing
   */
  protected async exec(
    prepResult: unknown,
    context: NodeExecutionContext,
  ): Promise<MessageContent> {
    this.logger.debug(`[exec] Context:\n${JSON.stringify(context, null, 2)}`);
    this.logger.debug(`[exec] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    const { userInput, user } = prepResult as { message: FluctMessage; user: any; userInput: string };
    const config = this.config as AIAgentConfig;

    try {
      // Initialize agent if not already done
      if (!this.agentInitialized) {
        await this.initializeAgent(config, user);
      }

      if (!this.agent) {
        throw new Error('Agent not initialized');
      }

      // Invoke agent with user input
      this.logger.debug(`Invoking AI agent with input: ${userInput}`);
      const result = await this.agent.invoke(userInput, {
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens,
      });

      this.logger.debug(`AI Agent response: ${JSON.stringify(result, null, 2)}`);

      // Extract output from result
      const outputText = result.output || 'I apologize, but I could not generate a response.';

      // Create response content
      const outputContent: MessageContent = {
        type: MessageType.TEXT,
        text: outputText,
      };

      return outputContent;
    } catch (error) {
      this.logger.error(
        `Error in AI Agent execution: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Return error message to user
      return {
        type: MessageType.TEXT,
        text: `I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
      };
    }
  }

  /**
   * Store processed content in shared data
   */
  protected async post(
    context: NodeExecutionContext,
    prepResult: unknown,
    execResult: unknown,
  ): Promise<string | undefined> {
    this.logger.debug(`[post] Context:\n${JSON.stringify(context, null, 2)}`);
    this.logger.debug(`[post] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    this.logger.debug(`[post] ExecResult:\n${JSON.stringify(execResult, null, 2)}`);
    const processedContent = execResult as MessageContent;

    // Store processed content for output nodes
    context.sharedData.processedContent = processedContent;

    this.logger.debug('AI Agent node completed');

    return undefined; // Continue to next node
  }

  /**
   * Initialize the UniversalAgent with configuration
   */
  private async initializeAgent(config: AIAgentConfig, user: any): Promise<void> {
    if (this.agentInitialized) {
      return;
    }

    try {
      // Get tools and wrap them with user context
      const tools = this.getToolsWithContext(user);

      // Determine framework (default to langchain)
      const framework = config.framework || 'langchain';

      // Create model based on provider
      const model = this.createModel(config);

      // Get system prompt
      const systemPrompt = this.getSystemPrompt(config, user);

      // Create agent configuration
      const agentConfig: UniversalAgentConfig = {
        framework,
        model,
        tools,
        systemPrompt,
        options: {
          temperature: config.temperature ?? 0.7,
          maxTokens: config.maxTokens,
        },
      };

      // Create and initialize agent
      this.agent = new UniversalAgent(agentConfig);
      await this.agent.init();

      this.agentInitialized = true;
      this.logger.log(`AI Agent initialized with framework: ${framework}, tools: ${tools.length}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize AI Agent: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get tools with user context bound
   */
  private getToolsWithContext(user: any): UniversalTool[] {
    const tools = this.agentToolsService.getTools();

    // Wrap tools to inject user context
    return tools.map((tool) => ({
      ...tool,
      execute: async (...args: any[]) => {
        // Extract parameters (could be object or array)
        const params = args.length === 1 && typeof args[0] === 'object' ? args[0] : { input: args[0] };
        
        // Add user context
        const context = { userId: user?.id };
        
        // Call original execute with params and context
        return await tool.execute(params, context);
      },
    }));
  }

  /**
   * Create model instance based on configuration
   */
  private createModel(config: AIAgentConfig): any {
    const provider = config.modelProvider || 'openrouter';
    const modelName = config.modelName || 'openai/gpt-4o-mini';
    const apiKey = config.apiKey || this.configService.get<string>('OPENROUTER_API_KEY') || this.configService.get<string>('OPENAI_API_KEY');
    const baseURL = config.baseURL || (provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined);

    if (!apiKey) {
      throw new Error(`API key not found for provider: ${provider}. Please set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable.`);
    }

    // For LangChain, create ChatOpenAI instance
    if (config.framework === 'langchain' || !config.framework) {
      return new ChatOpenAI({
        model: modelName,
        apiKey: apiKey,
        configuration: baseURL ? { baseURL } : undefined,
        temperature: config.temperature ?? 0.7,
      });
    }

    // For other frameworks, return model as-is (should be provided in config)
    return config.model || modelName;
  }

  /**
   * Get system prompt for the agent
   */
  private getSystemPrompt(config: AIAgentConfig, user: any): string {
    if (config.systemPrompt) {
      return config.systemPrompt;
    }

    // Default system prompt
    return `You are FluctBot, an AI assistant for maritime operations. You help users manage their fleets, track vessels, set reminders, and manage their subscriptions.

User Information:
- User ID: ${user?.id || 'Unknown'}
- Name: ${user?.name || 'Unknown'}

Available Capabilities:
- Fleet Management: Create, list, rename, delete fleets, and manage vessels within fleets
- Subscription Management: View subscription details and credit usage

When users ask questions or request actions:
1. Use the available tools to perform actions (create fleets, add vessels, etc.)
2. Provide clear, helpful responses
3. Format responses in HTML for better readability (use <b> for bold, <i> for italic, etc.)
4. If a tool execution fails, explain the error clearly to the user

Be conversational, helpful, and professional. Always confirm actions when using tools.`;
  }

  validateConfig(): boolean {
    return true;
  }
}

