/**
 * Workflow Service
 * Manages workflow definitions and executions
 */

import { Injectable, Logger } from '@nestjs/common';
import { WorkflowEngine } from '../core/workflow-engine';
import {
  WorkflowDefinition,
  WorkflowExecution,
} from '../types/workflow.types';
import { FluctMessage } from '../types/message.types';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);
  private workflows = new Map<string, WorkflowDefinition>();
  private executions = new Map<string, WorkflowExecution>();

  constructor(private readonly workflowEngine: WorkflowEngine) {}

  /**
   * Register a workflow definition
   */
  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
    this.logger.log(`Registered workflow: ${workflow.name} (${workflow.id})`);
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get all workflows
   */
  getAllWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Execute a workflow with a message
   */
  async executeWorkflow(
    workflowId: string,
    message: FluctMessage,
  ): Promise<WorkflowExecution> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    this.logger.log(
      `Executing workflow ${workflow.name} for message ${message.id}`,
    );

    const execution = await this.workflowEngine.executeWorkflow(
      workflow,
      message,
    );

    // Store execution
    this.executions.set(execution.id, execution);

    return execution;
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get executions for a workflow
   */
  getWorkflowExecutions(workflowId: string): WorkflowExecution[] {
    return Array.from(this.executions.values()).filter(
      (e) => e.workflowId === workflowId,
    );
  }
}

