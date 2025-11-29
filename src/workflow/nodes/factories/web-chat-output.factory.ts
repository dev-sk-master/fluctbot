import { Injectable } from '@nestjs/common';
import { NodeFactory } from '../../core/node-registry';
import { WebChatOutputNode, WebChatOutputConfig } from '../output/web-chat-output.node';
import { BaseNode } from '../../core/base-node';

@Injectable()
export class WebChatOutputNodeFactory implements NodeFactory {
  getType(): string {
    return 'web-chat-output';
  }

  getDescription(): string {
    return 'Sends messages back via Web Chat response';
  }

  getDefaultConfig(): Record<string, unknown> {
    return {};
  }

  createInstance(
    id: string,
    name: string,
    config: Record<string, unknown>,
  ): BaseNode {
    return new WebChatOutputNode(id, name, config as WebChatOutputConfig);
  }
}
