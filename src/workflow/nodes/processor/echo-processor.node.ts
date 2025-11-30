/**
 * Echo Processor Node
 * Simple processor that echoes the input (for testing)
 * Can be extended for more complex processing
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseNode } from '../../core/base-node';
import { NodeExecutionContext } from '../../types/workflow.types';
import { FluctMessage, MessageContent } from '../../types/message.types';

export interface EchoProcessorConfig {
  prefix?: string;
  suffix?: string;
  transformText?: boolean; // Whether to transform text content
  [key: string]: unknown;
}

@Injectable()
export class EchoProcessorNode extends BaseNode {
  private readonly logger = new Logger(EchoProcessorNode.name);

  constructor(
    id: string,
    name: string,
    config: EchoProcessorConfig = {},
  ) {
    super(id, name, 'echo-processor', config);
  }

  /**
   * Extract message content from shared data
   */
  protected async prep(
    context: NodeExecutionContext,
  ): Promise<MessageContent> {
    //this.logger.debug(`[prep] Context:\n${JSON.stringify(context, null, 2)}`);
    const message = context.sharedData.inputMessage as FluctMessage;

    if (!message || !message.content) {
      throw new Error('No input message content found');
    }

    return message.content;
  }

  /**
   * Process the content (echo for now)
   */
  protected async exec(
    prepResult: unknown,
    context: NodeExecutionContext,
  ): Promise<MessageContent> {
    //this.logger.debug(`[exec] Context:\n${JSON.stringify(context, null, 2)}`);
    //this.logger.debug(`[exec] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    const inputContent = prepResult as MessageContent;
    const config = this.config as EchoProcessorConfig;

    this.logger.debug(
      `Processing ${inputContent.type} content in echo processor`,
    );

    // Create output content (echo input)
    const outputContent: MessageContent = {
      ...inputContent,
    };

    // Apply transformations if configured
    if (config.transformText && inputContent.type === 'text' && inputContent.text) {
      let text = inputContent.text;
      if (config.prefix) {
        text = `${config.prefix} ${text}`;
      }
      if (config.suffix) {
        text = `${text} ${config.suffix}`;
      }
      outputContent.text = text;
    }

    return outputContent;
  }

  /**
   * Store processed content in shared data
   */
  protected async post(
    context: NodeExecutionContext,
    prepResult: unknown,
    execResult: unknown,
  ): Promise<string | undefined> {
    //this.logger.debug(`[post] Context:\n${JSON.stringify(context, null, 2)}`);
    //this.logger.debug(`[post] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    //this.logger.debug(`[post] ExecResult:\n${JSON.stringify(execResult, null, 2)}`);
    const processedContent = execResult as MessageContent;

    // Store processed content for output nodes
    context.sharedData.processedContent = processedContent;

    this.logger.debug('Echo processor completed');

    return undefined; // Continue to next node
  }

  validateConfig(): boolean {
    return true;
  }
}

