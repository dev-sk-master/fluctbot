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
 * OpenAI Agents framework adapter using the @openai/agents API
 */
export class OpenAIAgentsAdapter extends UniversalBaseAdapter {
    readonly framework: UniversalFramework = "openai-agents";
    private agent: any = null;

    protected async doInitialize(config: UniversalAgentConfig): Promise<void> {
        try {
            // Dynamic import
            const { Agent, tool, setDefaultOpenAIClient, setOpenAIAPI } = await import("@openai/agents");
            const { zodToJsonSchema } = await import("zod-to-json-schema");





            // Convert UniversalTools to OpenAI Agents tools
            const openaiTools = (config.tools || []).map((universalTool: UniversalTool) => {
                // Get the schema - should be a zod schema if provided
                const toolSchema = universalTool.parameters || {};

                let jsonSchema: any = zodToJsonSchema(toolSchema);

                // Recursive function to fix schema compatibility with OpenAI Agents
                // const fixSchemaForOpenAI = (schema: any, isProperty: boolean = false): any => {
                //     if (!schema || typeof schema !== 'object') {
                //         return schema;
                //     }

                //     // If schema has additionalProperties but no type, add type: 'object'
                //     if ('additionalProperties' in schema && !('type' in schema)) {
                //         schema.type = 'object';
                //     }

                //     // OpenAI Agents doesn't allow additionalProperties in property schemas (must be false or absent)
                //     // Only handle additionalProperties at the root level, not in properties
                //     if (!isProperty && 'additionalProperties' in schema) {
                //         const additionalProps = schema.additionalProperties;
                //         if (additionalProps === true) {
                //             // Convert true to an object schema that allows any value
                //             // Use type: 'object' as a safe default that allows any JSON object
                //             schema.additionalProperties = { type: 'object' };
                //         } else if (additionalProps && typeof additionalProps === 'object') {
                //             // If additionalProperties is an object but missing type, add type
                //             if (!('type' in additionalProps)) {
                //                 // For z.any() or unknown types, default to 'object' which is most permissive
                //                 additionalProps.type = 'object';
                //             }
                //             // Recursively fix nested additionalProperties
                //             schema.additionalProperties = fixSchemaForOpenAI(additionalProps, false);
                //         }
                //     } else if (isProperty && 'additionalProperties' in schema) {
                //         // Remove additionalProperties from property schemas (OpenAI Agents requires it to be false or absent)
                //         // For z.record(z.any()), we'll just use type: 'object' without additionalProperties
                //         // The tool's execute function will still receive the object with arbitrary keys
                //         delete schema.additionalProperties;
                //     }

                //     // If schema has properties, fix each property recursively
                //     if ('properties' in schema && schema.properties) {
                //         for (const [key, prop] of Object.entries(schema.properties)) {
                //             const propSchema = prop as any;
                //             // Recursively fix nested schemas (mark as property)
                //             schema.properties[key] = fixSchemaForOpenAI(propSchema, true);

                //             // Ensure properties have type
                //             if (propSchema && typeof propSchema === 'object' && !('type' in propSchema)) {
                //                 // If it's an object-like schema without type, add type: 'object'
                //                 if ('additionalProperties' in propSchema || 'properties' in propSchema) {
                //                     propSchema.type = 'object';
                //                 }
                //             }
                //         }

                //         // Ensure all properties are in the required array
                //         const allPropertyKeys = Object.keys(schema.properties);
                //         schema.required = allPropertyKeys;
                //     }

                //     // Fix items in arrays
                //     if ('items' in schema && schema.items) {
                //         schema.items = fixSchemaForOpenAI(schema.items, false);
                //     }

                //     return schema;
                // };

                const fixSchemaForOpenAI = (schema: any): any => {
                    if (!schema || typeof schema !== "object") return schema;

                    // ------------------------------------------------------------------
                    // HANDLE OBJECT SCHEMAS
                    // ------------------------------------------------------------------
                    const isObjectLike = (
                        schema.type === "object" ||
                        (!schema.type && (schema.properties || schema.additionalProperties))
                    );

                    if (isObjectLike) {
                        // Ensure type
                        schema.type = "object";

                        // OpenAI requires explicit false
                        schema.additionalProperties = false;

                        // Fix nested properties
                        if (schema.properties) {
                            for (const key of Object.keys(schema.properties)) {
                                schema.properties[key] = fixSchemaForOpenAI(schema.properties[key]);
                            }

                            // ----------------------------------------------------------
                            // REQUIRED RULE:
                            //   - Must include all *valid* properties
                            //   - Skip empty-object properties (OpenAI rejects them)
                            // ----------------------------------------------------------
                            const validRequiredKeys = Object.keys(schema.properties).filter((key) => {
                                const prop = schema.properties[key];

                                // Skip empty objects (no properties inside)
                                if (prop.type === "object" && !prop.properties) {
                                    return false;
                                }

                                return true;
                            });

                            schema.required = validRequiredKeys;
                        }
                    }

                    // ------------------------------------------------------------------
                    // HANDLE ARRAY ITEMS
                    // ------------------------------------------------------------------
                    if (schema.type === "array" && schema.items) {
                        schema.items = fixSchemaForOpenAI(schema.items);
                    }

                    // ------------------------------------------------------------------
                    // HANDLE anyOf / unions
                    // ------------------------------------------------------------------
                    if (schema.anyOf) {
                        schema.anyOf = schema.anyOf.map((x: any) => fixSchemaForOpenAI(x));
                    }

                    return schema;
                };

                // Apply fixes to the schema (root level, not a property)
                jsonSchema = fixSchemaForOpenAI(jsonSchema);
              

                // OpenAI Agents tool format: tool({ name, description, parameters, execute })
                return tool({
                    name: universalTool.name,
                    description: universalTool.description,
                    parameters: jsonSchema,
                    async execute(params: any) {
                        // OpenAI Agents passes params as an object matching the schema
                        const toolParams = typeof params === "object" && params !== null
                            ? params
                            : { input: params };

                        try {
                            return await universalTool.execute(toolParams);
                        } catch (error) {
                            // Fallback: try spreading if execute expects multiple args
                            if (typeof toolParams === "object" && toolParams !== null) {
                                return await universalTool.execute(...Object.values(toolParams));
                            }
                            return await universalTool.execute(toolParams);
                        }
                    },
                });
            });

            // Get OpenAI Agents-specific options from options.framework["openai-agents"]
            const openaiAgentsOptions = config.options?.framework?.["openai-agents"] || {};

            // Create agent
            // OpenAI Agents uses: new Agent({ name, instructions, tools, ...options })
            const agentConfig: any = {
                name: openaiAgentsOptions.name || "Universal Agent",
                instructions: config.systemPrompt || "You are a helpful assistant.",
                tools: openaiTools,
                ...openaiAgentsOptions, // OpenAI Agents-specific options
            };


            // Add model if provided (OpenAI Agents may support model configuration)
            if (config.model) {
                setDefaultOpenAIClient(config.model);
                //setOpenAIAPI("chat_completions");
            }

            this.agent = new Agent(agentConfig);
        } catch (error) {
            throw new Error(
                `Failed to initialize OpenAI Agents adapter: ${error instanceof Error ? error.message : String(error)}. Ensure @openai/agents is installed.`
            );
        }
    }

    async invoke(input: UniversalAgentInvokeInput, options?: UniversalAgentInvokeOptions): Promise<UniversalAgentResponse> {
        this.ensureInitialized();

        const startTime = Date.now();
        try {
            // Dynamic import of run function
            const { run } = await import("@openai/agents");

            // Normalize input to string or messages format
            const normalizedInput = normalizeInput(input);

            // Extract user message content
            let userInput: string;
            if (typeof normalizedInput === "string") {
                userInput = normalizedInput;
            } else if (Array.isArray(normalizedInput)) {
                // Get the last user message
                const userMessages = normalizedInput.filter((msg: any) => msg.role === "user");
                userInput = userMessages.length > 0
                    ? userMessages[userMessages.length - 1].content
                    : normalizedInput[normalizedInput.length - 1]?.content || "";
            } else {
                userInput = String(normalizedInput);
            }

            // OpenAI Agents uses: run(agent, input)
            const result = await run(this.agent, userInput);
           

            const executionTime = Date.now() - startTime;

            // Extract output from result
            let output = result.finalOutput;
          

            return {
                output,
                metadata: {
                    framework: this.framework,
                    executionTime                   
                },
            };
        } catch (error) {
            throw new Error(
                `OpenAI Agents invocation failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}

