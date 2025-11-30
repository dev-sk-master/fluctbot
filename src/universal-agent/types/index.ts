// @ts-ignore - zod is a peer dependency
import { z } from "zod";

/**
 * Supported AI agent frameworks
 */
export type UniversalFramework = "langchain" | "langgraph" | "crewai" | "deepagents" | "openai-agents" | "pocketflow" | "custom";

/**
 * UniversalTool - Unified tool interface that all frameworks can understand
 */
export interface UniversalTool {
  name: string;
  description: string;
  parameters?: any; // z.ZodSchema when zod is available
  execute: (...args: any[]) => Promise<any> | any;
}

/**
 * UniversalAgent response structure
 */
export interface UniversalAgentResponse {
  output: string;
  metadata?: {
    framework?: UniversalFramework;
    steps?: Array<{
      type: string;
      content: string;
      timestamp?: number;
    }>;
    tokensUsed?: number;
    executionTime?: number;
    [key: string]: any;
  };
}

/**
 * UniversalAgent configuration schema
 * Note: Requires zod to be installed for runtime validation
 */
export const UniversalAgentConfigSchema = (z as any).object({
  framework: (z as any).enum(["langchain", "langgraph", "crewai", "deepagents", "openai-agents", "pocketflow", "custom"]) as UniversalFramework,
  model: (z as any).any(), // Framework-specific model instance
  tools: (z as any).array((z as any).custom()).optional().default([]),
  systemPrompt: (z as any).string().optional(), // System prompt for the agent
  options: (z as any).record((z as any).any()).optional().default({}),
  adapter: (z as any).custom().optional(), // Custom adapter instance
});

/**
 * Interrupt configuration for human-in-the-loop (DeepAgents)
 */
export type InterruptConfig = 
  | boolean 
  | { allowedDecisions?: ("approve" | "edit" | "reject")[] };

/**
 * Framework-specific configuration options
 */
export interface FrameworkOptions {
  /**
   * DeepAgents framework-specific options
   */
  deepagents?: {
    /**
     * Checkpointer instance for state persistence (required for human-in-the-loop)
     */
    checkpointer?: any;
    /**
     * Human-in-the-loop configuration: maps tool names to interrupt settings
     */
    interruptOn?: Record<string, InterruptConfig>;
    /**
     * Additional DeepAgents-specific options
     */
    [key: string]: any;
  };
  
  /**
   * LangChain framework-specific options
   */
  langchain?: {
    /**
     * Additional LangChain-specific options
     */
    [key: string]: any;
  };
  
  /**
   * LangGraph framework-specific options
   */
  langgraph?: {
    /**
     * Additional LangGraph-specific options
     */
    [key: string]: any;
  };
  
  /**
   * CrewAI framework-specific options
   */
  crewai?: {
    /**
     * Agent role
     */
    role?: string;
    /**
     * Agent goal
     */
    goal?: string;
    /**
     * Agent backstory (overrides systemPrompt if provided)
     */
    backstory?: string;
    /**
     * Enable verbose logging
     */
    verbose?: boolean;
    /**
     * Additional CrewAI-specific options
     */
    [key: string]: any;
  };
  
  /**
   * OpenAI Agents framework-specific options
   */
  "openai-agents"?: {
    /**
     * Agent name (optional, defaults to "Universal Agent")
     */
    name?: string;
    /**
     * Additional OpenAI Agents-specific options
     */
    [key: string]: any;
  };
  
  /**
   * PocketFlow framework-specific options
   */
  pocketflow?: {
    /**
     * Maximum number of iterations in the agent loop
     */
    maxIterations?: number;
    /**
     * Additional PocketFlow-specific options
     */
    [key: string]: any;
  };
  
  /**
   * Custom framework-specific options
   */
  custom?: {
    [key: string]: any;
  };
}

/**
 * Universal agent configuration
 * Separates universal options from framework-specific options
 */
export type UniversalAgentConfig = {
  /**
   * Framework to use
   */
  framework: UniversalFramework;
  
  /**
   * Framework-specific model instance
   */
  model: any;
  
  /**
   * Tools available to the agent
   */
  tools?: UniversalTool[];
  
  /**
   * System prompt for the agent (universal across frameworks)
   */
  systemPrompt?: string;
  
  /**
   * Configuration options
   * - Universal options apply across all frameworks
   * - Framework-specific options are nested under `framework.{frameworkName}`
   * 
   * @example
   * ```typescript
   * options: {
   *   // Universal options
   *   temperature: 0.7,
   *   maxTokens: 1000,
   *   
   *   // Framework-specific options
   *   framework: {
   *     deepagents: {
   *       checkpointer: new MemorySaver(),
   *       interruptOn: { send_email: true }
   *     },
   *     crewai: {
   *       role: "Assistant",
   *       goal: "Help users"
   *     }
   *   }
   * }
   * ```
   */
  options?: Record<string, any> & {
    /**
     * Framework-specific configuration options
     * Each framework has its own nested options object
     */
    framework?: FrameworkOptions;
  };
  
  /**
   * Custom adapter instance (for "custom" framework)
   */
  adapter?: any;
};

/**
 * UniversalMessage - Message format for agent communication
 */
export interface UniversalMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  [key: string]: any;
}

/**
 * UniversalAgentInvokeInput - Input formats supported by invoke
 */
export type UniversalAgentInvokeInput = 
  | string 
  | UniversalMessage[] 
  | { messages: UniversalMessage[]; [key: string]: any }
  | { resume: { decisions: Array<{ type: string; editedAction?: any }> } } // For resuming interrupts (DeepAgents)
  | any; // Allow Command instances and other framework-specific types

/**
 * Framework-specific invoke options
 */
export interface FrameworkInvokeOptions {
  /**
   * DeepAgents framework-specific invoke options
   */
  deepagents?: {
    /**
     * LangGraph configurable options (for state persistence and interrupts)
     * @example
     * ```typescript
     * {
     *   configurable: {
     *     thread_id: "thread-123",
     *     recursion_limit: 5
     *   }
     * }
     * ```
     */
    configurable?: {
      thread_id?: string;
      recursion_limit?: number;
      [key: string]: any;
    };
    /**
     * Additional DeepAgents-specific invoke options
     */
    [key: string]: any;
  };
  
  /**
   * LangGraph framework-specific invoke options
   */
  langgraph?: {
    /**
     * LangGraph configurable options
     */
    configurable?: {
      thread_id?: string;
      recursion_limit?: number;
      [key: string]: any;
    };
    /**
     * Additional LangGraph-specific invoke options
     */
    [key: string]: any;
  };
  
  /**
   * LangChain framework-specific invoke options
   */
  langchain?: {
    /**
     * Additional LangChain-specific invoke options
     */
    [key: string]: any;
  };
  
  /**
   * CrewAI framework-specific invoke options
   */
  crewai?: {
    /**
     * Additional CrewAI-specific invoke options
     */
    [key: string]: any;
  };
  
  /**
   * OpenAI Agents framework-specific invoke options
   */
  "openai-agents"?: {
    /**
     * Additional OpenAI Agents-specific invoke options
     */
    [key: string]: any;
  };
  
  /**
   * PocketFlow framework-specific invoke options
   */
  pocketflow?: {
    /**
     * Maximum number of iterations in the agent loop
     */
    maxIterations?: number;
    /**
     * Additional PocketFlow-specific invoke options
     */
    [key: string]: any;
  };
  
  /**
   * Custom framework-specific invoke options
   */
  custom?: {
    [key: string]: any;
  };
}

/**
 * UniversalAgentInvokeOptions - Invoke options
 * Supports both universal and framework-specific options
 */
export interface UniversalAgentInvokeOptions {
  /**
   * Enable streaming responses
   */
  stream?: boolean;
  
  /**
   * Temperature for model responses
   */
  temperature?: number;
  
  /**
   * Maximum tokens in response
   */
  maxTokens?: number;
  
  /**
   * Metadata for the invocation
   */
  metadata?: Record<string, any>;
  
  /**
   * Framework-specific invoke options
   * Each framework has its own nested options object
   * 
   * @example
   * ```typescript
   * {
   *   temperature: 0.7,
   *   framework: {
   *     deepagents: {
   *       configurable: {
   *         thread_id: "thread-123",
   *         recursion_limit: 5
   *       }
   *     }
   *   }
   * }
   * ```
   */
  framework?: FrameworkInvokeOptions;
  
  /**
   * Additional universal options
   */
  [key: string]: any;
}


