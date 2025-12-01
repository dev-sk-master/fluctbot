# Thread ID Persistence Explanation

## Does thread_id change on each message?

**NO! The thread_id should be PERSISTENT per conversation.**

### Current Problem (What's Wrong):
```typescript
// Current code - WRONG ❌
thread_id: uuidv4(), // New UUID on EVERY message!
```

This means:
- Message 1: `thread_id = "abc-123"`
- Message 2: `thread_id = "def-456"` (NEW - LLM forgets previous messages!)
- Message 3: `thread_id = "ghi-789"` (NEW - LLM forgets everything!)

**Result**: LLM treats each message as a brand new conversation with no memory.

### Correct Approach (What We Need):
```typescript
// Correct - PERSISTENT thread_id ✅
const conversation = await getOrCreateConversation(userId, platform, platformIdentifier);
thread_id: conversation.thread_id // SAME ID for all messages in this conversation
```

This means:
- Message 1: `thread_id = "abc-123"` (created)
- Message 2: `thread_id = "abc-123"` (SAME - LLM remembers!)
- Message 3: `thread_id = "abc-123"` (SAME - LLM remembers all previous!)

**Result**: LLM maintains conversation context across all messages.

## How It Works

### One Conversation = One Thread ID

```
User: "Hello"
  → Conversation created: thread_id = "thread-abc-123"
  → LLM responds: "Hi! How can I help?"

User: "What's the weather?"
  → Same conversation found: thread_id = "thread-abc-123"
  → LLM remembers previous "Hello" message
  → LLM responds: "I'd be happy to help with weather..."

User: "Tell me more"
  → Same conversation: thread_id = "thread-abc-123"
  → LLM remembers entire conversation history
  → LLM responds contextually
```

### When Does Thread ID Change?

**Only when a NEW conversation is created:**
- New Telegram chat (different chat_id)
- New Web Chat session (different session_id)
- User explicitly starts a new conversation
- Conversation is archived and user starts fresh

**Thread ID NEVER changes within the same conversation.**

## Generic Name Suggestions

Since we're only using one framework and it's essentially a thread/session identifier, here are options:

### Option 1: `thread_id` ⭐ (Recommended)
- **Pros**: Clearly describes purpose (maintains conversation continuity)
- **Cons**: Slightly longer name
- **Use case**: Generic identifier for conversation continuity

### Option 2: `session_id`
- **Pros**: Common term, widely understood
- **Cons**: Might be confused with platform session IDs
- **Use case**: Agent session identifier

### Option 3: `agent_session_id`
- **Pros**: Very clear, no ambiguity
- **Cons**: Longer name
- **Use case**: Explicitly agent's session

### Option 4: `conversation_thread_id`
- **Pros**: Explicitly describes what it is
- **Cons**: Longest name
- **Use case**: Clear but verbose

### Option 5: `thread_id` (Simple)
- **Pros**: Short, matches framework terminology
- **Cons**: Framework-specific term (but if only one framework, it's fine)
- **Use case**: Direct mapping to framework needs

## Recommendation

**Use `thread_id`** because:
1. ✅ Generic and framework-agnostic
2. ✅ Clearly describes its purpose (maintains conversation continuity)
3. ✅ Not confused with platform session IDs
4. ✅ Professional and descriptive

## Updated Schema

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL, -- 'telegram', 'web_chat', 'whatsapp'
  platform_identifier VARCHAR(255) NOT NULL, -- Platform-specific chat ID
  thread_id VARCHAR(255) UNIQUE NOT NULL, -- Persistent thread/session ID for conversation continuity
  title VARCHAR(500),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP,
  is_archived BOOLEAN DEFAULT FALSE,
  
  -- Indexes
  INDEX idx_conversations_user_id (user_id),
  INDEX idx_conversations_platform_identifier (platform_identifier),
  INDEX idx_conversations_user_platform (user_id, platform),
  INDEX idx_conversations_thread_id (thread_id),
  INDEX idx_conversations_last_message (last_message_at DESC),
  UNIQUE (user_id, platform, platform_identifier)
);
```

## Implementation Flow

```typescript
// 1. User sends message
const message = { userId: 123, platform: 'telegram', chatId: '456' };

// 2. Get or create conversation
const conversation = await getOrCreateConversation(
  message.userId,
  message.platform,
  message.chatId
);

// If new conversation:
//   - thread_id = uuidv4() (generated once)
// If existing conversation:
//   - thread_id = existing value (SAME as before)

// 3. Use persistent thread_id for LLM
await agent.invoke(userInput, {
  framework: {
    deepagents: {
      configurable: {
        thread_id: conversation.thread_id, // SAME ID every time!
      }
    }
  }
});

// 4. Next message from same user/chat
//   → Finds same conversation
//   → Uses SAME thread_id
//   → LLM remembers previous messages!
```

