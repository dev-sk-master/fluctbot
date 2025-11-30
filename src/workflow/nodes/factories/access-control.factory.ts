import { Injectable } from '@nestjs/common';
import { NodeFactory } from '../../core/node-registry';
import { AccessControlNode, AccessControlConfig } from '../processor/access-control.node';
import { BaseNode } from '../../core/base-node';
import { WorkflowNodeContextProvider } from '../../services/workflow-node-context.provider';

@Injectable()
export class AccessControlNodeFactory implements NodeFactory {
  private readonly context: ReturnType<WorkflowNodeContextProvider['createContext']>;

  constructor(
    private readonly contextProvider: WorkflowNodeContextProvider,
  ) {
    this.context = this.contextProvider.createContext();
  }

  getType(): string {
    return 'access-control';
  }

  getDescription(): string {
    return 'Checks if message is a command, user status, and routes to command/onboarding/echo-processor accordingly';
  }

  getDefaultConfig(): Record<string, unknown> {
    return {};
  }

  createInstance(
    id: string,
    name: string,
    config: Record<string, unknown>,
  ): BaseNode {
    return new AccessControlNode(
      id,
      name,
      config as AccessControlConfig,
      this.context,
    );
  }
}

