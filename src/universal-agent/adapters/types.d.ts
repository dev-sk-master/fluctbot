/**
 * Type declarations for optional peer dependencies
 * These are declared to avoid TypeScript errors when packages aren't installed
 */


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

