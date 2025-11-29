/**
 * Workflow execution engine
 * Orchestrates node execution following the flow graph
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowExecutionStatus,
  NodeConnection,
  NodeExecutionContext,
  NodeExecutionResult,
} from '../types/workflow.types';
import { FluctMessage } from '../types/message.types';
import { BaseNode } from './base-node';
import { NodeRegistry } from './node-registry';

@Injectable()
export class WorkflowEngine {
  private readonly logger = new Logger(WorkflowEngine.name);

  constructor(private readonly nodeRegistry: NodeRegistry) {}

  /**
   * Execute a workflow with a message
   */
  async executeWorkflow(
    workflow: WorkflowDefinition,
    message: FluctMessage,
  ): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      id: this.generateExecutionId(),
      workflowId: workflow.id,
      messageId: message.id,
      status: WorkflowExecutionStatus.RUNNING,
      sharedData: {
        message,
        workflowId: workflow.id,
      },
      startedAt: new Date(),
    };
   
    try {
      // Build connection map for fast lookup
      const connections = this.buildConnectionMap(workflow.connections);

      // Start from the start node
      let currentNodeId: string | undefined = workflow.startNodeId;
      execution.currentNodeId = currentNodeId;

      // Execute nodes following the flow
      while (currentNodeId) {
        const node = this.findNode(workflow, currentNodeId);
        if (!node) {
          throw new Error(`Node ${currentNodeId} not found in workflow`);
        }

        // Get node instance from registry
        const nodeInstance = this.nodeRegistry.getNode(node.type);
        if (!nodeInstance) {
          throw new Error(`Node type ${node.type} not registered`);
        }

        // Create node instance with workflow node config
        const instance = nodeInstance.createInstance(
          node.id,
          node.name,
          { ...nodeInstance.getDefaultConfig(), ...node.config },
        );

        // Execute the node
        const context: NodeExecutionContext = {
          executionId: execution.id,
          workflowId: workflow.id,
          nodeId: node.id,
          sharedData: execution.sharedData,
          message,
          config: instance.getConfig(),
        };

        this.logger.debug(
          `Executing node ${node.name} (${node.type}) in workflow ${workflow.id}`,
        );

        const result: NodeExecutionResult = await instance.execute(context);

        // Update shared data
        execution.sharedData = context.sharedData;

        // Check for errors
        if (result.error || !result.shouldContinue) {
          execution.status = WorkflowExecutionStatus.FAILED;
          execution.error = result.error?.message || 'Node execution failed';
          execution.completedAt = new Date();
          return execution;
        }

        // Find next node based on action
        const action = result.action || 'default';
        const nextNodeId = this.findNextNode(
          connections,
          currentNodeId,
          action,
        );

        currentNodeId = nextNodeId;
        execution.currentNodeId = currentNodeId || undefined;

        // If no next node, workflow is complete
        if (!currentNodeId) {
          execution.status = WorkflowExecutionStatus.COMPLETED;
          execution.completedAt = new Date();
          break;
        }
      }

      return execution;
    } catch (error) {
      this.logger.error(
        `Workflow execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      execution.status = WorkflowExecutionStatus.FAILED;
      execution.error =
        error instanceof Error ? error.message : String(error);
      execution.completedAt = new Date();
      return execution;
    }
  }

  /**
   * Build a map of connections for fast lookup
   */
  private buildConnectionMap(
    connections: NodeConnection[],
  ): Map<string, Map<string, string>> {
    const map = new Map<string, Map<string, string>>();

    for (const conn of connections) {
      if (!map.has(conn.from)) {
        map.set(conn.from, new Map());
      }
      const actionMap = map.get(conn.from)!;
      actionMap.set(conn.action || 'default', conn.to);
    }

    return map;
  }

  /**
   * Find next node based on current node and action
   */
  private findNextNode(
    connections: Map<string, Map<string, string>>,
    currentNodeId: string,
    action: string,
  ): string | undefined {
    const nodeConnections = connections.get(currentNodeId);
    if (!nodeConnections) {
      return undefined;
    }

    // Try specific action first
    if (nodeConnections.has(action)) {
      return nodeConnections.get(action);
    }

    // Fallback to default
    if (nodeConnections.has('default')) {
      return nodeConnections.get('default');
    }

    return undefined;
  }

  /**
   * Find node in workflow definition
   */
  private findNode(
    workflow: WorkflowDefinition,
    nodeId: string,
  ): WorkflowNode | undefined {
    return workflow.nodes.find((n) => n.id === nodeId);
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Import WorkflowNode
import { WorkflowNode } from '../types/workflow.types';

