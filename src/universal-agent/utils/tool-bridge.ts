import { UniversalFramework, UniversalTool } from "../types";

/**
 * Tool bridge implementation for cross-framework tool operations
 * @deprecated Use UniversalToolRegistry instead
 */
export class ToolBridge {
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

  bridge(tools: UniversalTool[], targetFramework: UniversalFramework): any[] {
    return tools.map((tool) => this.fromUnified(tool, targetFramework));
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
    // Dynamic import to avoid requiring langchain at build time
    try {
      // Return a structure compatible with LangChain's tool format
      return {
        name: unifiedTool.name,
        description: unifiedTool.description,
        schema: unifiedTool.parameters,
        invoke: async (input: any) => {
          if (typeof input === "string") {
            return await unifiedTool.execute(input);
          }
          return await unifiedTool.execute(...Object.values(input));
        },
      };
    } catch (error) {
      throw new Error("LangChain tool conversion failed. Ensure @langchain/core is installed.");
    }
  }

  private toLangGraphTool(unifiedTool: UniversalTool): any {
    return this.toLangChainTool(unifiedTool); // Similar structure
  }

  private toCrewAITool(unifiedTool: UniversalTool): any {
    try {
      // CrewAI uses a different structure
      return {
        name: unifiedTool.name,
        description: unifiedTool.description,
        _execute: async (...args: any[]) => {
          return await unifiedTool.execute(...args);
        },
      };
    } catch (error) {
      throw new Error("CrewAI tool conversion failed. Ensure crewai is installed.");
    }
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

