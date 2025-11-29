/**
 * Web Chat Output Node
 * Sends messages back via Web Chat response
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseNode } from '../../core/base-node';
import { NodeExecutionContext } from '../../types/workflow.types';
import {
  FluctMessage,
  MessageSource,
  MessageContent,
} from '../../types/message.types';
import { MessageResponse } from '../../types/message.types';

export interface WebChatOutputConfig {
  [key: string]: unknown;
}

@Injectable()
export class WebChatOutputNode extends BaseNode {
  private readonly logger = new Logger(WebChatOutputNode.name);

  constructor(
    id: string,
    name: string,
    config: WebChatOutputConfig = {},
  ) {
    super(id, name, 'web-chat-output', config);
  }

  /**
   * Prepare output data from shared context
   */
  protected async prep(
    context: NodeExecutionContext,
  ): Promise<MessageResponse> {
    this.logger.debug(`[prep] Context:\n${JSON.stringify(context, null, 2)}`);
    const message = context.sharedData.inputMessage as FluctMessage;
    const processedContent = context.sharedData.processedContent as
      | MessageContent
      | undefined;
    const response = context.sharedData.response as
      | { type: string; text?: string }
      | undefined;

    if (!message) {
      throw new Error('No input message found in shared data');
    }

    // Use response if available (e.g., from onboarding), otherwise use processed content
    let content: MessageContent;
    if (response && response.type === 'text' && response.text) {
      content = {
        type: message.content.type,
        text: response.text,
      };
    } else {
      content = processedContent || message.content;
    }

    const webChatResponse: MessageResponse = {
      messageId: message.id,
      source: MessageSource.WEB_CHAT,
      chatId: message.metadata.chatId,
      content,
      metadata: {
        originalMessageId: message.id,
        workflowId: context.workflowId,
      },
    };

    return webChatResponse;
  }

  /**
   * Prepare response for Web Chat
   */
  protected async exec(
    prepResult: unknown,
    context: NodeExecutionContext,
  ): Promise<MessageResponse> {
    this.logger.debug(`[exec] Context:\n${JSON.stringify(context, null, 2)}`);
    this.logger.debug(`[exec] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    const response = prepResult as MessageResponse;

    this.logger.debug(
      `Preparing Web Chat response for message ${response.messageId}`,
    );

    // Store response in shared data for Web Chat service to return
    context.sharedData.webChatResponse = response;

    return response;
  }

  /**
   * Post-process and update execution context
   */
  protected async post(
    context: NodeExecutionContext,
    prepResult: unknown,
    execResult: unknown,
  ): Promise<string | undefined> {
    this.logger.debug(`[post] Context:\n${JSON.stringify(context, null, 2)}`);
    this.logger.debug(`[post] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    this.logger.debug(`[post] ExecResult:\n${JSON.stringify(execResult, null, 2)}`);
    const response = execResult as MessageResponse;

    // Store response in shared data
    context.sharedData.outputResponse = response;
    context.sharedData.outputSent = true;

    this.logger.debug(
      `Web Chat output node completed for message ${response.messageId}`,
    );

    return undefined; // Workflow complete
  }

  validateConfig(): boolean {
    return true;
  }
}
