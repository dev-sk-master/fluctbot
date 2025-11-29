/**
 * Node registry for managing available node types
 * Uses factory pattern to create node instances
 */

import { Injectable } from '@nestjs/common';
import { BaseNode } from './base-node';

export interface NodeFactory {
  createInstance(
    id: string,
    name: string,
    config: Record<string, unknown>,
  ): BaseNode;
  getDefaultConfig(): Record<string, unknown>;
  getType(): string;
  getDescription(): string;
}

@Injectable()
export class NodeRegistry {
  private factories = new Map<string, NodeFactory>();

  /**
   * Register a node factory
   */
  register(factory: NodeFactory): void {
    this.factories.set(factory.getType(), factory);
  }

  /**
   * Get node factory by type
   */
  getNode(type: string): NodeFactory | undefined {
    return this.factories.get(type);
  }

  /**
   * Get all registered node types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Check if a node type is registered
   */
  isRegistered(type: string): boolean {
    return this.factories.has(type);
  }
}

