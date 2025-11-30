/**
 * Telegram Input Node
 * Receives messages from Telegram and converts them to FluctMessage format
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

export interface TelegramInputConfig {
  botToken?: string; // Usually handled at service level
  webhookUrl?: string;
  [key: string]: unknown;
}

@Injectable()
export class TelegramInputNode extends BaseNode {
  private readonly logger = new Logger(TelegramInputNode.name);

  constructor(
    id: string,
    name: string,
    config: TelegramInputConfig = {},
  ) {
    super(id, name, 'telegram-input', config);
  }

  /**
   * Convert Telegram update to FluctMessage
   */
  protected async prep(
    context: NodeExecutionContext,
  ): Promise<unknown> {
    //this.logger.debug(`[prep] Context:\n${JSON.stringify(context, null, 2)}`);
    // The message should already be a FluctMessage if coming from Telegram service
    // But we can validate and enhance it here
    const message = context.message as FluctMessage;

    if (!message || !message.metadata) {
      throw new Error('Invalid message format in TelegramInputNode');
    }

    // Ensure message is from Telegram
    if (message.metadata.source !== MessageSource.TELEGRAM) {
      this.logger.warn(
        `Message source is ${message.metadata.source}, expected TELEGRAM`,
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
      `Processing Telegram message ${message.id} from chat ${message.metadata.chatId}`,
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

    // Store in shared data for next nodes
    context.sharedData.inputMessage = message;
    context.sharedData.source = message.metadata.source;
    context.sharedData.chatId = message.metadata.chatId;
    context.sharedData.userId = message.metadata.userId;

    this.logger.debug(
      `Telegram input node completed for message ${message.id}`,
    );

    return undefined; // Continue to next node
  }

  validateConfig(): boolean {
    // Telegram input node doesn't require specific config
    // Bot token is handled at service level
    return true;
  }
}

