import { Injectable } from '@nestjs/common';
import { NodeFactory } from '../../core/node-registry';
import { WebChatInputNode, WebChatInputConfig } from '../input/web-chat-input.node';
import { BaseNode } from '../../core/base-node';

@Injectable()
export class WebChatInputNodeFactory implements NodeFactory {
  getType(): string {
    return 'web-chat-input';
  }

  getDescription(): string {
    return 'Receives messages from Web Chat and converts them to FluctMessage format';
  }

  getDefaultConfig(): Record<string, unknown> {
    return {};
  }

  createInstance(
    id: string,
    name: string,
    config: Record<string, unknown>,
  ): BaseNode {
    return new WebChatInputNode(id, name, config as WebChatInputConfig);
  }
}
