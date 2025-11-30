import { UniversalBaseAdapter } from "../core/base-adapter";
import {
  UniversalFramework,
  UniversalAgentConfig,
  UniversalAgentResponse,
  UniversalAgentInvokeOptions,
  UniversalAgentInvokeInput,
  UniversalTool,
  UniversalMessage,
} from "../types";
import { normalizeInput } from "../utils/input-normalizer";

/**
 * PocketFlow framework adapter with Chain-of-Thought reasoning
 * Implements: Plan -> Execute -> Replan -> Respond cycle (LangGraph/LIA-style)
 */
export class PocketFlowAdapter extends UniversalBaseAdapter {
  readonly framework: UniversalFramework = "pocketflow";
  private flow: any = null;
  private toolsByName: Record<string, UniversalTool> = {};
  private model: any = null;
  private systemPrompt: string = "";


  protected async doInitialize(config: UniversalAgentConfig): Promise<void> {
    try {
      // Dynamic import of PocketFlow
      // @ts-ignore - pocketflow is an optional dependency
      const { Node, Flow } = await import("pocketflow");

      // Store adapter reference for event emission
      const adapter = this;

      // Store tools by name for lookup
      this.toolsByName = {};
      (config.tools || []).forEach((tool: UniversalTool) => {
        this.toolsByName[tool.name] = tool;
      });

      // Store model and system prompt (user's system prompt already includes tools)
      this.model = config.model;
      this.systemPrompt = config.systemPrompt || "You are a helpful assistant.";

      // Helper function to call model uniformly
      type CallModelFunction = (model: any, messages: any[]) => Promise<string>;
      const callModel: CallModelFunction = async (model: any, messages: any[]): Promise<string> => {
        let response: any;

        if (typeof model === "function") {
          response = await model(messages);
        } else if (model?.chat?.completions?.create) {
          // OpenAI-style
          const modelName = (model as any).defaultModel || "gpt-4o-mini";

          // Extract prompts for event emission (format like deepagents)
          const prompts = messages.map((msg: any) => {
            if (typeof msg === 'string') {
              return msg;
            }
            if (msg.content) {
              return typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2);
            }
            return JSON.stringify(msg, null, 2);
          });

          // Emit llm:start event
          this.emit("llm:start", {
            prompts: prompts,
          });

          try {
            const result = await model.chat.completions.create({
              model: modelName,
              messages,
            });
            response = result.choices[0]?.message?.content;

            // Emit llm:end event
            this.emit("llm:end", result);
          } catch (error) {
            // Emit llm:error event
            this.emit("llm:error", {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
          }
        } else if (model?.invoke) {
          // LangChain-style
          const result = await model.invoke(messages);
          response = result.content || result.text || result;
        } else if (model?.messages?.create) {
          // Anthropic-style
          const systemMsg = messages.find(m => m.role === "system");
          const otherMsgs = messages.filter(m => m.role !== "system");
          const result = await model.messages.create({
            model: (model as any).model || "claude-3-5-sonnet-20241022",
            max_tokens: 2048,
            messages: otherMsgs,
            system: systemMsg?.content,
          });
          response = result.content[0]?.text;
        } else if (model?.generateContent) {
          // Google Vertex AI style
          const result = await model.generateContent({
            contents: messages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
          });
          response = result.response.candidates[0]?.content?.parts[0]?.text || "";
        } else {
          throw new Error("Unsupported model type");
        }

        return typeof response === "string" ? response : JSON.stringify(response);
      };

      // Define shared storage type for the agent flow
      type AgentSharedStorage = {
        messages: UniversalMessage[];
        userQuery: string;
        plan?: string;
        toolCalls?: Array<{
          name: string;
          args: any;
          id?: string;
        }>;
        toolResults?: Array<{
          toolCallId?: string;
          name: string;
          result: any;
        }>;
        needsReplanning?: boolean;
        finalResponse?: string;
        maxIterations?: number;
        currentIteration?: number;
        finished?: boolean;
      };

      // Planning Node - creates initial plan
      class PlanningNode extends Node<AgentSharedStorage> {
        constructor(
          private model: any,
          private systemPrompt: string,
          private callModel: CallModelFunction,
          private adapter: PocketFlowAdapter,
          maxRetries: number = 1,
          wait: number = 0
        ) {
          super(maxRetries, wait);
        }

        async prep(shared: AgentSharedStorage): Promise<{
          userQuery: string;
          conversationHistory: UniversalMessage[];
        }> {
          return {
            userQuery: shared.userQuery,
            conversationHistory: shared.messages,
          };
        }

        async exec(prepRes: {
          userQuery: string;
          conversationHistory: UniversalMessage[];
        }): Promise<{ plan: string; needsTools: boolean }> {
          const planningPrompt = `${this.systemPrompt}

You are in the PLANNING phase. Analyze the user's query and create a step-by-step plan.

User query: ${prepRes.userQuery}

Think through:
1. What information do you need?
2. Which tools (if any) should you use?
3. What's the logical sequence of steps?

Create a clear, actionable plan. 

Respond in this exact format:
PLAN:
[Your step-by-step plan here]

NEEDS_TOOLS: [YES or NO]`;

          const messages = [
            { role: "system", content: planningPrompt },
            ...prepRes.conversationHistory.slice(0, -1), // Don't duplicate last message
          ];

          const response = await this.callModel(this.model, messages);

          // Parse response
          const needsTools = /NEEDS_TOOLS:\s*(YES|yes|Yes)/i.test(response);
          const planMatch = response.match(/PLAN:\s*([\s\S]*?)(?=\nNEEDS_TOOLS:|$)/i);
          const plan = planMatch ? planMatch[1].trim() : response;

          // Emit planning phase event
          this.adapter.emit('planning:step', {
            plan,
            needsTools,
            rawResponse: response
          });

          console.log("\n=== PLANNING Step ===");
          console.log("Plan:", plan);
          console.log("Needs tools:", needsTools);

          return { plan, needsTools };
        }

        async post(
          shared: AgentSharedStorage,
          prepRes: any,
          execRes: { plan: string; needsTools: boolean }
        ): Promise<string> {
          shared.plan = execRes.plan;
          shared.currentIteration = (shared.currentIteration || 0) + 1;

          if (execRes.needsTools) {
            return "execute";
          } else {
            return "respond";
          }
        }
      }

      // Execution Node - determines which tools to call
      class ExecutionNode extends Node<AgentSharedStorage> {
        constructor(
          private model: any,
          private tools: Record<string, UniversalTool>,
          private callModel: CallModelFunction,
          private adapter: PocketFlowAdapter,
          maxRetries: number = 1,
          wait: number = 0
        ) {
          super(maxRetries, wait);
        }

        async prep(shared: AgentSharedStorage): Promise<{
          plan: string;
          toolSchemas: string;
        }> {
          // Build detailed tool schemas
          const toolSchemas = Object.values(this.tools)
            .map((tool) => {
              const schema: any = {
                name: tool.name,
                description: tool.description || "No description",
                parameters: tool.parameters || {},
              };
              return JSON.stringify(schema, null, 2);
            })
            .join("\n\n");

          return {
            plan: shared.plan || "",
            toolSchemas,
          };
        }

        async exec(prepRes: {
          plan: string;
          toolSchemas: string;
        }): Promise<{
          toolCalls: Array<{ name: string; args: any; id?: string }>;
        }> {
          const executionPrompt = `Based on this plan:
${prepRes.plan}

Available tool schemas:
${prepRes.toolSchemas}

Determine which tool(s) to call with what parameters to execute the plan.

Respond with ONLY valid JSON in this format (no markdown, no explanation):
{
  "toolCalls": [
    {
      "name": "toolName",
      "args": { "param": "value" }
    }
  ]
}`;

          const response = await this.callModel(this.model, [
            { role: "user", content: executionPrompt },
          ]);

          // Parse tool calls
          let toolCalls: Array<{ name: string; args: any; id?: string }> = [];
          try {
            // Remove markdown code fences if present
            let cleaned = response
              .replace(/```json\n?/g, "")
              .replace(/```\n?/g, "")
              .trim();

            // Remove JSON comments (single-line and multi-line)
            // Note: This is a simple approach that works for comments outside of strings
            // For more complex cases, a proper JSON parser with comment support would be needed
            cleaned = cleaned
              // Remove multi-line comments (/* ... */) first
              .replace(/\/\*[\s\S]*?\*\//g, "")
              // Remove single-line comments (// ...) - matches // followed by anything until end of line
              .replace(/\/\/.*$/gm, "")
              // Clean up any trailing commas before closing braces/brackets (common after comment removal)
              .replace(/,(\s*[}\]])/g, "$1");

            const parsed = JSON.parse(cleaned);
            toolCalls = parsed.toolCalls || [];

            // Emit execution phase event
            this.adapter.emit('step:execution', {
              toolCalls,
              plan: prepRes.plan
            });

            //console.log("\n=== EXECUTION PHASE ===");
            //console.log("Tool calls planned:", toolCalls);
          } catch (error) {
            // Emit error event
            this.adapter.emit('step:execution', {
              error: error instanceof Error ? error.message : String(error),
              rawResponse: response
            });

            console.error("Failed to parse tool calls from response:", response);
            console.error("Parse error:", error);
          }

          return { toolCalls };
        }

        async post(
          shared: AgentSharedStorage,
          prepRes: any,
          execRes: { toolCalls: Array<{ name: string; args: any; id?: string }> }
        ): Promise<string> {
          shared.toolCalls = execRes.toolCalls;

          if (execRes.toolCalls.length > 0) {
            return "execute_tools";
          } else {
            return "respond";
          }
        }
      }

      // Tool Execution Node - actually runs the tools
      class ToolExecutionNode extends Node<AgentSharedStorage> {
        constructor(
          private toolsByName: Record<string, UniversalTool>,
          private adapter: PocketFlowAdapter,
          maxRetries: number = 1,
          wait: number = 0
        ) {
          super(maxRetries, wait);
        }

        async prep(
          shared: AgentSharedStorage
        ): Promise<Array<{ name: string; args: any; id?: string }>> {
          return shared.toolCalls || [];
        }

        async exec(
          prepRes: Array<{ name: string; args: any; id?: string }>
        ): Promise<Array<{ toolCallId?: string; name: string; result: any }>> {
          const results: Array<{
            toolCallId?: string;
            name: string;
            result: any;
            success: boolean;
          }> = [];



          //console.log("\n=== TOOL EXECUTION PHASE ===");

          for (const toolCall of prepRes) {
            const tool = this.toolsByName[toolCall.name];
            if (!tool) {
              const errorMsg = `Error: Tool '${toolCall.name}' not found`;
              console.log(`❌ ${errorMsg}`);
              results.push({
                toolCallId: toolCall.id,
                name: toolCall.name,
                result: errorMsg,
                success: false,
              });
              continue;
            }

            try {
              const toolParams =
                typeof toolCall.args === "object" && toolCall.args !== null
                  ? toolCall.args
                  : { input: toolCall.args };

              //console.log(`🔧 Executing ${toolCall.name} with params:`, toolParams);

              const result = await tool.execute(toolParams);

              //console.log(`✅ ${toolCall.name} result:`, result);

              // // Emit individual tool execution event
              // this.adapter.emit('tool:execution', {
              //   toolName: toolCall.name,
              //   args: toolParams,
              //   result: typeof result === "string" ? result : JSON.stringify(result),
              //   success: true
              // });

              results.push({
                toolCallId: toolCall.id,
                name: toolCall.name,
                result:
                  typeof result === "string" ? result : JSON.stringify(result),
                success: true,
              });
            } catch (error) {
              const errorMsg = `Error: ${error instanceof Error ? error.message : String(error)}`;
              console.log(`❌ ${toolCall.name} failed:`, errorMsg);

              results.push({
                toolCallId: toolCall.id,
                name: toolCall.name,
                result: errorMsg,
                success: false,
              });
            }
          }

          // Single emit with complete summary at the end
          this.adapter.emit('tool:execution', {
            toolCalls: prepRes.map(tc => ({ name: tc.name, args: tc.args })),
            results: results.map(r => ({
              name: r.name,
              result: r.result,
              success: r.success
            })),
            successCount: results.filter(r => r.success).length,
            errorCount: results.filter(r => !r.success).length,
            totalCount: results.length
          });

          return results;
        }

        async post(
          shared: AgentSharedStorage,
          prepRes: any,
          execRes: Array<{ toolCallId?: string; name: string; result: any }>
        ): Promise<string> {
          shared.toolResults = execRes;

          // Add tool results to messages for context
          for (const toolResult of execRes) {
            shared.messages.push({
              role: "tool",
              content: `Tool: ${toolResult.name}\nResult: ${toolResult.result}`,
            });
          }

          // Check if we've hit max iterations
          const maxIterations = shared.maxIterations || 10;
          if ((shared.currentIteration || 0) >= maxIterations) {
            console.log("\n⚠️ Max iterations reached, moving to response...");
            return "respond";
          }

          // Check if we need to replan based on results
          const hasErrors = execRes.some((r) =>
            r.result.toString().startsWith("Error")
          );

          if (hasErrors) {
            console.log("\n⚠️ Errors detected, initiating replanning...");
            return "replan";
          }

          // Always replan to check if more work is needed
          console.log("\n✅ Tools executed successfully, checking if plan is complete...");
          return "replan";
        }
      }

      // Replanning Node - adjusts plan based on tool results
      class ReplanningNode extends Node<AgentSharedStorage> {
        constructor(
          private model: any,
          private callModel: CallModelFunction,
          private adapter: PocketFlowAdapter,
          maxRetries: number = 1,
          wait: number = 0
        ) {
          super(maxRetries, wait);
        }

        async prep(shared: AgentSharedStorage): Promise<{
          originalPlan: string;
          toolResults: Array<{ name: string; result: any }>;
        }> {
          return {
            originalPlan: shared.plan || "",
            toolResults: shared.toolResults || [],
          };
        }

        async exec(prepRes: {
          originalPlan: string;
          toolResults: Array<{ name: string; result: any }>;
        }): Promise<{ newPlan: string; shouldContinue: boolean }> {
          const replanPrompt = `You are in the REPLANNING phase.

Original plan:
${prepRes.originalPlan}

Tool execution results so far:
${prepRes.toolResults.map((r) => `- ${r.name}: ${r.result}`).join("\n")}

Analyze these results carefully. Ask yourself:
- Has the ENTIRE original plan been completed?
- Are there still steps remaining that need tool execution?
- Do we have all the information needed to give a final answer?

Decide:
1. CONTINUE - More tool calls needed (there are unfinished steps in the plan)
2. RESPOND - Plan fully executed (we can now provide the final answer)

Respond in this exact format:
DECISION: [CONTINUE or RESPOND]

NEW_PLAN:
[If CONTINUE: Clearly state the NEXT steps that still need to be done]
[If RESPOND: Confirm all steps completed and summarize what was accomplished]`;

          const response = await this.callModel(this.model, [
            { role: "user", content: replanPrompt },
          ]);

          const shouldContinue = /DECISION:\s*(CONTINUE|continue)/i.test(response);
          const planMatch = response.match(/NEW_PLAN:\s*([\s\S]*?)$/i);
          const newPlan = planMatch ? planMatch[1].trim() : response;

          // Emit replanning phase event
          this.adapter.emit('replanning:step', {
            decision: shouldContinue ? "CONTINUE" : "RESPOND",
            newPlan,
            originalPlan: prepRes.originalPlan,
            toolResults: prepRes.toolResults
          });

          //console.log("\n=== REPLANNING Step ===");
          //console.log("Decision:", shouldContinue ? "CONTINUE" : "RESPOND");
          //console.log("New plan:", newPlan);

          return { newPlan, shouldContinue };
        }

        async post(
          shared: AgentSharedStorage,
          prepRes: any,
          execRes: { newPlan: string; shouldContinue: boolean }
        ): Promise<string> {
          shared.plan = execRes.newPlan;
          shared.currentIteration = (shared.currentIteration || 0) + 1;

          const maxIterations = shared.maxIterations || 10;
          if (!execRes.shouldContinue || shared.currentIteration >= maxIterations) {
            return "respond";
          }

          return "execute";
        }
      }

      // Response Node - generates final response
      class ResponseNode extends Node<AgentSharedStorage> {
        constructor(
          private model: any,
          private systemPrompt: string,
          private callModel: CallModelFunction,
          private adapter: PocketFlowAdapter,
          maxRetries: number = 1,
          wait: number = 0
        ) {
          super(maxRetries, wait);
        }

        async prep(shared: AgentSharedStorage): Promise<{
          userQuery: string;
          plan: string;
          toolResults: Array<{ name: string; result: any }>;
          conversationHistory: UniversalMessage[];
        }> {
          return {
            userQuery: shared.userQuery,
            plan: shared.plan || "",
            toolResults: shared.toolResults || [],
            conversationHistory: shared.messages,
          };
        }

        async exec(prepRes: {
          userQuery: string;
          plan: string;
          toolResults: Array<{ name: string; result: any }>;
          conversationHistory: UniversalMessage[];
        }): Promise<string> {
          const responsePrompt = `${this.systemPrompt}

You are in the FINAL RESPONSE phase.

Original user query: ${prepRes.userQuery}

Plan executed:
${prepRes.plan}

Information gathered from tools:
${prepRes.toolResults.length > 0
              ? prepRes.toolResults.map((r) => `- ${r.name}: ${r.result}`).join("\n")
              : "(No tools were used)"}

Provide a complete, natural, helpful response to the user's original query. Use the information gathered to give them exactly what they asked for.`;

          const messages = [
            { role: "system", content: responsePrompt },
            ...prepRes.conversationHistory.filter((m) => m.role !== "tool"),
          ];

          const response = await this.callModel(this.model, messages);

          // Emit response phase event
          this.adapter.emit('final:response', {
            response,
            userQuery: prepRes.userQuery,
            plan: prepRes.plan,
            toolResults: prepRes.toolResults
          });

          //console.log("\n=== FINAL RESPONSE ===");
          //console.log(response);

          return response;
        }

        async post(
          shared: AgentSharedStorage,
          prepRes: any,
          execRes: string
        ): Promise<string> {
          shared.finalResponse = execRes;
          shared.finished = true;
          return "end";
        }
      }

      // End Node
      class EndNode extends Node<AgentSharedStorage> {
        async prep(shared: AgentSharedStorage): Promise<string> {
          return shared.finalResponse || "";
        }

        async exec(prepRes: string): Promise<string> {
          return prepRes;
        }
      }

      // Create nodes with proper dependencies
      const planNode = new PlanningNode(this.model, this.systemPrompt, callModel, this);
      const execNode = new ExecutionNode(this.model, this.toolsByName, callModel, this);
      const toolNode = new ToolExecutionNode(this.toolsByName, this);
      const replanNode = new ReplanningNode(this.model, callModel, this);
      const responseNode = new ResponseNode(this.model, this.systemPrompt, callModel, this);
      const endNode = new EndNode();

      // Connect nodes: Plan -> Execute -> ToolExec -> (Replan or Respond) -> End
      planNode.on("execute", execNode);
      planNode.on("respond", responseNode);

      execNode.on("execute_tools", toolNode);
      execNode.on("respond", responseNode);

      toolNode.on("replan", replanNode);
      toolNode.on("respond", responseNode);

      replanNode.on("execute", execNode);
      replanNode.on("respond", responseNode);

      responseNode.on("end", endNode);

      // Create flow starting with planning node
      this.flow = new Flow(planNode);
    } catch (error) {
      throw new Error(
        `Failed to initialize PocketFlow adapter: ${error instanceof Error ? error.message : String(error)
        }. Ensure pocketflow is installed.`
      );
    }
  }

  async invoke(
    input: UniversalAgentInvokeInput,
    options?: UniversalAgentInvokeOptions
  ): Promise<UniversalAgentResponse> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      // Normalize input to messages format
      const normalizedMessages = normalizeInput(input);

      // Extract user query from last message
      const lastMessage = normalizedMessages[normalizedMessages.length - 1];
      const userQuery =
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      // Get PocketFlow-specific options
      const pocketflowOptions = options?.framework?.pocketflow || {};
      const maxIterations = pocketflowOptions.maxIterations || 10;

      // Create shared storage for the flow
      type AgentSharedStorage = {
        messages: UniversalMessage[];
        userQuery: string;
        plan?: string;
        toolCalls?: Array<{ name: string; args: any; id?: string }>;
        toolResults?: Array<{
          toolCallId?: string;
          name: string;
          result: any;
        }>;
        needsReplanning?: boolean;
        finalResponse?: string;
        maxIterations?: number;
        currentIteration?: number;
        finished?: boolean;
      };

      const shared: AgentSharedStorage = {
        messages: normalizedMessages,
        userQuery,
        maxIterations,
        currentIteration: 0,
        finished: false,
      };

      // Run the flow
      await this.flow.run(shared);

      const executionTime = Date.now() - startTime;

      // Extract final output
      const output = shared.finalResponse || "";

      return {
        output,
        metadata: {
          framework: this.framework,
          executionTime,
          iterations: shared.currentIteration,
          plan: shared.plan,
          toolsUsed: shared.toolResults?.map((r) => r.name) || [],
          ...options?.metadata,
        },
      };
    } catch (error) {
      throw new Error(
        `PocketFlow invocation failed: ${error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}