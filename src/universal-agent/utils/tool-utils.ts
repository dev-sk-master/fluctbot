import { UniversalTool } from "../types";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Convert a tool definition into a text representation for embedding.
 * Combines the tool name, description, and parameter information.
 * Supports nested objects and arrays.
 */
export function toolToText(tool: UniversalTool): string {
    const textParts = [
        `Tool: ${tool.name}`,
        `Description: ${tool.description}`,
    ];

    if (tool.parameters) {
        try {
            const schema = zodToJsonSchema(tool.parameters);

            if (schema && typeof schema === "object" && "properties" in schema) {

                const required = (schema as any).required || [];

                const formatParam = (name: string, info: any, depth: number, isRequired: boolean): string => {
                    const indent = "  ".repeat(depth);

                    let lines = `${indent}- ${name}\n`;

                    // Type
                    if (info.type) {
                        lines += `${indent}  • Type: ${info.type}\n`;
                    }

                    // Required?
                    lines += `${indent}  • Required: ${isRequired ? "yes" : "no"}\n`;

                    // Description
                    if (info.description) {
                        lines += `${indent}  • Description: ${info.description}\n`;
                    }

                    // Nested object
                    if (info.type === "object" && info.properties) {
                        lines += `${indent}  • Properties:\n`;

                        const nestedRequired = info.required || [];
                        for (const [childName, childInfo] of Object.entries(info.properties)) {
                            lines += formatParam(
                                childName,
                                childInfo,
                                depth + 2,
                                nestedRequired.includes(childName)
                            );
                        }
                    }

                    // Arrays
                    if (info.type === "array" && info.items) {
                        lines += `${indent}  • Items:\n`;
                        lines += formatParam("item", info.items, depth + 2, false);
                    }

                    return lines;
                };

                // Top-level formatting
                const paramLines: string[] = [];

                for (const [paramName, paramInfo] of Object.entries((schema as any).properties)) {
                    paramLines.push(
                        formatParam(paramName, paramInfo, 0, required.includes(paramName))
                    );
                }

                textParts.push("Parameters:\n" + paramLines.join("\n"));
            }
        } catch (error) {
            console.warn(`Failed to convert schema for tool ${tool.name}:`, error);
        }
    }

    return textParts.join("\n\n");
}

