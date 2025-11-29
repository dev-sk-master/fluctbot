/**
 * Workflow Builder
 * Fluent API for building workflows
 */

import {
  WorkflowDefinition,
  WorkflowNode,
  NodeConnection,
} from '../types/workflow.types';

export class WorkflowBuilder {
  private id: string;
  private name: string;
  private description?: string;
  private nodes: WorkflowNode[] = [];
  private connections: NodeConnection[] = [];
  private startNodeId?: string;
  private version = 1;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  withDescription(description: string): this {
    this.description = description;
    return this;
  }

  withVersion(version: number): this {
    this.version = version;
    return this;
  }

  addNode(node: WorkflowNode): this {
    this.nodes.push(node);
    return this;
  }

  connect(
    fromNodeId: string,
    toNodeId: string,
    action?: string,
  ): this {
    this.connections.push({
      from: fromNodeId,
      to: toNodeId,
      action,
    });
    return this;
  }

  setStartNode(nodeId: string): this {
    this.startNodeId = nodeId;
    return this;
  }

  build(): WorkflowDefinition {
    if (!this.startNodeId) {
      throw new Error('Start node must be set');
    }

    if (this.nodes.length === 0) {
      throw new Error('Workflow must have at least one node');
    }

    const now = new Date();

    return {
      id: this.id,
      name: this.name,
      description: this.description,
      nodes: this.nodes,
      connections: this.connections,
      startNodeId: this.startNodeId,
      version: this.version,
      createdAt: now,
      updatedAt: now,
    };
  }
}

