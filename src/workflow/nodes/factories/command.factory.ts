import { Injectable } from '@nestjs/common';
import { NodeFactory } from '../../core/node-registry';
import { CommandNode, CommandConfig } from '../processor/command.node';
import { BaseNode } from '../../core/base-node';
import { WorkflowNodeContextProvider } from '../../services/workflow-node-context.provider';

@Injectable()
export class CommandNodeFactory implements NodeFactory {
  private readonly context: ReturnType<WorkflowNodeContextProvider['createContext']>;

  constructor(
    private readonly contextProvider: WorkflowNodeContextProvider,
  ) {
    this.context = this.contextProvider.createContext();
  }

  getType(): string {
    return 'command';
  }

  getDescription(): string {
    return 'Handles bot commands from any platform (Telegram, Web Chat, etc.)';
  }

  getDefaultConfig(): Record<string, unknown> {
    return {};
  }

  createInstance(
    id: string,
    name: string,
    config: Record<string, unknown>,
  ): BaseNode {
    return new CommandNode(
      id,
      name,
      config as CommandConfig,
      this.context,
    );
  }
}

