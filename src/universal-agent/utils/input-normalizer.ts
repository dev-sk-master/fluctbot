import { UniversalAgentInvokeInput, UniversalMessage } from "../types";

/**
 * Normalize different input formats to a consistent messages array format
 */
export function normalizeInput(input: UniversalAgentInvokeInput): UniversalMessage[] {
  // Case 1: String input
  if (typeof input === "string") {
    return [{ role: "user", content: input }];
  }

  // Case 2: Array of messages
  if (Array.isArray(input)) {
    return input.map((msg) => {
      if (typeof msg === "string") {
        return { role: "user" as const, content: msg };
      }
      if (msg && typeof msg === "object" && "role" in msg && "content" in msg) {
        return msg as UniversalMessage;
      }
      throw new Error(`Invalid message format: ${JSON.stringify(msg)}`);
    });
  }

  // Case 3: Object with messages property
  if (input && typeof input === "object" && "messages" in input) {
    if (Array.isArray(input.messages)) {
      return input.messages.map((msg: any) => {
        if (typeof msg === "string") {
          return { role: "user" as const, content: msg };
        }
        if (msg && typeof msg === "object" && "role" in msg && "content" in msg) {
          return msg as UniversalMessage;
        }
        throw new Error(`Invalid message format: ${JSON.stringify(msg)}`);
      });
    }
    throw new Error("messages property must be an array");
  }

  throw new Error(`Invalid input format: ${JSON.stringify(input)}`);
}

/**
 * Extract the last user message content (for backward compatibility)
 */
export function extractUserInput(input: UniversalAgentInvokeInput): string {
  const messages = normalizeInput(input);
  const lastUserMessage = messages.filter((m) => m.role === "user").pop();
  return lastUserMessage?.content || messages[messages.length - 1]?.content || "";
}

