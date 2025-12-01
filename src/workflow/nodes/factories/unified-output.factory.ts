import { Injectable } from '@nestjs/common';
import { NodeFactory } from '../../core/node-registry';
import { UnifiedOutputNode, UnifiedOutputConfig } from '../output/unified-output.node';
import { BaseNode } from '../../core/base-node';
import { WorkflowNodeContextProvider } from '../../services/workflow-node-context.provider';

@Injectable()
export class UnifiedOutputNodeFactory implements NodeFactory {
  private readonly context: ReturnType<WorkflowNodeContextProvider['createContext']>;

  constructor(
    private readonly contextProvider: WorkflowNodeContextProvider,
  ) {
    this.context = this.contextProvider.createContext();
  }

  getType(): string {
    return 'unified-output';
  }

  getDescription(): string {
    return 'Routes to the appropriate output node based on message source';
  }

  getDefaultConfig(): Record<string, unknown> {
    return {};
  }

  createInstance(
    id: string,
    name: string,
    config: Record<string, unknown>,
  ): BaseNode {
    return new UnifiedOutputNode(id, name, config as UnifiedOutputConfig, this.context);
  }
}

