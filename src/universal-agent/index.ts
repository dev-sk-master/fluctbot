/**
 * UniversalAgent - Framework-agnostic orchestrator for multiple AI agent backends
 *
 * @packageDocumentation
 */

// Main exports
export { UniversalAgent } from "./universal-agent";

// Type exports
export type {
  UniversalFramework,
  UniversalTool,
  UniversalAgentResponse,
  UniversalAgentInvokeOptions,
  UniversalAgentInvokeInput,
  UniversalMessage,
  UniversalAgentConfig,
  FrameworkOptions,
  FrameworkInvokeOptions,
  InterruptConfig,
  // Tool response types
  ToolResponse,
  ToolSuccessResponse,
  ToolErrorResponse,
  ToolExecutionResult,
  ToolResponseMetadata,
  // Tool parameter types
  ToolParams,
  InferToolParams,
} from "./types";

// Core interfaces
export type { IFrameworkAdapter, IToolRegistry } from "./core/interfaces";

// Adapter exports
export {
  AdapterFactory,
  LangChainAdapter,
  LangGraphAdapter,
  CrewAIAdapter,
  DeepAgentsAdapter,
  OpenAIAgentsAdapter,
} from "./adapters";

// Base adapter for custom implementations
export { UniversalBaseAdapter, BaseAdapter } from "./core/base-adapter";

// Utility exports
export { UniversalToolRegistry, ToolRegistry } from "./utils/tool-registry";
export { normalizeInput, extractUserInput } from "./utils/input-normalizer";
export { toolToText } from "./utils/tool-utils";
export {
  createSuccessResponse,
  createErrorResponse,
  withExecutionTime,
  formatToolResponseForLLM,
  normalizeToolResult,
  wrapToolExecution,
} from "./utils/tool-response";

// Re-export types for convenience
export { UniversalAgentConfigSchema } from "./types";

