/**
 * Web Chat Input Node
 * Receives messages from Web Chat and converts them to FluctMessage format
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseNode } from '../../core/base-node';
import { NodeExecutionContext } from '../../types/workflow.types';
import {
  FluctMessage,
  MessageSource,
  MessageType,
  MessageStatus,
  MessageMetadata,
  MessageContent,
} from '../../types/message.types';

export interface WebChatInputConfig {
  [key: string]: unknown;
}

@Injectable()
export class WebChatInputNode extends BaseNode {
  private readonly logger = new Logger(WebChatInputNode.name);

  constructor(
    id: string,
    name: string,
    config: WebChatInputConfig = {},
  ) {
    super(id, name, 'web-chat-input', config);
  }

  /**
   * Validate and prepare Web Chat message
   */
  protected async prep(
    context: NodeExecutionContext,
  ): Promise<unknown> {
    //this.logger.debug(`[prep] Context:\n${JSON.stringify(context, null, 2)}`);
    // The message should already be a FluctMessage if coming from Web Chat service
    const message = context.message as FluctMessage;

    if (!message || !message.metadata) {
      throw new Error('Invalid message format in WebChatInputNode');
    }

    // Ensure message is from Web Chat
    if (message.metadata.source !== MessageSource.WEB_CHAT) {
      this.logger.warn(
        `Message source is ${message.metadata.source}, expected WEB_CHAT`,
      );
    }

    return message;
  }

  /**
   * Process and normalize the message
   */
  protected async exec(
    prepResult: unknown,
    context: NodeExecutionContext,
  ): Promise<FluctMessage> {
    //this.logger.debug(`[exec] Context:\n${JSON.stringify(context, null, 2)}`);
    //this.logger.debug(`[exec] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    const message = prepResult as FluctMessage;

    // Validate message structure
    if (!message.id || !message.metadata || !message.content) {
      throw new Error('Invalid FluctMessage structure');
    }

    // Ensure status is set
    message.status = MessageStatus.PROCESSING;

    this.logger.debug(
      `Processing Web Chat message ${message.id} from user ${message.metadata.userId}`,
    );

    return message;
  }

  /**
   * Store normalized message in shared data
   */
  protected async post(
    context: NodeExecutionContext,
    prepResult: unknown,
    execResult: unknown,
  ): Promise<string | undefined> {
    //this.logger.debug(`[post] Context:\n${JSON.stringify(context, null, 2)}`);
    //this.logger.debug(`[post] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    //this.logger.debug(`[post] ExecResult:\n${JSON.stringify(execResult, null, 2)}`);
    const message = execResult as FluctMessage;

    // Store in shared data for next nodes (mutable version)
    // Note: source, chatId, userId are available via message.metadata.*
    context.sharedData.message = message;

    this.logger.debug(
      `Web Chat input node completed for message ${message.id}`,
    );

    return undefined; // Continue to next node
  }

  validateConfig(): boolean {
    return true;
  }
}
