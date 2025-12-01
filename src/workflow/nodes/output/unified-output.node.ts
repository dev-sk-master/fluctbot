/**
 * Unified Output Node
 * Routes to the appropriate output node based on message source
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseNode } from '../../core/base-node';
import { NodeExecutionContext } from '../../types/workflow.types';
import { FluctMessage, MessagePlatform, MessageType, MessageContent } from '../../types/message.types';
import { WorkflowNodeContext } from '../../services/workflow-node-context';

export interface UnifiedOutputConfig {
  [key: string]: unknown;
}

@Injectable()
export class UnifiedOutputNode extends BaseNode {
  private readonly logger = new Logger(UnifiedOutputNode.name);

  constructor(
    id: string,
    name: string,
    config: UnifiedOutputConfig = {},
    private readonly context: WorkflowNodeContext,
  ) {
    super(id, name, 'unified-output', config);
  }

  protected async prep(
    context: NodeExecutionContext,
  ): Promise<{ message: FluctMessage; platform: MessagePlatform }> {
    //this.logger.debug(`[prep] Context:\n${JSON.stringify(context, null, 2)}`);
    const message = context.sharedData.message as FluctMessage;
    const processedContent = context.sharedData.processedContent as
      | MessageContent
      | undefined;
    const responseData = context.sharedData.response as
      | { type: string; text?: string }
      | undefined;

    if (!message) {
      throw new Error('No input message found in shared data');
    }

    const platform = message.metadata.platform;

    // Use response if available (e.g., from onboarding), otherwise use processed content
    let content: MessageContent;
    if (responseData && responseData.type === 'text' && responseData.text) {
      content = {
        type: MessageType.TEXT,
        text: responseData.text,
      };
    } else {
      content = processedContent || message.content;
    }

    // Store content in shared data for output nodes
    context.sharedData.outputContent = content;

    return { message, platform };
  }

  protected async exec(
    prepResult: unknown,
    context: NodeExecutionContext,
  ): Promise<{ platform: MessagePlatform; action: string }> {
    //this.logger.debug(`[exec] Context:\n${JSON.stringify(context, null, 2)}`);
    //this.logger.debug(`[exec] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    const { message, platform } = prepResult as { message: FluctMessage; platform: MessagePlatform };

    this.logger.debug(
      `Routing message ${message.id} to output based on platform: ${platform}`,
    );

    // Return action for routing to appropriate output node
    return {
      platform,
      action: this.getActionForPlatform(platform),
    };
  }

  protected async post(
    context: NodeExecutionContext,
    prepResult: unknown,
    execResult: unknown,
  ): Promise<string | undefined> {
    //this.logger.debug(`[post] Context:\n${JSON.stringify(context, null, 2)}`);
    //this.logger.debug(`[post] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    //this.logger.debug(`[post] ExecResult:\n${JSON.stringify(execResult, null, 2)}`);
    const result = execResult as { platform: MessagePlatform; action: string };
    const message = context.sharedData.message as FluctMessage;
    const user = context.sharedData['user'] as any;
    
    // Centralized conversation tracking - save all interactions here
    if (user && message) {
      await this.saveToConversation(context, message, user);
    }

    // Return action for routing to appropriate output node
    return result.action;
  }

  /**
   * Save response to conversation (centralized tracking)
   * Delegates to ConversationsService which handles node type detection
   * 
   * Note: User message is already saved by:
   * - Access Control node (if user exists)
   * - Onboarding node (after user creation)
   * 
   * This node only handles saving assistant responses.
   */
  private async saveToConversation(
    context: NodeExecutionContext,
    message: FluctMessage,
    user: any,
  ): Promise<void> {
    const conversationsService = this.context.services.conversationsService;
    
    // Extract relevant data from sharedData
    const sharedData = {
      processedContent: context.sharedData.processedContent as MessageContent | undefined,
      response: context.sharedData.response as { type: string; text?: string } | undefined,
      commandResponse: context.sharedData.commandResponse as string | undefined,
      aiAgentToolCalls: context.sharedData.aiAgentToolCalls as any[] | undefined,
    };

    // Delegate to service - it handles node type detection and saving
    await conversationsService.saveAssistantResponseFromSharedData(
      user.id,
      message,
      sharedData,
      this.context.services.commandsService, // Pass commandsService for command name extraction
    );
  }

  private getActionForPlatform(platform: MessagePlatform): string {
    switch (platform) {
      case MessagePlatform.TELEGRAM:
        return 'telegram_output';
      case MessagePlatform.WEB_CHAT:
        return 'web_chat_output';
      case MessagePlatform.WHATSAPP:
        return 'whatsapp_output';
      default:
        return 'default';
    }
  }

  validateConfig(): boolean {
    return true;
  }
}

