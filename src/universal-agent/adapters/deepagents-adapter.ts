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
import { normalizeToolResult } from "../utils/tool-response";


/**
 * DeepAgents framework adapter using the createDeepAgent API
 */
export class DeepAgentsAdapter extends UniversalBaseAdapter {
  readonly framework: UniversalFramework = "deepagents";
  private agent: any = null;

  protected async doInitialize(config: UniversalAgentConfig): Promise<void> {
    try {
      // Dynamic import
      const { createDeepAgent } = await import("deepagents");
      const { tool } = await import("langchain");

      // Convert UniversalTools to LangChain tools (DeepAgents uses LangChain tools)
      const frameworkTools = (config.tools || []).map((universalTool: UniversalTool) => {
        const toolSchema = universalTool.parameters || {};

        return tool(
          async (params: any) => {
            const startTime = Date.now();
            const toolParams = typeof params === "object" && params !== null
              ? params
              : { input: params };

            try {
              const rawResult = await universalTool.execute(toolParams);
              const executionTime = Date.now() - startTime;
              
              // Normalize result to standardized format (handles any return type)
              const normalizedResult = normalizeToolResult(
                rawResult,
                universalTool.name,
                executionTime
              );
              
              // For LLM consumption, return the summary or formatted response
              // LangChain/DeepAgents expects string responses
              return normalizedResult.summary || JSON.stringify(normalizedResult);
            } catch (error) {
              const executionTime = Date.now() - startTime;
              const errorResult = normalizeToolResult(
                {
                  success: false,
                  message: error instanceof Error ? error.message : String(error),
                  summary: `Error: ${error instanceof Error ? error.message : String(error)}`,
                },
                universalTool.name,
                executionTime
              );
              
              // Return error as string for LLM
              return errorResult.summary || JSON.stringify(errorResult);
            }
          },
          {
            name: universalTool.name,
            description: universalTool.description,
            schema: toolSchema,
          }
        );
      });

      // Get DeepAgents-specific options from options.framework.deepagents
      const frameworkOptions = config.options?.framework?.deepagents || {};

      // Checkpointer is REQUIRED for human-in-the-loop
      // Use provided checkpointer or create a new MemorySaver
      const checkpointer = frameworkOptions.checkpointer || null;

      // Create deep agent
      // DeepAgents uses: createDeepAgent({ tools, systemPrompt, model?, interruptOn?, checkpointer, backend?, store?, ...options })
      // Separate framework-specific options from universal options
      const { framework: _, ...universalOptions } = config.options || {};

      const agentConfig: any = {
        middleware: [          
        ],
        tools: frameworkTools,
        systemPrompt: config.systemPrompt || "You are a helpful assistant.",
        checkpointer,
        //...universalOptions, // Universal options (excluding framework-specific)
        ...frameworkOptions, // DeepAgents-specific options

      };


      // Add model if provided
      if (config.model) {
        agentConfig.model = config.model;



        // // Get the model name for the event
        // const modelName = (config.model as any).modelName || (config.model as any).model || 'unknown';

        // // Get existing callbacks or create empty array
        // const existingCallbacks = (config.model as any).callbacks || [];

        // // Create callback that emits LLM call events
        // const llmCallCallback = {
        //   handleLLMStart: async (_: any, prompts: string[]) => {
        //     console.log("🟦 FINAL PROMPT SENT TO LLM:");
        //     console.log(JSON.stringify(prompts, null, 2));

        //     // Format prompts
        //     const promptStrings = Array.isArray(prompts) 
        //       ? prompts.map(p => typeof p === 'string' ? p : JSON.stringify(p, null, 2))
        //       : [typeof prompts === 'string' ? prompts : JSON.stringify(prompts, null, 2)];

        //     // Emit LLM call event
        //     this.emit('llm:call', {
        //       prompts: promptStrings,
        //       model: modelName,
        //       timestamp: new Date().toISOString()
        //     });
        //   }
        // };

        // // Set callbacks on the model instance (merge with existing)
        // agentConfig.model.callbacks = [...existingCallbacks, llmCallCallback];
      }

      this.agent = createDeepAgent(agentConfig);


    } catch (error) {
      throw new Error(
        `Failed to initialize DeepAgents adapter: ${error instanceof Error ? error.message : String(error)}. Ensure deepagents and langchain are installed.`
      );
    }
  }

  async invoke(input: UniversalAgentInvokeInput, options?: UniversalAgentInvokeOptions): Promise<UniversalAgentResponse> {
    this.ensureInitialized();

    const startTime = Date.now();
    try {
      // Get DeepAgents-specific invoke config (once at the top)
      const frameworkInvokeOptions = options?.framework?.deepagents || {};

      // Separate framework-specific options from universal options
      const { framework: _, ...universalInvokeOptions } = options || {};

      // Check if input is a Command object (for resuming interrupts)
      // Command can be an instance of Command class or a plain object with resume property
      const isCommand = input && typeof input === "object" && ("resume" in input || (input as any).constructor?.name === "Command");
      if (isCommand) {
        // This is a resume command for handling interrupts
        const result = await this.agent.invoke(input, frameworkInvokeOptions);

        const executionTime = Date.now() - startTime;

        // Check for additional interrupts
        if (result.__interrupt__) {
          return {
            output: "",
            metadata: {
              framework: this.framework,
              executionTime,
              interrupt: result.__interrupt__,
              ...result.metadata,
              ...options?.metadata,
            },
          };
        }

        // Extract output
        let output: string;
        if (result.messages && result.messages.length > 0) {
          const lastMessage = result.messages[result.messages.length - 1];
          output = lastMessage.content || lastMessage.text || JSON.stringify(lastMessage);
        } else {
          output = typeof result === "string"
            ? result
            : result.output || result.text || result.content || JSON.stringify(result);
        }

        return {
          output,
          metadata: {
            framework: this.framework,
            executionTime,
            ...result.metadata,
            ...options?.metadata,
          },
        };
      }

      // Normalize input to messages format
      const messages = normalizeInput(input);

      // DeepAgents uses messages format: { messages: [{ role: "user", content: "..." }] }
      // Note: DeepAgents handles planning internally via write_todos tool
      // We'll extract planning information from the messages array after execution
      const result = await this.agent.invoke({
        messages,
        //...universalInvokeOptions, // Universal options (excluding framework-specific)
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

      //console.log('Result:',JSON.stringify(result));

      // Helper function to extract value from both deserialized and serialized LangChain message formats
      const getMessageValue = (message: any, key: string): any => {
        // Check direct property (deserialized format)
        if (message[key] !== undefined) {
          return message[key];
        }
        // Check kwargs (serialized LangChain format: { lc: 1, type: "constructor", id: [...], kwargs: {...} })
        if (message.kwargs && message.kwargs[key] !== undefined) {
          return message.kwargs[key];
        }
        // Check additional_kwargs for tool_calls (some LangChain formats)
        if (key === 'tool_calls') {
          // Check top-level additional_kwargs
          if (message.additional_kwargs?.tool_calls) {
            return message.additional_kwargs.tool_calls;
          }
          // Check kwargs.additional_kwargs
          if (message.kwargs?.additional_kwargs?.tool_calls) {
            return message.kwargs.additional_kwargs.tool_calls;
          }
        }
        return undefined;
      };

      // Extract todos from result if present (DeepAgents stores todos in result object)
      if (result.todos && Array.isArray(result.todos)) {
        this.emit('planning:step', {
          plan: JSON.stringify(result.todos),
          needsTools: true,
          rawResponse: JSON.stringify(result.todos)
        });
      }

      // Analyze messages to extract planning information and tool executions
      // DeepAgents uses write_todos tool for planning
      if (result.messages && Array.isArray(result.messages)) {
        for (const message of result.messages) {
          // Get tool_calls from message (handles both formats)
          const toolCalls = getMessageValue(message, 'tool_calls');

          if (toolCalls && Array.isArray(toolCalls)) {
            for (const toolCall of toolCalls) {
              // Handle both direct toolCall object and nested structure
              const toolName = toolCall.name || toolCall.function?.name;
              let toolArgs: any = {};

              // Parse tool arguments from various formats
              if (toolCall.args) {
                toolArgs = toolCall.args;
              } else if (toolCall.function?.arguments) {
                try {
                  toolArgs = typeof toolCall.function.arguments === 'string'
                    ? JSON.parse(toolCall.function.arguments)
                    : toolCall.function.arguments;
                } catch (e) {
                  // If parsing fails, use the raw value
                  toolArgs = toolCall.function.arguments;
                }
              }

              const toolId = toolCall.id || toolCall.function?.id || toolCall.index?.toString();

              if (toolName === 'write_todos' || toolName === 'plan') {
                // Extract planning information
                const planContent = toolArgs?.todos || toolArgs?.plan || toolArgs || '';
                this.emit('planning:step', {
                  plan: typeof planContent === 'string' ? planContent : JSON.stringify(planContent),
                  needsTools: true,
                  rawResponse: JSON.stringify(toolCall)
                });
              } else if (toolName) {
                // Emit tool execution start event
                this.emit('tool:execution', {
                  toolName,
                  args: toolArgs || {},
                  result: undefined // Will be updated when tool message arrives
                });
              }
            }
          }

          // Check for tool messages (tool results)
          const toolCallId = getMessageValue(message, 'tool_call_id');
          const content = getMessageValue(message, 'content');

          if (toolCallId && content !== undefined) {
            // Find corresponding tool call in all messages
            let matchingCall: any = null;
            const toolCallIdStr = String(toolCallId);

            for (const m of result.messages) {
              const mToolCalls = getMessageValue(m, 'tool_calls');
              if (mToolCalls && Array.isArray(mToolCalls)) {
                for (const tc of mToolCalls) {
                  // Try multiple ID formats and compare as strings
                  const tcId = tc.id || tc.function?.id || tc.index;
                  if (tcId !== undefined && String(tcId) === toolCallIdStr) {
                    matchingCall = tc;
                    break;
                  }
                }
                if (matchingCall) break;
              }
            }

            if (matchingCall) {
              const toolName = matchingCall.name || matchingCall.function?.name;
              let toolArgs: any = {};

              // Parse tool arguments from various formats
              if (matchingCall.args) {
                toolArgs = matchingCall.args;
              } else if (matchingCall.function?.arguments) {
                try {
                  toolArgs = typeof matchingCall.function.arguments === 'string'
                    ? JSON.parse(matchingCall.function.arguments)
                    : matchingCall.function.arguments;
                } catch (e) {
                  // If parsing fails, use the raw value
                  toolArgs = matchingCall.function.arguments;
                }
              }

              if (toolName && toolName !== 'write_todos') {
                // Emit tool execution result
                this.emit('tool:execution', {
                  toolName,
                  args: toolArgs || {},
                  result: typeof content === 'string' ? content : JSON.stringify(content)
                });
              }
            }
          }
        }
      }

      const executionTime = Date.now() - startTime;

      // Check for interrupts (human-in-the-loop)
      if (result.__interrupt__) {
        // Return interrupt information in metadata
        return {
          output: "",
          metadata: {
            framework: this.framework,
            executionTime,
            interrupt: result.__interrupt__,
            ...result.metadata,
            ...options?.metadata,
          },
        };
      }

      // Extract output from messages array (last message content)
      let output = result.messages && result.messages.length > 0
        ? result.messages[result.messages.length - 1].content
        : '';
      // let output: string;
      // if (result.messages && result.messages.length > 0) {
      //   const lastMessage = result.messages[result.messages.length - 1];
      //   output = lastMessage.content || lastMessage.text || JSON.stringify(lastMessage);
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
        `DeepAgents invocation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

}

