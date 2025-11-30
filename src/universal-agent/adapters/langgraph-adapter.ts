import { UniversalBaseAdapter } from "../core/base-adapter";
import {
  UniversalFramework,
  UniversalAgentConfig,
  UniversalAgentResponse,
  UniversalAgentInvokeOptions,
  UniversalAgentInvokeInput,
  UniversalTool,
} from "../types";
import { normalizeInput } from "../utils/input-normalizer";

/**
 * LangGraph framework adapter using the proper StateGraph pattern
 */
export class LangGraphAdapter extends UniversalBaseAdapter {
  readonly framework: UniversalFramework = "langgraph";
  private graph: any = null;
  private toolsByName: Record<string, any> = {};
  private modelWithTools: any = null;

  protected async doInitialize(config: UniversalAgentConfig): Promise<void> {
    try {
      // Dynamic imports
      const { StateGraph, START, END } = await import("@langchain/langgraph");
      const { MessagesZodMeta } = await import("@langchain/langgraph");
      const { registry } = await import("@langchain/langgraph/zod");
      const { tool } = await import("@langchain/core/tools");
      const { ChatOpenAI } = await import("@langchain/openai");
      const { SystemMessage, HumanMessage, isAIMessage, ToolMessage } = await import("@langchain/core/messages");
      const z = await import("zod");

      // Get model
      const model = config.model || new ChatOpenAI({ model: "gpt-4o-mini" });

      // Convert UniversalTools to LangGraph tools using @langchain/core/tools
      const langgraphTools = (config.tools || []).map((universalTool: UniversalTool) => {
        const toolSchema = universalTool.parameters || z.z.object({});
        
        return tool(
          async (params: any) => {
            const toolParams = typeof params === "object" && params !== null 
              ? params 
              : { input: params };
            
            try {
              return await universalTool.execute(toolParams);
            } catch {
              return await universalTool.execute(...Object.values(toolParams));
            }
          },
          {
            name: universalTool.name,
            description: universalTool.description,
            schema: toolSchema,
          }
        );
      });

      // Create toolsByName map for tool lookup
      this.toolsByName = {};
      langgraphTools.forEach((tool: any) => {
        this.toolsByName[tool.name] = tool;
      });

      // Bind tools to model
      this.modelWithTools = model.bindTools(langgraphTools);

      // Define state schema
      const MessagesState = z.z.object({
        messages: z.z
          .array((z.z as any).custom())
          .register(registry, MessagesZodMeta),
        llmCalls: z.z.number().optional(),
      });

      // Define LLM call node
      const llmCall = async (state: any) => {
        const systemPrompt = config.systemPrompt || config.options?.systemMessage || config.options?.systemPrompt || "You are a helpful assistant.";
        return {
          messages: await this.modelWithTools.invoke([
            new SystemMessage(systemPrompt),
            ...state.messages,
          ]),
          llmCalls: (state.llmCalls ?? 0) + 1,
        };
      };

      // Define tool node
      const toolNode = async (state: any) => {
        const lastMessage = state.messages.at(-1);
        if (lastMessage == null || !isAIMessage(lastMessage)) {
          return { messages: [] };
        }

        const result: any[] = [];
        for (const toolCall of lastMessage.tool_calls ?? []) {
          const tool = this.toolsByName[toolCall.name];
          if (tool) {
            const observation = await tool.invoke(toolCall.args);
            result.push(new ToolMessage({
              content: typeof observation === "string" ? observation : JSON.stringify(observation),
              tool_call_id: toolCall.id,
            }));
          }
        }
        return { messages: result };
      };

      // Define conditional logic
      const shouldContinue = async (state: any) => {
        const lastMessage = state.messages.at(-1);
        if (lastMessage == null || !isAIMessage(lastMessage)) return END;
        if (lastMessage.tool_calls?.length) {
          return "toolNode";
        }
        return END;
      };

      // Build graph
      const graph = new StateGraph(MessagesState)
        .addNode("llmCall", llmCall)
        .addNode("toolNode", toolNode)
        .addEdge(START, "llmCall")
        .addConditionalEdges("llmCall", shouldContinue, ["toolNode", END])
        .addEdge("toolNode", "llmCall");

      // Compile graph
      this.graph = graph.compile();
    } catch (error) {
      throw new Error(
        `Failed to initialize LangGraph adapter: ${error instanceof Error ? error.message : String(error)}. Ensure @langchain/langgraph and @langchain/core are installed.`
      );
    }
  }

  async invoke(input: UniversalAgentInvokeInput, options?: UniversalAgentInvokeOptions): Promise<UniversalAgentResponse> {
    this.ensureInitialized();

    const startTime = Date.now();
    try {
      const { HumanMessage, SystemMessage } = await import("@langchain/core/messages");
      // Get LangGraph-specific invoke options
      const langgraphInvokeOptions = options?.framework?.langgraph || {};
      // Extract configurable from framework options or fallback to metadata.config (backward compatibility)
      const graphConfig = langgraphInvokeOptions.configurable || options?.metadata?.config || {};

      // Normalize input to messages format
      const normalizedMessages = normalizeInput(input);
      
      // Convert to LangChain message types
      const langchainMessages = normalizedMessages.map((msg) => {
        if (msg.role === "system") {
          return new SystemMessage(msg.content);
        } else if (msg.role === "user") {
          return new HumanMessage(msg.content);
        } else {
          // For assistant and tool messages, use HumanMessage as fallback
          return new HumanMessage(msg.content);
        }
      });

      const result = await this.graph.invoke(
        {
          messages: langchainMessages,
        },
        graphConfig
      );

      const executionTime = Date.now() - startTime;
      
      // Extract the last message content
      const lastMessage = result.messages?.[result.messages.length - 1];
      let output: string;
      if (lastMessage) {
        if (typeof lastMessage === "string") {
          output = lastMessage;
        } else if (lastMessage.content) {
          output = typeof lastMessage.content === "string" 
            ? lastMessage.content 
            : JSON.stringify(lastMessage.content);
        } else if (lastMessage.text) {
          output = lastMessage.text;
        } else {
          output = JSON.stringify(lastMessage);
        }
      } else {
        output = JSON.stringify(result);
      }

      return {
        output,
        metadata: {
          framework: this.framework,
          executionTime,
          llmCalls: result.llmCalls,
          ...result.metadata,
          ...options?.metadata,
        },
      };
    } catch (error) {
      throw new Error(
        `LangGraph invocation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

}

