/**
 * Factory for creating Echo Processor Node instances
 */

import { Injectable } from '@nestjs/common';
import { NodeFactory } from '../../core/node-registry';
import { BaseNode } from '../../core/base-node';
import {
  EchoProcessorNode,
  EchoProcessorConfig,
} from '../processor/echo-processor.node';

@Injectable()
export class EchoProcessorNodeFactory implements NodeFactory {
  getType(): string {
    return 'echo-processor';
  }

  getDescription(): string {
    return 'Simple processor that echoes the input (for testing)';
  }

  getDefaultConfig(): Record<string, unknown> {
    return {
      prefix: '',
      suffix: '',
      transformText: false,
    };
  }

  createInstance(
    id: string,
    name: string,
    config: Record<string, unknown>,
  ): BaseNode {
    return new EchoProcessorNode(id, name, config as EchoProcessorConfig);
  }
}

