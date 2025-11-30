/**
 * Unified Input Node
 * Routes to the appropriate input node based on message source
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseNode } from '../../core/base-node';
import { NodeExecutionContext } from '../../types/workflow.types';
import { FluctMessage, MessageSource } from '../../types/message.types';

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
  ): Promise<{ message: FluctMessage; source: MessageSource }> {
    //this.logger.debug(`[prep] Context:\n${JSON.stringify(context, null, 2)}`);

    const message = context.message as FluctMessage;

    if (!message || !message.metadata) {
      throw new Error('Invalid message format in UnifiedInputNode');
    }

    const source = message.metadata.source;

    // Store message in shared data for input nodes
    context.sharedData.inputMessage = message;
    context.sharedData.source = source;
    context.sharedData.chatId = message.metadata.chatId;
    context.sharedData.userId = message.metadata.userId;

    return { message, source };
  }

  protected async exec(
    prepResult: unknown,
    context: NodeExecutionContext,
  ): Promise<{ source: MessageSource; action: string }> {
    //this.logger.debug(`[exec] Context:\n${JSON.stringify(context, null, 2)}`);
    //this.logger.debug(`[exec] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    const { message, source } = prepResult as { message: FluctMessage; source: MessageSource };

    this.logger.debug(
      `Routing message ${message.id} to input node based on source: ${source}`,
    );

    // Return action for routing to appropriate input node
    return {
      source,
      action: this.getActionForSource(source),
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
    const result = execResult as { source: MessageSource; action: string };
    
    // Store source in shared data for input nodes
    context.sharedData.source = result.source;

    // Return action for routing to appropriate input node
    return result.action;
  }

  private getActionForSource(source: MessageSource): string {
    switch (source) {
      case MessageSource.TELEGRAM:
        return 'telegram_input';
      case MessageSource.WEB_CHAT:
        return 'web_chat_input';
      case MessageSource.WHATSAPP:
        return 'whatsapp_input';
      default:
        return 'default';
    }
  }

  validateConfig(): boolean {
    return true;
  }
}

