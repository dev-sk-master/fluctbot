/**
 * Factory for creating Telegram Output Node instances
 */

import { Injectable } from '@nestjs/common';
import { NodeFactory } from '../../core/node-registry';
import { BaseNode } from '../../core/base-node';
import {
  TelegramOutputNode,
  TelegramOutputConfig,
} from '../output/telegram-output.node';
import { WorkflowNodeContextProvider } from '../../services/workflow-node-context.provider';

@Injectable()
export class TelegramOutputNodeFactory implements NodeFactory {
  private readonly context: ReturnType<WorkflowNodeContextProvider['createContext']>;

  constructor(
    private readonly contextProvider: WorkflowNodeContextProvider,
  ) {
    this.context = this.contextProvider.createContext();
  }

  getType(): string {
    return 'telegram-output';
  }

  getDescription(): string {
    return 'Sends messages back to Telegram';
  }

  getDefaultConfig(): Record<string, unknown> {
    return {};
  }

  createInstance(
    id: string,
    name: string,
    config: Record<string, unknown>,
  ): BaseNode {
    return new TelegramOutputNode(
      id,
      name,
      config as TelegramOutputConfig,
      this.context,
    );
  }
}
