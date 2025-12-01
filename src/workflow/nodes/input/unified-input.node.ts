/**
 * Unified Input Node
 * Routes to the appropriate input node based on message source
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseNode } from '../../core/base-node';
import { NodeExecutionContext } from '../../types/workflow.types';
import { FluctMessage, MessagePlatform } from '../../types/message.types';

export interface UnifiedInputConfig {
  [key: string]: unknown;
}

@Injectable()
export class UnifiedInputNode extends BaseNode {
  private readonly logger = new Logger(UnifiedInputNode.name);

  constructor(
    id: string,
    name: string,
    config: UnifiedInputConfig = {},
  ) {
    super(id, name, 'unified-input', config);
  }

  protected async prep(
    context: NodeExecutionContext,
  ): Promise<{ message: FluctMessage; platform: MessagePlatform }> {
    //this.logger.debug(`[prep] Context:\n${JSON.stringify(context, null, 2)}`);

    const message = context.message as FluctMessage;

    if (!message || !message.metadata) {
      throw new Error('Invalid message format in UnifiedInputNode');
    }

    const platform = message.metadata.platform;

    // Store message in shared data for input nodes (mutable version)
    // Note: platform, platformIdentifier, userId are available via message.metadata.*
    context.sharedData.message = message;

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
      `Routing message ${message.id} to input node based on platform: ${platform}`,
    );

    // Return action for routing to appropriate input node
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
    
    // Source is available via message.metadata.source, no need to store separately

    // Return action for routing to appropriate input node
    return result.action;
  }

  private getActionForPlatform(platform: MessagePlatform): string {
    switch (platform) {
      case MessagePlatform.TELEGRAM:
        return 'telegram_input';
      case MessagePlatform.WEB_CHAT:
        return 'web_chat_input';
      case MessagePlatform.WHATSAPP:
        return 'whatsapp_input';
      default:
        return 'default';
    }
  }

  validateConfig(): boolean {
    return true;
  }
}

