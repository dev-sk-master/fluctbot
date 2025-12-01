# Conversation Saving and Updating - Complete Flow

## Overview

Conversation tracking happens at **3 key points** in the workflow to ensure all user interactions and AI responses are properly saved.

---

## 1. **Access Control Node** - Save User Message (Existing Users)

**Location:** `src/workflow/nodes/processor/access-control.node.ts` (post method)

**When:** After user is found and validated

**What it does:**
- Saves the **user's incoming message** to conversation
- Only saves if user exists (not for new users)
- Ensures conversation history is available **before** AI Agent processes the message

**Code:**
```typescript
// In post() method
if (result.user && message) {
  await conversationsService.saveMessageToConversation(
    result.user.id,
    message.metadata.source,
    message.metadata.chatId,
    message,
    undefined, // No response yet
  );
}
```

**Flow:**
```
User Message → Access Control → User Found? 
  ├─ YES → Save user message ✅
  └─ NO → Route to onboarding (message saved later)
```

---

## 2. **Onboarding Node** - Save User Message (New Users)

**Location:** `src/workflow/nodes/processor/onboarding.node.ts` (post method)

**When:** After user is created during onboarding

**What it does:**
- Saves the **user's incoming message** to conversation
- Handles the case where user didn't exist when Access Control ran
- Ensures the initial message is saved even for new users

**Code:**
```typescript
// In post() method, after user creation
if (result.user && message) {
  await conversationsService.saveMessageToConversation(
    result.user.id,
    message.metadata.source,
    message.metadata.chatId,
    message,
    undefined, // No response yet
  );
}
```

**Flow:**
```
Onboarding → Create User → Save user message ✅
```

---

## 3. **Unified Output Node** - Save Assistant Response

**Location:** `src/workflow/nodes/output/unified-output.node.ts` (post method)

**When:** After any processor node (Command, Onboarding, AI Agent, Echo) generates a response

**What it does:**
- Saves the **assistant's response** to conversation
- Detects which node generated the response (command, onboarding, ai-agent, echo)
- Extracts response content from sharedData
- Includes tool calls metadata for AI Agent responses

**Code:**
```typescript
// In post() method
if (user && message) {
  await conversationsService.saveAssistantResponseFromSharedData(
    user.id,
    message,
    {
      processedContent: context.sharedData.processedContent,
      response: context.sharedData.response,
      commandResponse: context.sharedData.commandResponse,
      aiAgentToolCalls: context.sharedData.aiAgentToolCalls,
    },
    this.context.services.commandsService,
  );
}
```

**Flow:**
```
[Command | Onboarding | AI Agent | Echo] → Generate Response
  ↓
Unified Output → Detect node type → Save assistant response ✅
```

---

## Service Methods (ConversationsService)

### `getOrCreateConversation()`
**Location:** `src/conversations/conversations.service.ts`

**Purpose:** 
- Gets existing conversation or creates new one
- Generates persistent `thread_id` (UUID) when creating new conversation
- **Updates:** `lastMessageAt` is updated when messages are saved

**Called by:**
- Access Control Node (via `saveMessageToConversation`)
- Onboarding Node (via `saveMessageToConversation`)
- Unified Output Node (via `saveAssistantResponseFromSharedData`)
- AI Agent Node (to get conversation for history)

---

### `saveUserMessage()`
**Location:** `src/conversations/conversations.service.ts`

**Purpose:**
- Saves user message to `conversation_messages` table
- Stores: `role='user'`, `contentText`, `contentData`, `metadata`
- **Updates:** Conversation's `lastMessageAt` timestamp

**Called by:**
- `saveMessageToConversation()` (used by Access Control and Onboarding)

---

### `saveAssistantMessage()`
**Location:** `src/conversations/conversations.service.ts`

**Purpose:**
- Saves assistant response to `conversation_messages` table
- Stores: `role='assistant'`, `contentText`, `contentData`, `toolCalls`, `metadata`
- **Updates:** Conversation's `lastMessageAt` timestamp

**Called by:**
- `saveMessageToConversation()` (legacy method)
- `saveAssistantResponseFromSharedData()` (used by Unified Output)

---

### `saveMessageToConversation()`
**Location:** `src/conversations/conversations.service.ts`

**Purpose:**
- Unified method that saves both user message and response
- Used by Access Control and Onboarding nodes
- **Updates:** Conversation's `lastMessageAt` when saving messages

**Called by:**
- Access Control Node (saves user message only, response=undefined)
- Onboarding Node (saves user message only, response=undefined)

---

### `saveAssistantResponseFromSharedData()`
**Location:** `src/conversations/conversations.service.ts`

**Purpose:**
- Detects node type from sharedData (command, onboarding, ai-agent, echo)
- Extracts response content automatically
- Saves assistant response with proper metadata
- **Updates:** Conversation's `lastMessageAt` when saving response

**Called by:**
- Unified Output Node (saves assistant response only)

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER SENDS MESSAGE                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  Unified Input Node   │
            └───────────┬───────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  Access Control Node  │
            │                       │
            │  Check User Status    │
            └───────────┬───────────┘
                        │
        ┌───────────────┴───────────────┐
        │                                 │
        ▼                                 ▼
┌───────────────┐              ┌──────────────────┐
│ User Exists   │              │ User Not Found    │
│               │              │                   │
│ ✅ SAVE USER  │              │ Route to          │
│    MESSAGE    │              │ Onboarding        │
└───────┬───────┘              └─────────┬─────────┘
        │                                │
        │                                ▼
        │                    ┌──────────────────┐
        │                    │ Onboarding Node  │
        │                    │                  │
        │                    │ Create User      │
        │                    │ ✅ SAVE USER     │
        │                    │    MESSAGE       │
        │                    └─────────┬─────────┘
        │                                │
        └────────────────┬───────────────┘
                         │
                         ▼
            ┌──────────────────────────┐
            │  Processor Node          │
            │  (Command/Onboarding/     │
            │   AI Agent/Echo)          │
            │                           │
            │  Generate Response       │
            └───────────┬───────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  Unified Output Node  │
            │                       │
            │  ✅ SAVE ASSISTANT    │
            │     RESPONSE          │
            └───────────┬───────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  Platform Output Node │
            │  (Telegram/Web Chat)  │
            └───────────────────────┘
```

---

## Conversation Updates

### Automatic Updates

1. **`lastMessageAt`** - Updated automatically when:
   - User message is saved (`saveUserMessage`)
   - Assistant message is saved (`saveAssistantMessage`)

2. **`updatedAt`** - Updated automatically by TypeORM when:
   - Conversation entity is modified
   - Messages are added to conversation

### Manual Updates

Currently, no manual conversation updates are performed. All updates happen automatically through the save operations.

---

## Key Points

1. **User messages** are saved in **2 places**:
   - Access Control (if user exists)
   - Onboarding (if user is new)

2. **Assistant responses** are saved in **1 place**:
   - Unified Output (for all node types)

3. **Conversation creation** happens automatically:
   - First time a user message is saved
   - `thread_id` is generated once and never changes

4. **History retrieval** happens in:
   - AI Agent Node (loads history before processing)

5. **No duplicate saving**:
   - User message saved once (either Access Control or Onboarding)
   - Assistant response saved once (Unified Output)

---

## Summary Table

| Location | What | When | Updates |
|----------|------|------|---------|
| **Access Control Node** | User message | User exists | `lastMessageAt` |
| **Onboarding Node** | User message | User created | `lastMessageAt` |
| **Unified Output Node** | Assistant response | After processing | `lastMessageAt` |
| **AI Agent Node** | Load history | Before processing | None (read-only) |
| **ConversationsService** | Conversation CRUD | On demand | `lastMessageAt`, `updatedAt` |

