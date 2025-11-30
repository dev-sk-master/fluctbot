/**
 * Factory for creating Telegram Input Node instances
 */

import { Injectable } from '@nestjs/common';
import { NodeFactory } from '../../core/node-registry';
import { BaseNode } from '../../core/base-node';
import { TelegramInputNode, TelegramInputConfig } from '../input/telegram-input.node';
import { WorkflowNodeContextProvider } from '../../services/workflow-node-context.provider';

@Injectable()
export class TelegramInputNodeFactory implements NodeFactory {
  private readonly context: ReturnType<WorkflowNodeContextProvider['createContext']>;

  constructor(
    private readonly contextProvider: WorkflowNodeContextProvider,
  ) {
    this.context = this.contextProvider.createContext();
  }

  getType(): string {
    return 'telegram-input';
  }

  getDescription(): string {
    return 'Receives messages from Telegram and converts them to FluctMessage format';
  }

  getDefaultConfig(): Record<string, unknown> {
    return {};
  }

  createInstance(
    id: string,
    name: string,
    config: Record<string, unknown>,
  ): BaseNode {
    return new TelegramInputNode(
      id,
      name,
      config as TelegramInputConfig,
      this.context,
    );
  }
}

