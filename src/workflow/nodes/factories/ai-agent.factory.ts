import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeFactory } from '../../core/node-registry';
import { AIAgentNode, AIAgentConfig } from '../processor/ai-agent.node';
import { BaseNode } from '../../core/base-node';
import { AgentToolsService } from '../../services/agent-tools.service';

@Injectable()
export class AIAgentNodeFactory implements NodeFactory {
  constructor(
    private readonly configService: ConfigService,
    private readonly agentToolsService: AgentToolsService,
  ) {}

  getType(): string {
    return 'ai-agent';
  }

  getDescription(): string {
    return 'AI Agent node that uses UniversalAgent to process user input with LLM and tool execution';
  }

  getDefaultConfig(): Record<string, unknown> {
    return {
      framework: 'langchain',
      modelProvider: 'openrouter',
      modelName: 'openai/gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 2000,
    };
  }

  createInstance(
    id: string,
    name: string,
    config: Record<string, unknown>,
  ): BaseNode {
    return new AIAgentNode(
      id,
      name,
      config as AIAgentConfig,
      this.configService,
      this.agentToolsService,
    );
  }
}

