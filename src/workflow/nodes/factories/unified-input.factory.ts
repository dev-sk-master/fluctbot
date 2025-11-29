import { Injectable } from '@nestjs/common';
import { NodeFactory } from '../../core/node-registry';
import { UnifiedInputNode, UnifiedInputConfig } from '../input/unified-input.node';
import { BaseNode } from '../../core/base-node';

@Injectable()
export class UnifiedInputNodeFactory implements NodeFactory {
  getType(): string {
    return 'unified-input';
  }

  getDescription(): string {
    return 'Accepts messages from any source and normalizes them';
  }

  getDefaultConfig(): Record<string, unknown> {
    return {};
  }

  createInstance(
    id: string,
    name: string,
    config: Record<string, unknown>,
  ): BaseNode {
    return new UnifiedInputNode(id, name, config as UnifiedInputConfig);
  }
}

