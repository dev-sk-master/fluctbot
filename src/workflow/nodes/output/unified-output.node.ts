/**
 * Unified Output Node
 * Routes to the appropriate output node based on message source
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseNode } from '../../core/base-node';
import { NodeExecutionContext } from '../../types/workflow.types';
import { FluctMessage, MessageSource, MessageType, MessageContent } from '../../types/message.types';

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
  ) {
    super(id, name, 'unified-output', config);
  }

  protected async prep(
    context: NodeExecutionContext,
  ): Promise<{ message: FluctMessage; source: MessageSource }> {
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

    const source = message.metadata.source;

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
      `Routing message ${message.id} to output based on source: ${source}`,
    );

    // Return action for routing to appropriate output node
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
    
    // Source is available via message.metadata.source, no need to store separately

    // Return action for routing to appropriate output node
    return result.action;
  }

  private getActionForSource(source: MessageSource): string {
    switch (source) {
      case MessageSource.TELEGRAM:
        return 'telegram_output';
      case MessageSource.WEB_CHAT:
        return 'web_chat_output';
      case MessageSource.WHATSAPP:
        return 'whatsapp_output';
      default:
        return 'default';
    }
  }

  validateConfig(): boolean {
    return true;
  }
}

