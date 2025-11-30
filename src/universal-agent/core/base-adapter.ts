import { IFrameworkAdapter } from "./interfaces";
import {
  UniversalFramework,
  UniversalAgentConfig,
  UniversalAgentResponse,
  UniversalAgentInvokeOptions,
  UniversalAgentInvokeInput,
  UniversalTool,
} from "../types";
import { EventEmitter } from "events";

/**
 * UniversalBaseAdapter - Base adapter class providing default implementations
 */
export abstract class UniversalBaseAdapter implements IFrameworkAdapter {
  // Backward compatibility alias
  static get BaseAdapter() {
    return UniversalBaseAdapter;
  }
  abstract readonly framework: UniversalFramework;
  protected config: UniversalAgentConfig | null = null;
  protected initialized: boolean = false;
  public readonly eventEmitter: EventEmitter = new EventEmitter();

  /**
   * Get event emitter for listening to adapter events
   * Events are namespaced with framework name: '{framework}:{eventType}'
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  /**
   * Emit an event with framework namespace
   * @param type Event type (e.g., 'planning:phase', 'execution:phase', 'tool:execution:phase')
   * @param data Event data
   */
  emit(type: string, data: any): void {
    const timestamp = new Date().toISOString();
    const eventData = { type, data, timestamp, framework: this.framework };
    // Emit specific event: {framework}:{type}
    this.eventEmitter.emit(`${this.framework}:${type}`, eventData);
  }

  /**
   * Initialize the adapter
   */
  async initialize(config: UniversalAgentConfig): Promise<void> {
    this.config = config;
    await this.doInitialize(config);
    this.initialized = true;
  }

  /**
   * Framework-specific initialization logic
   */
  protected abstract doInitialize(config: UniversalAgentConfig): Promise<void>;

  /**
   * Invoke the agent
   */
  abstract invoke(input: UniversalAgentInvokeInput, options?: UniversalAgentInvokeOptions): Promise<UniversalAgentResponse>;

  /**
   * Default stream implementation (can be overridden)
   */
  async *stream(input: UniversalAgentInvokeInput, options?: UniversalAgentInvokeOptions): AsyncGenerator<{ content: string; done: boolean }> {
    const response = await this.invoke(input, { ...options, stream: false });
    yield {
      content: response.output,
      done: true,
    };
  }

  /**
   * Get tools
   */
  getTools(): UniversalTool[] {
    return this.config?.tools || [];
  }

  /**
   * Set tools
   */
  setTools(tools: UniversalTool[]): void {
    if (this.config) {
      this.config.tools = tools;
    }
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    this.initialized = false;
    this.config = null;
  }

  /**
   * Ensure adapter is initialized
   */
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`Adapter for ${this.framework} is not initialized`);
    }
  }
}

/**
 * Backward compatibility alias
 */
export const BaseAdapter = UniversalBaseAdapter;

