import "dotenv/config";
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
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent, tool } from "langchain";


/**
 * LangChain framework adapter using the new createAgent API
 */
export class LangChainAdapter extends UniversalBaseAdapter {
  readonly framework: UniversalFramework = "langchain";
  private agent: any = null;

  protected async doInitialize(config: UniversalAgentConfig): Promise<void> {
    try {
      // Dynamic import to avoid requiring langchain at build time
      //const { createAgent, tool } = await import("langchain");
      //const { ChatOpenAI } = await import("@langchain/openai");



      // Get model - can be a string (model name) or a model instance
      // According to LangChain docs, createAgent accepts:
      // - String model identifier (e.g., "claude-sonnet-4-5-20250929")
      // - Model instance (e.g., ChatOpenAI)
      let model = config.model;
      if (!model) {
        // Default to a string model identifier if no model provided
        model = "gpt-4o-mini";
      }

      // Convert UniversalTools to LangChain tools using the tool() function
      // LangChain's tool() signature: tool(function, { name, description, schema })
      const frameworkTools = (config.tools || []).map((universalTool: UniversalTool) => {
        // Get the schema - should be a zod schema if provided
        const toolSchema = universalTool.parameters || {};

        // Create tool following LangChain pattern:
        // tool((input) => result, { name, description, schema })
        return tool(
          async (input: any) => {
            // LangChain passes the input as an object matching the schema
            // Execute the UniversalTool with the input
            try {
              // If input is already an object, use it directly
              if (typeof input === "object" && input !== null) {
                return await universalTool.execute(input);
              }
              // Otherwise, wrap it
              return await universalTool.execute({ input });
            } catch (error) {
              // Fallback: try spreading if execute expects multiple args
              if (typeof input === "object" && input !== null) {
                return await universalTool.execute(...Object.values(input));
              }
              return await universalTool.execute(input);
            }
          },
          {
            name: universalTool.name,
            description: universalTool.description,
            schema: toolSchema,
          }
        );
      });


      const frameworkOptions = config.options?.framework?.langchain || {};

      // Extract checkpointer separately to avoid passing null
      const { checkpointer, ...restFrameworkOptions } = frameworkOptions;

      const { framework: _, ...universalOptions } = config.options || {};


      // Build agent config with systemPrompt support
      const agentConfig: any = {
        model: model,
        tools: frameworkTools,
        ...restFrameworkOptions, // Spread options without checkpointer
      };

      // Only include checkpointer if it's actually provided (not null/undefined)
      if (checkpointer) {
        agentConfig.checkpointer = checkpointer;
      }

      // Add systemPrompt if provided (LangChain createAgent supports systemMessage in options)
      if (config.systemPrompt) {
        agentConfig.systemPrompt = config.systemPrompt;
      }

      this.agent = createAgent(agentConfig);

    } catch (error) {
      throw new Error(
        `Failed to initialize LangChain adapter: ${error instanceof Error ? error.message : String(error)}.`
      );
    }
  }

  async invoke(input: UniversalAgentInvokeInput, options?: UniversalAgentInvokeOptions): Promise<UniversalAgentResponse> {
    this.ensureInitialized();

    const startTime = Date.now();
    try {

      const frameworkInvokeOptions = options?.framework?.langchain || {};


      const { framework: _, ...universalInvokeOptions } = options || {};


      // Normalize input to messages format
      const messages = normalizeInput(input);

      // New API uses messages format
      const result = await this.agent.invoke({
        messages,
        //...options,
      }, {
        callbacks: [
          {
            // ------- LLM EVENTS -------
            handleLLMStart: async (_llm: any, prompts: any) => {
              const promptStrings = Array.isArray(prompts)
                ? prompts.map((p) => (typeof p === "string" ? p : JSON.stringify(p, null, 2)))
                : [typeof prompts === "string" ? prompts : JSON.stringify(prompts, null, 2)];

              this.emit("llm:start", {
                prompts: promptStrings,
              });
            },

            handleLLMNewToken: async (token: any) => {
              this.emit("llm:token", {
                token,
              });
            },

            handleLLMEnd: async (output: any) => {
              this.emit("llm:end", output);
            },

            handleLLMError: async (err: any) => {
              this.emit("llm:error", {
                message: err?.message || String(err),
                stack: err?.stack,
              });
            },

            // // ------- TOOL EVENTS -------
            // handleToolStart: async (tool: any, input: any) => {
            //   this.emit("tool:start", {
            //     tool,
            //     input,
            //   });
            // },

            // handleToolEnd: async (output: any) => {
            //   this.emit("tool:end", {
            //     output,
            //   });
            // },

            // handleToolError: async (err: any) => {
            //   this.emit("tool:error", {
            //     message: err?.message || String(err),
            //     stack: err?.stack,
            //   });
            // },

            // ------- RETRIEVER EVENTS -------
            // handleRetrieverStart: async (_retriever: any, query: any) => {
            //   this.emit("retriever:start", {
            //     query,
            //   });
            // },

            // handleRetrieverEnd: async (output: any) => {
            //   this.emit("retriever:end", {
            //     output,
            //   });
            // },

            // ------- AGENT EVENTS -------
            // handleAgentAction: async (action: any) => {
            //   this.emit("agent:action", {
            //     action,
            //   });
            // },

            // handleAgentEnd: async (agentResult: any) => {
            //   this.emit("agent:end", {
            //     result: agentResult,
            //   });
            // },

            // handleAgentError: async (err: any) => {
            //   this.emit("agent:error", {
            //     message: err?.message || String(err),
            //     stack: err?.stack,
            //   });
            // },
          },
        ],
        recursionLimit: 50,
        timeout: 2 * 60 * 1000,
        ...frameworkInvokeOptions,
      });

      //console.log(JSON.stringify(result, null, 2));
      // Analyze messages to extract planning information
      // Langchain uses write_todos tool for planning
      if (result.messages && Array.isArray(result.messages)) {
        // console.log("result", JSON.stringify(result, null, 2));
        for (const message of result.messages) {
          // Check for tool calls to write_todos (planning)
          if (message.tool_calls) {
            for (const toolCall of message.tool_calls) {
              if (toolCall.name === 'write_todos' || toolCall.name === 'plan') {
                // Extract planning information
                const planContent = toolCall.args?.todos || toolCall.args?.plan || toolCall.args || '';
                this.emit('planning:step', {
                  plan: typeof planContent === 'string' ? planContent : JSON.stringify(planContent),
                  needsTools: true,
                  rawResponse: JSON.stringify(toolCall)
                });
              } else if (toolCall.name) {
                // Regular tool execution
                // this.emit('tool:execution', {
                //   toolName: toolCall.name,
                //   args: toolCall.args || {},
                //   result: undefined // Will be in tool message
                // });
              }
            }
          }

          // Check for tool messages (tool results)
          if (message.tool_call_id && message.content) {
            // Find corresponding tool call
            const toolCall = result.messages.find((m: any) =>
              m.tool_calls?.some((tc: any) => tc.id === message.tool_call_id)
            );
            if (toolCall?.tool_calls) {
              const matchingCall = toolCall.tool_calls.find((tc: any) => tc.id === message.tool_call_id);
              if (matchingCall && matchingCall.name !== 'write_todos') {
                this.emit('tool:execution', {
                  toolName: matchingCall.name,
                  args: matchingCall.args || {},
                  result: message.content
                });
              }
            }
          }
        }
      }


      const executionTime = Date.now() - startTime;

      // Extract output from messages or direct result
      let output = result.messages[result.messages.length - 1].content;
      // let output: string;
      // if (result.messages && result.messages.length > 0) {
      //   const lastMessage = result.messages[result.messages.length - 1];
      //   output = typeof lastMessage === "string"
      //     ? lastMessage
      //     : lastMessage.content || lastMessage.text || JSON.stringify(lastMessage);
      // } else {
      //   output = typeof result === "string"
      //     ? result
      //     : result.output || result.text || result.content || JSON.stringify(result);
      // }

      return {
        output,
        metadata: {
          framework: this.framework,
          executionTime,
          //...result.metadata,
          //...options?.metadata,
        },
      };
    } catch (error) {
      throw new Error(
        `LangChain invocation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

}

