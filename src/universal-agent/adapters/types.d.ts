/**
 * Type declarations for optional peer dependencies
 * These are declared to avoid TypeScript errors when packages aren't installed
 */

declare module "langchain" {
  export function createAgent(config: {
    model: string | any;
    tools?: any[];
    [key: string]: any;
  }): any;
  
  export function tool(
    func: (...args: any[]) => any,
    config: {
      name: string;
      description: string;
      schema?: any;
    }
  ): any;
}

declare module "@langchain/openai" {
  export class ChatOpenAI {
    constructor(config?: any);
    invoke(input: any): Promise<any>;
  }
}

declare module "@langchain/langgraph" {
  export class StateGraph<T = any> {
    constructor(stateSchema: T);
    addNode(name: string, handler: any): this;
    addEdge(from: string, to: string): this;
    addConditionalEdges(source: string, condition: any, pathMap: any): this;
    compile(options?: any): any;
  }
  export const START: string;
  export const END: string;
  export class MemorySaver {
    constructor();
  }
  export const MessagesZodMeta: any;
  export class Command {
    constructor(config: { resume?: { decisions: Array<{ type: string; editedAction?: any }> } } | any);
  }
}

declare module "@langchain/langgraph/zod" {
  export const registry: any;
}

declare module "@langchain/core/tools" {
  export function tool(
    func: (params: any) => any,
    config: {
      name: string;
      description: string;
      schema?: any;
    }
  ): any;
}

declare module "@langchain/core/messages" {
  export class BaseMessage {
    content: string;
    getType(): string;
  }
  export class HumanMessage extends BaseMessage {
    constructor(content: string);
  }
  export class SystemMessage extends BaseMessage {
    constructor(content: string);
  }
  export class ToolMessage extends BaseMessage {
    constructor(config: { content: string; tool_call_id: string });
  }
  export function isAIMessage(message: any): boolean;
}

declare module "crewai" {
  export class Crew {
    constructor(config: any);
    agents?: any[];
    run(tasks: any[]): Promise<any>;
  }
  export class Agent {
    constructor(config: any);
  }
  export class Task {
    constructor(config: any);
  }
}

declare module "deepagents" {
  export function createDeepAgent(config: {
    tools?: any[];
    systemPrompt?: string;
    [key: string]: any;
  }): any;
  
  export class DeepAgent {
    constructor(config: any);
    invoke(input: { messages: Array<{ role: string; content: string }> }): Promise<{
      messages: Array<{ role: string; content: string; [key: string]: any }>;
      [key: string]: any;
    }>;
  }
}

