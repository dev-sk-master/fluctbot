import { UniversalFramework, UniversalTool } from "../types";

/**
 * UniversalToolRegistry - Tool Registry for managing and converting tools across frameworks
 */
export class UniversalToolRegistry {
  private tools: Map<string, UniversalTool> = new Map();

  /**
   * Initialize registry with tools
   */
  constructor(tools: UniversalTool[] = []) {
    tools.forEach((tool) => this.register(tool));
  }

  /**
   * Register a tool (add or update)
   */
  register(tool: UniversalTool): void {
    if (!tool.name) {
      throw new Error("Tool must have a name");
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Add a tool (alias for register)
   */
  add(tool: UniversalTool): void {
    this.register(tool);
  }

  /**
   * Remove a tool by name
   */
  remove(toolName: string): boolean {
    return this.tools.delete(toolName);
  }

  /**
   * Get a tool by name
   */
  get(toolName: string): UniversalTool | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Check if a tool exists
   */
  has(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get all tools as an array
   */
  getAll(): UniversalTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get the number of registered tools
   */
  size(): number {
    return this.tools.size;
  }

  /**
   * Convert framework-specific tool to UniversalTool
   */
  toUnified(frameworkTool: any, framework: UniversalFramework): UniversalTool {
    // If already a UniversalTool, return as-is
    if (this.isUniversalTool(frameworkTool)) {
      return frameworkTool;
    }

    // Framework-specific conversions
    switch (framework) {
      case "langchain":
        return this.fromLangChainTool(frameworkTool);
      case "langgraph":
        return this.fromLangGraphTool(frameworkTool);
      case "crewai":
        return this.fromCrewAITool(frameworkTool);
      case "deepagents":
        return this.fromDeepAgentsTool(frameworkTool);
      default:
        return this.wrapAsUnified(frameworkTool);
    }
  }

  /**
   * Convert UniversalTool to framework-specific tool
   */
  fromUnified(unifiedTool: UniversalTool, framework: UniversalFramework): any {
    switch (framework) {
      case "langchain":
        return this.toLangChainTool(unifiedTool);
      case "langgraph":
        return this.toLangGraphTool(unifiedTool);
      case "crewai":
        return this.toCrewAITool(unifiedTool);
      case "deepagents":
        return this.toDeepAgentsTool(unifiedTool);
      default:
        return unifiedTool;
    }
  }

  /**
   * Convert all registered tools to framework-specific format
   */
  convertToFramework(framework: UniversalFramework): any[] {
    return this.getAll().map((tool) => this.fromUnified(tool, framework));
  }

  /**
   * Register multiple tools at once
   */
  registerMany(tools: UniversalTool[]): void {
    tools.forEach((tool) => this.register(tool));
  }

  private isUniversalTool(tool: any): tool is UniversalTool {
    return (
      typeof tool === "object" &&
      tool !== null &&
      typeof tool.name === "string" &&
      typeof tool.description === "string" &&
      typeof tool.execute === "function"
    );
  }

  private fromLangChainTool(tool: any): UniversalTool {
    return {
      name: tool.name || tool.func?.name || "unknown",
      description: tool.description || "",
      parameters: tool.schema,
      execute: async (...args: any[]) => {
        // New LangChain API: tool() creates tools with invoke method
        if (tool.invoke) {
          return await tool.invoke(...args);
        } else if (tool.call) {
          return await tool.call(...args);
        } else if (tool.func) {
          return await tool.func(...args);
        } else if (typeof tool === "function") {
          // Direct function call
          return await tool(...args);
        }
        throw new Error("Tool execution method not found");
      },
    };
  }

  private fromLangGraphTool(tool: any): UniversalTool {
    return this.fromLangChainTool(tool); // LangGraph uses similar structure
  }

  private fromCrewAITool(tool: any): UniversalTool {
    return {
      name: tool.name || tool.constructor?.name || "unknown",
      description: tool.description || "",
      execute: async (...args: any[]) => {
        if (tool._execute) {
          return await tool._execute(...args);
        } else if (tool.execute) {
          return await tool.execute(...args);
        }
        throw new Error("Tool execution method not found");
      },
    };
  }

  private fromDeepAgentsTool(tool: any): UniversalTool {
    return {
      name: tool.name || "unknown",
      description: tool.description || "",
      parameters: tool.parameters,
      execute: async (...args: any[]) => {
        if (tool.execute) {
          return await tool.execute(...args);
        } else if (tool.func) {
          return await tool.func(...args);
        }
        throw new Error("Tool execution method not found");
      },
    };
  }

  private wrapAsUnified(tool: any): UniversalTool {
    return {
      name: tool.name || "unknown",
      description: tool.description || "",
      execute: async (...args: any[]) => {
        if (tool.execute) {
          return await tool.execute(...args);
        } else if (tool.func) {
          return await tool.func(...args);
        } else if (typeof tool === "function") {
          return await tool(...args);
        }
        throw new Error("Tool execution method not found");
      },
    };
  }

  private toLangChainTool(unifiedTool: UniversalTool): any {
    // This will be handled by adapters using langchain's tool() function
    // Return structure for reference
    return {
      name: unifiedTool.name,
      description: unifiedTool.description,
      schema: unifiedTool.parameters,
      execute: async (params: any) => {
        const toolParams = typeof params === "object" && params !== null 
          ? params 
          : { input: params };
        try {
          return await unifiedTool.execute(toolParams);
        } catch {
          return await unifiedTool.execute(...Object.values(toolParams));
        }
      },
    };
  }

  private toLangGraphTool(unifiedTool: UniversalTool): any {
    return this.toLangChainTool(unifiedTool); // Similar structure
  }

  private toCrewAITool(unifiedTool: UniversalTool): any {
    return {
      name: unifiedTool.name,
      description: unifiedTool.description,
      _execute: async (...args: any[]) => {
        return await unifiedTool.execute(...args);
      },
    };
  }

  private toDeepAgentsTool(unifiedTool: UniversalTool): any {
    return {
      name: unifiedTool.name,
      description: unifiedTool.description,
      parameters: unifiedTool.parameters,
      execute: async (...args: any[]) => {
        return await unifiedTool.execute(...args);
      },
    };
  }
}

/**
 * Backward compatibility alias
 */
export const ToolRegistry = UniversalToolRegistry;

