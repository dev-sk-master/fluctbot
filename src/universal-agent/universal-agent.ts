import { IFrameworkAdapter } from "./core/interfaces";
import {
  UniversalFramework,
  UniversalAgentConfig,
  UniversalAgentResponse,
  UniversalAgentInvokeOptions,
  UniversalAgentInvokeInput,
  UniversalTool,
  UniversalAgentConfigSchema,
} from "./types";
import { AdapterFactory } from "./adapters";
import { UniversalToolRegistry } from "./utils/tool-registry";
import { normalizeInput } from "./utils/input-normalizer";

/**
 * UniversalAgent - Framework-agnostic orchestrator for multiple AI agent backends
 */
export class UniversalAgent {
  private adapter: IFrameworkAdapter | null = null;
  private config: UniversalAgentConfig;
  private toolRegistry: UniversalToolRegistry;
  private initialized: boolean = false;

  /**
   * Create a new UniversalAgent instance
   */
  constructor(config: UniversalAgentConfig) {
    // Validate configuration if zod is available
    try {
      const validatedConfig = UniversalAgentConfigSchema.parse(config);
      this.config = validatedConfig as UniversalAgentConfig;
    } catch {
      // If zod is not available or validation fails, use config as-is
      this.config = config;
    }
    // Initialize tool registry with tools from config
    this.toolRegistry = new UniversalToolRegistry(config.tools || []);
  }

  /**
   * Initialize the agent with the configured framework
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Create adapter for the specified framework
      this.adapter = AdapterFactory.create(
        this.config.framework,
        this.config.adapter
      );

      // Set tools from registry
      const tools = this.toolRegistry.getAll();
      if (tools.length > 0) {
        this.adapter.setTools?.(tools);
      }

      // Initialize the adapter
      await this.adapter.initialize(this.config);
      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize UniversalAgent: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Ensure agent is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * Invoke the agent with input
   * Supports multiple input formats:
   * - string: "Tell me a joke."
   * - UniversalMessage[]: [{ role: "system", content: "Be concise." }, { role: "user", content: "Explain quantum computing." }]
   * - { messages: UniversalMessage[] }: { messages: [{ role: "user", content: "what is the weather in sf" }] }
   */
  async invoke(input: UniversalAgentInvokeInput, options?: UniversalAgentInvokeOptions): Promise<UniversalAgentResponse> {
    await this.ensureInitialized();
    if (!this.adapter) {
      throw new Error("Adapter not initialized");
    }
    return await this.adapter.invoke(input, options);
  }

  /**
   * Get the current framework
   */
  getFramework(): UniversalFramework {
    return this.config.framework;
  }

  /**
   * Get current tools
   */
  getTools(): UniversalTool[] {
    return this.toolRegistry.getAll();
  }

  /**
   * Get a specific tool by name
   */
  getTool(toolName: string): UniversalTool | undefined {
    return this.toolRegistry.get(toolName);
  }

  /**
   * Check if a tool exists
   */
  hasTool(toolName: string): boolean {
    return this.toolRegistry.has(toolName);
  }

  /**
   * Set tools (replaces all existing tools)
   */
  setTools(tools: UniversalTool[]): void {
    this.toolRegistry.clear();
    this.toolRegistry.registerMany(tools);
    this.config.tools = tools;
    
    // Update adapter if initialized
    if (this.adapter) {
      this.adapter.setTools?.(this.toolRegistry.getAll());
    }
  }

  /**
   * Add a tool to the registry
   */
  addTool(tool: UniversalTool): void {
    this.toolRegistry.register(tool);
    this.config.tools = this.toolRegistry.getAll();
    
    // Update adapter if initialized
    if (this.adapter) {
      this.adapter.setTools?.(this.toolRegistry.getAll());
    }
  }

  /**
   * Remove a tool by name
   */
  removeTool(toolName: string): boolean {
    const removed = this.toolRegistry.remove(toolName);
    if (removed) {
      this.config.tools = this.toolRegistry.getAll();
      
      // Update adapter if initialized
      if (this.adapter) {
        this.adapter.setTools?.(this.toolRegistry.getAll());
      }
    }
    return removed;
  }

  /**
   * Get the tool registry instance
   */
  getToolRegistry(): UniversalToolRegistry {
    return this.toolRegistry;
  }

  /**
   * Get the underlying adapter instance (for advanced usage)
   */
  getAdapter(): IFrameworkAdapter | null {
    return this.adapter;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<UniversalAgentConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration (requires reinitialization)
   */
  async updateConfig(updates: Partial<UniversalAgentConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    this.initialized = false;
    await this.init();
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    if (this.adapter) {
      await this.adapter.dispose?.();
    }
    this.adapter = null;
    this.initialized = false;
  }
}

