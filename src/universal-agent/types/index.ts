// @ts-ignore - zod is a peer dependency
import { z } from "zod";

/**
 * Supported AI agent frameworks
 */
export type UniversalFramework = "langchain" | "langgraph" | "crewai" | "deepagents" | "openai-agents" | "pocketflow" | "custom";

/**
 * Tool Response Types
 * Standardized response format for tool execution
 * 
 * Design Philosophy:
 * - JSON structure for programmatic access and consistency
 * - Human-readable summary for LLM consumption
 * - Metadata for observability and debugging
 * - Clear separation between data and presentation
 */

/**
 * Tool response metadata
 */
export interface ToolResponseMetadata {
  tool: string; // Tool name that generated this response
  timestamp: number; // Unix timestamp in milliseconds
  executionTime?: number; // Execution time in milliseconds
  version?: string; // Tool/API version if applicable
  [key: string]: any; // Additional metadata
}

/**
 * Base tool response interface
 * All tool responses should follow this structure
 */
export interface ToolResponse {
  /**
   * Success status - true for successful execution, false for errors
   */
  success: boolean;
  
  /**
   * Human-readable summary of the result
   * This is what LLMs will primarily use to understand the tool output
   * Should be concise but informative
   */
  summary: string;
  
  /**
   * Structured data from the tool execution
   * This is the machine-readable, parseable data
   * Tool-specific structure based on the tool type
   */
  data?: Record<string, any>;
  
  /**
   * Response metadata for observability
   */
  metadata?: ToolResponseMetadata;
  
  /**
   * Additional tool-specific fields
   * Use this sparingly - prefer putting data in the `data` field
   */
  [key: string]: any;
}

/**
 * Successful tool response
 * Contains the actual result data from tool execution
 */
export interface ToolSuccessResponse extends ToolResponse {
  success: true;
  summary: string; // Required for success responses
  data?: Record<string, any>; // Structured result data
  metadata?: ToolResponseMetadata;
  [key: string]: any;
}

/**
 * Error tool response
 * Used when errors are returned instead of thrown
 * (Some tools may return errors for expected failure cases)
 */
export interface ToolErrorResponse extends ToolResponse {
  success: false;
  summary: string; // Error message in human-readable format
  message: string; // Detailed error message
  error?: {
    code?: string; // Error code (e.g., "NOT_FOUND", "VALIDATION_ERROR")
    type?: string; // Error type (e.g., "API_ERROR", "NETWORK_ERROR")
    details?: any; // Additional error details
  };
  metadata?: ToolResponseMetadata;
  [key: string]: any;
}

/**
 * Union type for tool responses
 * Tools should return either ToolSuccessResponse or ToolErrorResponse
 * For critical errors, tools may throw Error instead of returning ToolErrorResponse
 */
export type ToolExecutionResult = ToolSuccessResponse | ToolErrorResponse;

/**
 * Tool parameter structure
 * Adapters normalize parameters to a single object matching the tool's parameter schema
 * 
 * @example
 * ```typescript
 * // Tool definition with parameters schema
 * parameters: z.object({
 *   query: z.string(),
 *   maxResults: z.number().optional()
 * })
 * 
 * // Tool execute receives normalized object
 * execute: async (params: { query: string; maxResults?: number }) => {
 *   // params will be { query: "...", maxResults: 5 }
 * }
 * ```
 */
export type ToolParams = Record<string, any>;

/**
 * Extract TypeScript type from Zod schema
 * Use this to avoid duplicating type definitions
 * 
 * @example
 * ```typescript
 * const paramsSchema = z.object({
 *   query: z.string(),
 *   maxResults: z.number().optional()
 * });
 * 
 * // In tool definition
 * parameters: paramsSchema,
 * execute: async (params: InferToolParams<typeof paramsSchema>) => {
 *   // params is typed as { query: string; maxResults?: number }
 * }
 * ```
 */
// @ts-ignore - zod is a peer dependency
export type InferToolParams<T extends z.ZodTypeAny> = z.infer<T>;

/**
 * UniversalTool - Unified tool interface that all frameworks can understand
 */
export interface UniversalTool {
  name: string;
  description: string;
  parameters?: any; // z.ZodSchema when zod is available
  
  /**
   * Execute the tool with given parameters
   * 
   * **Parameter Structure:**
   * - Adapters normalize all parameters to a single object
   * - The object structure matches the tool's `parameters` schema
   * - Tools should expect a single object parameter: `execute(params: ToolParams)`
   * 
   * **Return Types (all supported):**
   * - `string`: Simple text response
   * - `object`: Structured data (will be normalized automatically)
   * - `array`: List of items (will be normalized automatically)
   * - `ToolExecutionResult`: Already formatted response (will add metadata if missing)
   * 
   * **Automatic Normalization:**
   * The adapter will automatically:
   * - Track execution time
   * - Normalize the result to ToolExecutionResult format
   * - Add metadata (tool name, timestamp, execution time)
   * - Convert to string for LLM consumption
   * 
   * **Error Handling:**
   * - Throw `Error` for unexpected errors (adapter will catch and format)
   * - Return `ToolErrorResponse` for expected errors (e.g., "not found")
   * 
   * @param args - Tool parameters (adapters normalize to single object matching parameters schema)
   * @returns Any type - will be normalized by the adapter to ToolExecutionResult
   * 
   * @example
   * ```typescript
   * execute: async (params: { query: string; maxResults?: number }) => {
   *   // Simple return - adapter handles formatting
   *   return { results: [...], count: 5 };
   *   
   *   // Or return string
   *   return "Search completed";
   *   
   *   // Or return array
   *   return [item1, item2, item3];
   * }
   * ```
   */
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


export type UniversalMessageContent = 
  | string 
  | Array<
      | { type: 'text'; text: string } 
      | { type: 'image_url'; image_url: { url: string } }
      | { type: 'input_audio'; input_audio: { data: string; format: string } }
      | { type: 'file'; file: { filename: string; file_data: string } } // OpenRouter expects file_data (snake_case) and data URL format
    >;

/**
 * UniversalMessage - Message format for agent communication
 */
export interface UniversalMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: UniversalMessageContent; // Supports string or multimodal array
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


