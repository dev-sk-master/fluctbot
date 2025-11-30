import {
  UniversalFramework,
  UniversalTool,
  UniversalAgentResponse,
  UniversalAgentInvokeOptions,
  UniversalAgentInvokeInput,
  UniversalAgentConfig,
} from "../types";

/**
 * Base interface that all framework adapters must implement
 */
export interface IFrameworkAdapter {
  /**
   * Framework identifier
   */
  readonly framework: UniversalFramework;

  /**
   * Initialize the adapter with configuration
   */
  initialize(config: UniversalAgentConfig): Promise<void>;

  /**
   * Invoke the agent with input
   */
  invoke(input: UniversalAgentInvokeInput, options?: UniversalAgentInvokeOptions): Promise<UniversalAgentResponse>;

  /**
   * Get or set tools
   */
  getTools?(): UniversalTool[];
  setTools?(tools: UniversalTool[]): void;

  /**
   * Cleanup resources
   */
  dispose?(): Promise<void>;
}

/**
 * Tool registry interface for managing and converting tools
 */
export interface IToolRegistry {
  /**
   * Register a tool
   */
  register(tool: UniversalTool): void;

  /**
   * Add a tool (alias for register)
   */
  add(tool: UniversalTool): void;

  /**
   * Remove a tool by name
   */
  remove(toolName: string): boolean;

  /**
   * Get a tool by name
   */
  get(toolName: string): UniversalTool | undefined;

  /**
   * Check if a tool exists
   */
  has(toolName: string): boolean;

  /**
   * Get all tools
   */
  getAll(): UniversalTool[];

  /**
   * Convert UniversalTool to framework-specific tool
   */
  fromUnified(unifiedTool: UniversalTool, framework: UniversalFramework): any;

  /**
   * Convert all registered tools to framework-specific format
   */
  convertToFramework(framework: UniversalFramework): any[];
}

