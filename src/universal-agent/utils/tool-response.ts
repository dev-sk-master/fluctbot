/**
 * Tool Response Utilities
 * Helper functions for creating standardized tool responses
 */

import {
  ToolSuccessResponse,
  ToolErrorResponse,
  ToolExecutionResult,
  ToolResponseMetadata,
} from '../types';

/**
 * Create a successful tool response
 * 
 * @param toolName - Name of the tool that generated this response
 * @param summary - Human-readable summary of the result
 * @param data - Structured data from the tool execution
 * @param metadata - Optional metadata (timestamp, executionTime, etc.)
 * @param additionalFields - Additional tool-specific fields
 * 
 * @example
 * ```typescript
 * return createSuccessResponse(
 *   'web_search',
 *   'Found 5 results about maritime shipping',
 *   { results: [...], query: 'maritime shipping' },
 *   { executionTime: 250 }
 * );
 * ```
 */
export function createSuccessResponse(
  toolName: string,
  summary: string,
  data?: Record<string, any>,
  metadata?: Partial<ToolResponseMetadata>,
  additionalFields?: Record<string, any>
): ToolSuccessResponse {
  const response: ToolSuccessResponse = {
    success: true,
    summary,
    ...(data && { data }),
    metadata: {
      tool: toolName,
      timestamp: Date.now(),
      ...metadata,
    },
    ...additionalFields,
  };

  return response;
}

/**
 * Create an error tool response
 * Use this for expected errors (e.g., "not found", "validation failed")
 * For unexpected errors, throw Error instead
 * 
 * @param toolName - Name of the tool that generated this response
 * @param message - Detailed error message
 * @param summary - Human-readable error summary (defaults to message if not provided)
 * @param error - Optional error details (code, type, details)
 * @param metadata - Optional metadata
 * 
 * @example
 * ```typescript
 * return createErrorResponse(
 *   'get_vessel_info',
 *   'Vessel not found',
 *   'No vessel found with IMO 1234567',
 *   { code: 'NOT_FOUND', type: 'VALIDATION_ERROR' }
 * );
 * ```
 */
export function createErrorResponse(
  toolName: string,
  message: string,
  summary?: string,
  error?: {
    code?: string;
    type?: string;
    details?: any;
  },
  metadata?: Partial<ToolResponseMetadata>
): ToolErrorResponse {
  const response: ToolErrorResponse = {
    success: false,
    summary: summary || message,
    message,
    ...(error && { error }),
    metadata: {
      tool: toolName,
      timestamp: Date.now(),
      ...metadata,
    },
  };

  return response;
}

/**
 * Helper to add execution time to metadata
 */
export function withExecutionTime<T extends ToolExecutionResult>(
  response: T,
  startTime: number
): T {
  const executionTime = Date.now() - startTime;
  return {
    ...response,
    metadata: {
      ...response.metadata,
      executionTime,
    },
  } as T;
}

/**
 * Convert tool response to string for LLM consumption
 * LLMs receive tool results as strings, so this formats the response appropriately
 * 
 * @param response - Tool execution result
 * @returns String representation suitable for LLM consumption
 */
export function formatToolResponseForLLM(response: ToolExecutionResult): string {
  // For LLMs, prioritize the summary (human-readable)
  // Include structured data as JSON if summary is not sufficient
  if (response.success) {
    if (response.data && Object.keys(response.data).length > 0) {
      // If we have structured data, include it as JSON for context
      return `${response.summary}\n\n[Structured Data: ${JSON.stringify(response.data, null, 2)}]`;
    }
    return response.summary;
  } else {
    // For errors, include the message
    return `Error: ${response.summary}${response.message !== response.summary ? `\nDetails: ${response.message}` : ''}`;
  }
}

/**
 * Normalize any tool result to a standardized response format
 * Handles strings, objects, arrays, and existing ToolExecutionResult
 * 
 * @param result - Raw result from tool execution (can be any type)
 * @param toolName - Name of the tool that generated this result
 * @param executionTime - Optional execution time in milliseconds
 * @returns Standardized ToolExecutionResult
 */
export function normalizeToolResult(
  result: any,
  toolName: string,
  executionTime?: number
): ToolExecutionResult {
  // If already a ToolExecutionResult, just add metadata if needed
  if (result && typeof result === 'object' && 'success' in result) {
    const existingResult = result as ToolExecutionResult;
    if (executionTime !== undefined) {
      existingResult.metadata = {
        ...existingResult.metadata,
        tool: toolName,
        timestamp: existingResult.metadata?.timestamp || Date.now(),
        executionTime,
      };
    } else if (!existingResult.metadata) {
      existingResult.metadata = {
        tool: toolName,
        timestamp: Date.now(),
      };
    }
    return existingResult;
  }

  // Convert different result types to standardized format
  let summary: string;
  let data: Record<string, any> | undefined;

  if (typeof result === 'string') {
    summary = result;
  } else if (Array.isArray(result)) {
    summary = `Returned ${result.length} item(s)`;
    data = { items: result, count: result.length };
  } else if (result && typeof result === 'object') {
    // If object has a summary field, use it; otherwise generate one
    if (result.summary && typeof result.summary === 'string') {
      summary = result.summary;
      // Extract data fields (exclude summary, success, metadata)
      const { summary: _, success: __, metadata: ___, ...rest } = result;
      data = Object.keys(rest).length > 0 ? rest : undefined;
    } else {
      // Generate summary from object
      summary = `Tool execution completed successfully`;
      data = result;
    }
  } else if (result === null || result === undefined) {
    summary = 'Tool execution completed (no result)';
  } else {
    // Primitive types (number, boolean, etc.)
    summary = String(result);
    data = { value: result };
  }

  return createSuccessResponse(
    toolName,
    summary,
    data,
    executionTime !== undefined ? { executionTime } : undefined
  );
}

/**
 * Wrap a tool's execute function to automatically:
 * - Track execution time
 * - Normalize the result to standardized format
 * - Handle errors properly
 * 
 * @param toolName - Name of the tool
 * @param executeFn - Original execute function
 * @returns Wrapped execute function that returns ToolExecutionResult
 * 
 * @example
 * ```typescript
 * execute: wrapToolExecution('web_search', async (params) => {
 *   const results = await searchAPI(params.query);
 *   return { results, count: results.length }; // Simple return
 * })
 * ```
 */
export function wrapToolExecution(
  toolName: string,
  executeFn: (...args: any[]) => Promise<any> | any
): (...args: any[]) => Promise<ToolExecutionResult> {
  return async (...args: any[]): Promise<ToolExecutionResult> => {
    const startTime = Date.now();
    
    try {
      const rawResult = await executeFn(...args);
      const executionTime = Date.now() - startTime;
      
      // Normalize the result to standardized format
      return normalizeToolResult(rawResult, toolName, executionTime);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // For thrown errors, return error response
      return createErrorResponse(
        toolName,
        errorMessage,
        `Tool execution failed: ${errorMessage}`,
        {
          type: 'EXECUTION_ERROR',
          details: error instanceof Error ? { name: error.name, stack: error.stack } : undefined,
        },
        { executionTime }
      );
    }
  };
}

