# Unified Conversation Tracking Proposal

## Current State

### What's Currently Tracked:
- ✅ **AI Agent interactions**: User messages and AI responses are saved to conversations
- ❌ **Command interactions**: `/vessel xxxx` commands are NOT saved
- ❌ **Onboarding interactions**: Onboarding messages are NOT saved
- ❌ **Echo processor**: Not tracked (but being replaced by AI agent)

### Current Flow:
```
User Message → AccessControl → [Command | Onboarding | AI Agent] → Response
```

Only AI Agent saves to conversations.

## Proposed Solution: Track ALL Interactions

### Benefits:

1. **Complete Conversation History**
   - User can see ALL their interactions (commands, onboarding, AI)
   - Unified conversation view across all interaction types

2. **AI Context Enhancement**
   - User: `/vessel 9571648` → Command response with vessel info
   - User: "Tell me more about it" → AI can reference previous command result
   - AI has full context of what user did before

3. **Better User Experience**
   - Seamless conversation flow
   - User doesn't need to repeat information
   - AI can answer follow-up questions about commands

4. **Analytics & Debugging**
   - Track all user interactions
   - Understand user behavior patterns
   - Easier to debug issues across all interaction types

5. **Future Features**
   - Conversation search across all interactions
   - Export complete conversation history
   - Conversation analytics

## Implementation Approach

### Option 1: Centralized Conversation Service (Recommended)

Create a helper method that ALL nodes can use to save messages:

```typescript
// In ConversationsService
async saveMessageToConversation(
  userId: number,
  platform: string,
  platformIdentifier: string,
  message: FluctMessage,
  response?: MessageContent,
  metadata?: {
    nodeType?: 'command' | 'onboarding' | 'ai-agent' | 'echo';
    commandName?: string;
    toolCalls?: any[];
  }
): Promise<void> {
  // Get or create conversation
  const conversation = await this.getOrCreateConversation(
    userId,
    platform,
    platformIdentifier,
    message.metadata,
  );

  // Save user message
  await this.saveUserMessage(conversation.id, message);

  // Save response if provided
  if (response) {
    await this.saveAssistantMessage(
      conversation.id,
      `response-${Date.now()}`,
      response,
      metadata?.toolCalls,
    );
  }
}
```

### Option 2: Update Each Node Individually

Update CommandNode, OnboardingNode, and AIAgentNode to save messages.

## Recommended Implementation

### 1. Update CommandNode

```typescript
// In CommandNode.post()
protected async post(
  context: NodeExecutionContext,
  prepResult: unknown,
  execResult: unknown,
): Promise<string | undefined> {
  const result = execResult as CommandResult;
  const message = context.sharedData.message as FluctMessage;
  const user = context.sharedData['user'] as any;

  // Save to conversation
  if (user && result.message) {
    const conversationsService = this.context.services.conversationsService;
    const responseContent: MessageContent = {
      type: MessageType.TEXT,
      text: result.message,
    };

    await conversationsService.saveMessageToConversation(
      user.id,
      message.metadata.source,
      message.metadata.chatId,
      message,
      responseContent,
      {
        nodeType: 'command',
        commandName: result.command,
      },
    );
  }

  // ... rest of existing code
}
```

### 2. Update OnboardingNode (Optional)

Onboarding messages are more verbose (email prompts, verification codes, etc.). 
We could:
- **Option A**: Save all onboarding messages (complete history)
- **Option B**: Only save final completion message (less verbose)
- **Option C**: Don't save onboarding (keep it separate)

**Recommendation**: Option B - Only save completion message to avoid cluttering conversation history.

### 3. Keep AIAgentNode as is

Already saves messages, just ensure it uses the unified method.

## Conversation History Structure

### Example Conversation:

```
Message 1 (user): "Hello"
Message 2 (assistant, ai-agent): "Hi! How can I help?"

Message 3 (user): "/vessel 9571648"
Message 4 (assistant, command): "Vessel: ABC Ship\nIMO: 9571648\n..."

Message 5 (user): "Tell me more about it"
Message 6 (assistant, ai-agent): "Based on the vessel information I found earlier..."
```

### Database Structure:

```sql
conversation_messages:
- id, conversation_id, message_id, role, content_type, content_text, content_data, metadata, tool_calls, created_at

metadata field can store:
{
  "nodeType": "command" | "onboarding" | "ai-agent" | "echo",
  "commandName": "vessel" (if command),
  "onboardingStep": "email_verification" (if onboarding),
  ...
}
```

## Benefits for AI Agent

When AI Agent processes a message, it will see:

```
Previous messages:
1. User: "Hello"
2. Assistant (ai-agent): "Hi! How can I help?"
3. User: "/vessel 9571648"
4. Assistant (command): "Vessel: ABC Ship\nIMO: 9571648\nType: Container Ship..."
5. User: "Tell me more about it" ← Current message
```

AI can now:
- Reference the vessel information from the command
- Provide contextual follow-up
- Understand the conversation flow

## Implementation Steps

1. ✅ Add `saveMessageToConversation` helper to ConversationsService
2. ✅ Update CommandNode to save messages
3. ⚠️ Update OnboardingNode (optional - only completion message)
4. ✅ Ensure AIAgentNode uses unified method
5. ✅ Update conversation history retrieval to include all message types

## Considerations

### Storage
- More messages = more storage, but probably negligible
- Commands are typically short responses
- Onboarding can be verbose (hence Option B recommendation)

### Performance
- Additional database writes per message
- Should be minimal impact (async operations)
- Can be optimized with batch inserts if needed

### Privacy
- All interactions are stored
- Consider GDPR compliance
- Allow users to delete conversations

## Recommendation

**YES, implement unified conversation tracking** because:

1. ✅ Better user experience (AI can reference commands)
2. ✅ Complete conversation history
3. ✅ Better analytics and debugging
4. ✅ Future-proof for new features
5. ✅ Minimal performance impact

**Implementation Priority:**
1. **High**: CommandNode (most valuable - AI can reference command results)
2. **Medium**: OnboardingNode completion message (less critical)
3. **Low**: OnboardingNode all messages (can be verbose)

