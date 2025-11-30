import { IFrameworkAdapter } from "../core/interfaces";
import { UniversalFramework } from "../types";
import { LangChainAdapter } from "./langchain-adapter";
import { LangGraphAdapter } from "./langgraph-adapter";
import { CrewAIAdapter } from "./crewai-adapter";
import { DeepAgentsAdapter } from "./deepagents-adapter";
import { OpenAIAgentsAdapter } from "./openai-agents-adapter";
import { PocketFlowAdapter } from "./pocketflow-adapter";

/**
 * Adapter factory for creating framework-specific adapters
 */
export class AdapterFactory {
  /**
   * Create an adapter for the specified framework
   */
  static create(framework: UniversalFramework, customAdapter?: IFrameworkAdapter): IFrameworkAdapter {
    if (customAdapter) {
      return customAdapter;
    }

    switch (framework) {
      case "langchain":
        return new LangChainAdapter();
      case "langgraph":
        return new LangGraphAdapter();
      case "crewai":
        return new CrewAIAdapter();
      case "deepagents":
        return new DeepAgentsAdapter();
      case "openai-agents":
        return new OpenAIAgentsAdapter();
      case "pocketflow":
        return new PocketFlowAdapter();
      case "custom":
        throw new Error("Custom framework requires a custom adapter to be provided");
      default:
        throw new Error(`Unsupported framework: ${framework}`);
    }
  }

  /**
   * Get list of supported frameworks
   */
  static getSupportedFrameworks(): UniversalFramework[] {
    return ["langchain", "langgraph", "crewai", "deepagents", "openai-agents", "pocketflow", "custom"];
  }
}

export { LangChainAdapter } from "./langchain-adapter";
export { LangGraphAdapter } from "./langgraph-adapter";
export { CrewAIAdapter } from "./crewai-adapter";
export { DeepAgentsAdapter } from "./deepagents-adapter";
export { OpenAIAgentsAdapter } from "./openai-agents-adapter";
export { PocketFlowAdapter } from "./pocketflow-adapter";

