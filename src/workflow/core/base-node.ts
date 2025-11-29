/**
 * Base node class inspired by PocketFlow architecture
 * All workflow nodes extend this base class
 */

import { NodeExecutionContext, NodeExecutionResult } from '../types/workflow.types';
import { FluctMessage } from '../types/message.types';

export abstract class BaseNode {
  protected id: string;
  protected name: string;
  protected type: string;
  protected config: Record<string, unknown>;

  constructor(
    id: string,
    name: string,
    type: string,
    config: Record<string, unknown> = {},
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.config = config;
  }

  /**
   * Prepare data from shared context
   * Override this to extract/prepare data before execution
   */
  protected async prep(
    context: NodeExecutionContext,
  ): Promise<unknown> {
    return context.message;
  }

  /**
   * Execute the node's main logic
   * This is where the actual work happens
   */
  protected abstract exec(
    prepResult: unknown,
    context: NodeExecutionContext,
  ): Promise<unknown>;

  /**
   * Post-process and update shared context
   * Override this to write results back to shared data
   */
  protected async post(
    context: NodeExecutionContext,
    prepResult: unknown,
    execResult: unknown,
  ): Promise<string | undefined> {
    // Default: store exec result in shared data
    if (execResult !== undefined) {
      context.sharedData[`${this.id}_output`] = execResult;
    }
    return undefined; // 'default' action
  }

  /**
   * Main execution method following prep->exec->post pattern
   */
  async execute(
    context: NodeExecutionContext,
  ): Promise<NodeExecutionResult> {
    try {
      const prepResult = await this.prep(context);
      const execResult = await this.exec(prepResult, context);
      const action = await this.post(context, prepResult, execResult);

      return {
        action: action || 'default',
        output: execResult,
        shouldContinue: true,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error(String(error)),
        shouldContinue: false,
      };
    }
  }

  /**
   * Validate node configuration
   */
  validateConfig(): boolean {
    return true; // Override in subclasses
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getType(): string {
    return this.type;
  }

  getConfig(): Record<string, unknown> {
    return this.config;
  }
}

