import { IFrameworkAdapter } from "../core/interfaces";
import { UniversalFramework } from "../types";
import { DeepAgentsAdapter } from "./deepagents-adapter";

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

      case "deepagents":
        return new DeepAgentsAdapter();
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

export { DeepAgentsAdapter } from "./deepagents-adapter";


