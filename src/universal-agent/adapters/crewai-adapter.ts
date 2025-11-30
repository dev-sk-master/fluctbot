import { UniversalBaseAdapter } from "../core/base-adapter";
import {
  UniversalFramework,
  UniversalAgentConfig,
  UniversalAgentResponse,
  UniversalAgentInvokeOptions,
  UniversalAgentInvokeInput,
} from "../types";
import { normalizeInput, extractUserInput } from "../utils/input-normalizer";

/**
 * CrewAI framework adapter
 */
export class CrewAIAdapter extends UniversalBaseAdapter {
  readonly framework: UniversalFramework = "crewai";
  private crew: any = null;

  protected async doInitialize(config: UniversalAgentConfig): Promise<void> {
    try {
      // Dynamic import
      const { Crew, Agent, Task } = await import("crewai");

      // Convert unified tools to CrewAI format
      const unifiedTools = config.tools || [];
      const crewaiTools = unifiedTools.map((tool: any) => {
        // CrewAI uses a different structure
        return {
          name: tool.name,
          description: tool.description,
          _execute: async (...args: any[]) => {
            return await tool.execute(...args);
          },
        };
      });

      // Get CrewAI-specific options from options.framework.crewai
      const crewaiOptions = config.options?.framework?.crewai || {};
      
      // Create agent
      // Use systemPrompt for backstory if provided, otherwise use frameworkOptions
      const backstory = config.systemPrompt || crewaiOptions.backstory || "You are a helpful AI assistant";
      const agent = new Agent({
        role: crewaiOptions.role || "Assistant",
        goal: crewaiOptions.goal || "Help the user with their task",
        backstory: backstory,
        tools: crewaiTools,
        verbose: crewaiOptions.verbose !== false,
      });

      // Create crew
      this.crew = new Crew({
        agents: [agent],
        tasks: [
          new Task({
            description: "Process the user's request",
            agent: agent,
          }),
        ],
        verbose: crewaiOptions.verbose !== false,
      });
    } catch (error) {
      throw new Error(
        `Failed to initialize CrewAI adapter: ${error instanceof Error ? error.message : String(error)}. Ensure crewai is installed.`
      );
    }
  }

  async invoke(input: UniversalAgentInvokeInput, options?: UniversalAgentInvokeOptions): Promise<UniversalAgentResponse> {
    this.ensureInitialized();

    const startTime = Date.now();
    try {
      // Normalize input and extract user message for CrewAI task description
      const messages = normalizeInput(input);
      // CrewAI uses task descriptions, so we combine all user messages
      const userMessages = messages.filter(m => m.role === "user");
      const systemMessages = messages.filter(m => m.role === "system");
      
      // Combine system and user messages for task description
      let taskDescription = "";
      if (systemMessages.length > 0) {
        taskDescription = systemMessages.map(m => m.content).join("\n") + "\n\n";
      }
      taskDescription += userMessages.map(m => m.content).join("\n") || extractUserInput(input);
      
      // CrewAI uses tasks, so we create a dynamic task
      const { Task } = await import("crewai");
      const agents = this.crew.agents || [];

      if (agents.length === 0) {
        throw new Error("No agents available in crew");
      }

      const task = new Task({
        description: taskDescription,
        agent: agents[0],
      });

      const result = await this.crew.run([task]);
      const executionTime = Date.now() - startTime;

      return {
        output: typeof result === "string" ? result : result.result || result.output || JSON.stringify(result),
        metadata: {
          framework: this.framework,
          executionTime,
          ...result.metadata,
          ...options?.metadata,
        },
      };
    } catch (error) {
      throw new Error(
        `CrewAI invocation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

