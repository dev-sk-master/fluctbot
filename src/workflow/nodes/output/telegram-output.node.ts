/**
 * Telegram Output Node
 * Sends messages back to Telegram using TelegramService
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseNode } from '../../core/base-node';
import { NodeExecutionContext } from '../../types/workflow.types';
import {
  FluctMessage,
  MessageSource,
  MessageType,
  MessageContent,
} from '../../types/message.types';
import { MessageResponse } from '../../types/message.types';
import { TelegramService } from '../../sources/telegram/telegram.service';

export interface TelegramOutputConfig {
  botToken?: string; // Usually handled at service level
  chatId?: string; // Can be overridden from message metadata
  [key: string]: unknown;
}

@Injectable()
export class TelegramOutputNode extends BaseNode {
  private readonly logger = new Logger(TelegramOutputNode.name);

  constructor(
    id: string,
    name: string,
    config: TelegramOutputConfig = {},
    private readonly telegramService?: TelegramService,
  ) {
    super(id, name, 'telegram-output', config);
  }

  /**
   * Prepare output data from shared context
   */
  protected async prep(
    context: NodeExecutionContext,
  ): Promise<MessageResponse> {
    //this.logger.debug(`[prep] Context:\n${JSON.stringify(context, null, 2)}`);
    const message = context.sharedData.inputMessage as FluctMessage;
    const processedContent = context.sharedData.processedContent as
      | MessageContent
      | undefined;
    const responseData = context.sharedData.response as
      | { type: string; text?: string }
      | undefined;

    if (!message) {
      throw new Error('No input message found in shared data');
    }

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

    // Get chat ID from config or message metadata
    const chatId =
      (this.config.chatId as string) || message.metadata.chatId;

    const response: MessageResponse = {
      messageId: message.id,
      source: MessageSource.TELEGRAM,
      chatId,
      content,
      metadata: {
        originalMessageId: message.id,
        workflowId: context.workflowId,
      },
    };

    return response;
  }

  /**
   * Execute sending to Telegram using TelegramService
   */
  protected async exec(
    prepResult: unknown,
    context: NodeExecutionContext,
  ): Promise<MessageResponse> {
    //this.logger.debug(`[exec] Context:\n${JSON.stringify(context, null, 2)}`);
    //this.logger.debug(`[exec] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    const response = prepResult as MessageResponse;

    this.logger.debug(
      `Sending message to Telegram chat ${response.chatId}`,
    );

    // Use TelegramService to send message if available
    if (this.telegramService) {
      try {
        const sentMessage = await this.telegramService.sendMessage(
          response.chatId,
          response.content,
        );

        if (sentMessage) {
          this.logger.log(
            `Successfully sent message to Telegram chat ${response.chatId}`,
          );
          // Update response with sent message ID
          response.metadata = {
            ...response.metadata,
            sentMessageId: sentMessage.message_id,
          };
        }
      } catch (error) {
        this.logger.error(
          `Failed to send message to Telegram: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    } else {
      // Fallback: log if service not available
      this.logger.warn(
        'TelegramService not available, message not sent',
      );
    }

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
    //this.logger.debug(`[post] Context:\n${JSON.stringify(context, null, 2)}`);
    //this.logger.debug(`[post] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    //this.logger.debug(`[post] ExecResult:\n${JSON.stringify(execResult, null, 2)}`);
    const response = execResult as MessageResponse;

    // Store response in shared data
    context.sharedData.outputResponse = response;
    context.sharedData.outputSent = true;

    this.logger.debug(
      `Telegram output node completed for chat ${response.chatId}`,
    );

    return undefined; // Workflow complete
  }

  validateConfig(): boolean {
    return true;
  }
}
