/**
 * Workflow execution types
 */

export type NodeId = string;
export type Action = string;

export interface NodeConnection {
  from: NodeId;
  to: NodeId;
  action?: Action; // If undefined, uses 'default'
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  connections: NodeConnection[];
  startNodeId: NodeId;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowNode {
  id: NodeId;
  type: string; // e.g., 'telegram-input', 'telegram-output', 'processor'
  name: string;
  config: Record<string, unknown>; // Node-specific configuration
  position?: {
    x: number;
    y: number;
  };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  messageId: string;
  status: WorkflowExecutionStatus;
  currentNodeId?: NodeId;
  sharedData: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export enum WorkflowExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface NodeExecutionContext {
  executionId: string;
  workflowId: string;
  nodeId: NodeId;
  sharedData: Record<string, unknown>;
  message: unknown; // FluctMessage
  config: Record<string, unknown>;
}

export interface NodeExecutionResult {
  action?: Action;
  output?: unknown;
  error?: Error;
  shouldContinue: boolean;
}

