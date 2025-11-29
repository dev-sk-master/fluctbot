import { Injectable } from '@nestjs/common';
import { NodeFactory } from '../../core/node-registry';
import { UnifiedOutputNode, UnifiedOutputConfig } from '../output/unified-output.node';
import { BaseNode } from '../../core/base-node';

@Injectable()
export class UnifiedOutputNodeFactory implements NodeFactory {
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
    return new UnifiedOutputNode(id, name, config as UnifiedOutputConfig);
  }
}

