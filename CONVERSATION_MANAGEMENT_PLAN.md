# Conversation Management & Context Retention Plan

## Current State Analysis

### Issues Identified:
1. **No Conversation Continuity**: Each message generates a new `thread_id` using `uuidv4()`, so the LLM treats every message as a new conversation
2. **No Message Persistence**: Messages are not stored in the database
3. **No History Retrieval**: Previous conversation context is never loaded
4. **No Conversation Tracing**: No way to view or debug conversation history

### Current Flow:
```
User Message → Workflow → AI Agent Node → LLM (new thread_id) → Response
```

## Proposed Solution Architecture

### 1. Database Schema

#### `conversations` Table
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL, -- 'telegram', 'web_chat', 'whatsapp'
  platform_identifier VARCHAR(255) NOT NULL, -- Platform-specific chat ID (Telegram chat_id, Web Chat session_id)
  thread_id VARCHAR(255) UNIQUE NOT NULL, -- Persistent thread ID for conversation continuity (generated once per conversation)
  title VARCHAR(500), -- Auto-generated or user-set conversation title
  metadata JSONB DEFAULT '{}', -- Additional metadata (platform-specific data)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP, -- For sorting/recent conversations
  is_archived BOOLEAN DEFAULT FALSE,
  
  -- Indexes
  INDEX idx_conversations_user_id (user_id),
  INDEX idx_conversations_platform_identifier (platform_identifier),
  INDEX idx_conversations_user_platform (user_id, platform),
  INDEX idx_conversations_thread_id (thread_id),
  INDEX idx_conversations_last_message (last_message_at DESC),
  UNIQUE (user_id, platform, platform_identifier) -- One conversation per user/platform/identifier
);
```

**Important: `thread_id` Persistence:**
- **Generated ONCE** when conversation is created (using `uuidv4()`)
- **NEVER changes** for the same conversation (same user + platform + platform_identifier)
- **Used directly** as `thread_id` for DeepAgents/LangGraph frameworks
- **Enables conversation continuity**: LLM remembers all previous messages in the conversation
- **Only changes** when a new conversation is created (different chat, archived conversation, etc.)

#### `conversation_messages` Table
```sql
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id VARCHAR(255) NOT NULL, -- Original FluctMessage.id
  role VARCHAR(20) NOT NULL, -- 'user' | 'assistant' | 'system' | 'tool'
  content_type VARCHAR(50) NOT NULL, -- 'text' | 'image' | 'audio' | 'file' | 'multimodal'
  content_text TEXT, -- Text content or caption
  content_data JSONB, -- Full message content structure (for multimodal)
  metadata JSONB DEFAULT '{}', -- Original message metadata
  tool_calls JSONB, -- If role='tool', store tool execution details
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_conversation_messages_conversation_id (conversation_id),
  INDEX idx_conversation_messages_created_at (created_at),
  INDEX idx_conversation_messages_role (role)
);
```

### 2. Entity Definitions

#### `Conversation` Entity
```typescript
// src/conversations/entities/conversation.entity.ts
@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: number;

  @Column()
  platform: string; // 'telegram' | 'web_chat' | 'whatsapp'

  @Column({ name: 'platform_identifier' })
  platformIdentifier: string; // Platform-specific chat ID

  @Column({ name: 'thread_id', unique: true })
  threadId: string; // Persistent thread ID for conversation continuity

  @Column({ nullable: true })
  title?: string;

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'last_message_at', nullable: true })
  lastMessageAt?: Date;

  @Column({ name: 'is_archived', default: false })
  isArchived: boolean;

  @OneToMany(() => ConversationMessage, (message) => message.conversation)
  messages: ConversationMessage[];
}
```

#### `ConversationMessage` Entity
```typescript
// src/conversations/entities/conversation-message.entity.ts
@Entity('conversation_messages')
export class ConversationMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Conversation, (conv) => conv.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @Column({ name: 'message_id' })
  messageId: string; // Original FluctMessage.id

  @Column()
  role: 'user' | 'assistant' | 'system' | 'tool';

  @Column({ name: 'content_type' })
  contentType: string;

  @Column({ name: 'content_text', type: 'text', nullable: true })
  contentText?: string;

  @Column('jsonb', { nullable: true })
  contentData?: any; // Full MessageContent structure

  @Column('jsonb', { default: {} })
  metadata: Record<string, any>;

  @Column('jsonb', { nullable: true })
  toolCalls?: any[]; // Tool execution details

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

### 3. Service Layer

#### `ConversationsService`
```typescript
// src/conversations/conversations.service.ts
@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepo: Repository<Conversation>,
    @InjectRepository(ConversationMessage)
    private messageRepo: Repository<ConversationMessage>,
  ) {}

  /**
   * Get or create conversation for user/chat
   * Uses platform + platformIdentifier as unique identifier
   * 
   * IMPORTANT: thread_id is generated ONCE when conversation is created
   * and NEVER changes for the same conversation. This enables conversation continuity.
   */
  async getOrCreateConversation(
    userId: number,
    platform: string,
    platformIdentifier: string,
    metadata?: Record<string, any>,
  ): Promise<Conversation> {
    // Try to find existing conversation
    let conversation = await this.conversationRepo.findOne({
      where: {
        userId,
        platform,
        platformIdentifier,
        isArchived: false,
      },
      order: { lastMessageAt: 'DESC' }, // Get most recent active conversation
    });

    if (!conversation) {
      // Create new conversation with new thread_id
      // This ID will be used directly for the agent framework
      // and will persist across all messages in this conversation
      conversation = this.conversationRepo.create({
        userId,
        platform,
        platformIdentifier,
        threadId: uuidv4(), // Generated ONCE, never changes for this conversation
        metadata: metadata || {},
      });
      conversation = await this.conversationRepo.save(conversation);
    }

    // thread_id remains the same for existing conversations
    // This ensures the LLM maintains conversation context across all messages

    return conversation;
  }

  /**
   * Get conversation history (last N messages)
   * Returns messages in UniversalMessage format for LLM
   */
  async getConversationHistory(
    conversationId: string,
    limit: number = 20,
  ): Promise<UniversalMessage[]> {
    const messages = await this.messageRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      take: limit,
    });

    return messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
      content: msg.contentData || msg.contentText || '',
    }));
  }

  /**
   * Save user message to conversation
   */
  async saveUserMessage(
    conversationId: string,
    message: FluctMessage,
  ): Promise<ConversationMessage> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const conversationMessage = this.messageRepo.create({
      conversationId,
      messageId: message.id,
      role: 'user',
      contentType: message.content.type,
      contentText: message.content.text,
      contentData: message.content,
      metadata: message.metadata,
    });

    // Update conversation last_message_at
    conversation.lastMessageAt = new Date();
    await this.conversationRepo.save(conversation);

    return await this.messageRepo.save(conversationMessage);
  }

  /**
   * Save assistant response to conversation
   */
  async saveAssistantMessage(
    conversationId: string,
    messageId: string,
    content: MessageContent,
    toolCalls?: any[],
  ): Promise<ConversationMessage> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const conversationMessage = this.messageRepo.create({
      conversationId,
      messageId,
      role: 'assistant',
      contentType: content.type,
      contentText: content.text,
      contentData: content,
      toolCalls,
    });

    // Update conversation last_message_at
    conversation.lastMessageAt = new Date();
    await this.conversationRepo.save(conversation);

    return await this.messageRepo.save(conversationMessage);
  }

  /**
   * Get user's conversations (for conversation list UI)
   */
  async getUserConversations(
    userId: number,
    limit: number = 50,
    offset: number = 0,
  ): Promise<Conversation[]> {
    return this.conversationRepo.find({
      where: {
        userId,
        isArchived: false,
      },
      order: { lastMessageAt: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['messages'],
    });
  }
}
```

### 4. AI Agent Node Updates

#### Modified `AIAgentNode.exec()` Method
```typescript
protected async exec(
  prepResult: unknown,
  context: NodeExecutionContext,
): Promise<MessageContent> {
  const { userInput, user, message } = prepResult as {
    message: FluctMessage;
    user: any;
    userInput: UniversalMessageContent;
  };

  try {
    // 1. Get or create conversation
    // This will return existing conversation with SAME thread_id if it exists
    // Or create new conversation with NEW thread_id if it doesn't exist
    const conversationsService = this.context.services.conversationsService;
    const conversation = await conversationsService.getOrCreateConversation(
      user.id,
      message.metadata.source,
      message.metadata.chatId,
      message.metadata,
    );

    // 2. Save user message to conversation
    await conversationsService.saveUserMessage(conversation.id, message);

    // 3. Get conversation history (last 20 messages)
    const history = await conversationsService.getConversationHistory(
      conversation.id,
      20,
    );

    // 4. Initialize agent if needed
    if (!this.agentInitialized) {
      await this.initializeAgent(config, user);
    }

    // 5. Build input with conversation history
    let agentInput: UniversalAgentInvokeInput;
    
    if (typeof userInput === 'string') {
      // Text input: prepend history, then current message
      agentInput = [
        ...history, // Previous conversation messages
        {
          role: 'user' as const,
          content: userInput,
        },
      ];
    } else {
      // Multimodal input: prepend history, then current multimodal message
      agentInput = [
        ...history, // Previous conversation messages
        {
          role: 'user' as const,
          content: userInput,
        },
      ];
    }

    // 6. Invoke agent with conversation context
    const inputSummary = this.formatInputForLogging(agentInput);
    this.logger.debug(
      `Invoking AI agent with conversation context (${history.length} previous messages): ${inputSummary}`,
    );

    // Use persistent thread_id for the agent framework
    // This SAME ID is used for all messages in this conversation,
    // enabling the LLM to maintain conversation context
    const agentFramework = config.framework || 'deepagents';
    const frameworkOptions: any = {};
    
    if (agentFramework === 'deepagents' || agentFramework === 'langgraph') {
      frameworkOptions[agentFramework] = {
        configurable: {
          thread_id: conversation.threadId, // Persistent ID - SAME for all messages!
          recursion_limit: 5,
        },
      };
    } else if (agentFramework === 'openai-agents') {
      frameworkOptions['openai-agents'] = {
        thread_id: conversation.threadId, // Use thread_id directly
      };
    } else if (agentFramework === 'pocketflow') {
      frameworkOptions.pocketflow = {
        session_id: conversation.threadId, // Use thread_id as session_id
      };
    }
    // Other frameworks can use thread_id as their session/thread identifier

    const result = await this.agent.invoke(agentInput, {
      framework: frameworkOptions,
    });

    // 7. Extract response
    const outputText = result.output || 'I apologize, but I could not generate a response.';

    // 8. Save assistant response to conversation
    const responseContent: MessageContent = {
      type: MessageType.TEXT,
      text: outputText,
    };

    await conversationsService.saveAssistantMessage(
      conversation.id,
      `response-${Date.now()}`, // Generate response message ID
      responseContent,
      result.toolCalls, // If available from agent result
    );

    return responseContent;
  } catch (error) {
    this.logger.error(
      `Error in AI Agent execution: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      type: MessageType.TEXT,
      text: 'I apologize, but I encountered an error processing your request.',
    };
  }
}
```

### 5. Conversation Tracing & Debugging

#### Add Conversation Logging Service
```typescript
// src/conversations/conversation-logger.service.ts
@Injectable()
export class ConversationLoggerService {
  private readonly logger = new Logger(ConversationLoggerService.name);

  /**
   * Log conversation flow for debugging
   */
  async logConversationFlow(
    conversationId: string,
    step: string,
    data: any,
  ): Promise<void> {
    this.logger.debug(
      `[Conversation ${conversationId}] ${step}: ${JSON.stringify(data, null, 2)}`,
    );
  }

  /**
   * Get conversation trace (all messages + metadata)
   */
  async getConversationTrace(
    conversationId: string,
  ): Promise<{
    conversation: Conversation;
    messages: ConversationMessage[];
    summary: {
      totalMessages: number;
      userMessages: number;
      assistantMessages: number;
      toolCalls: number;
      duration: number; // seconds
    };
  }> {
    const conversation = await this.conversationsService.getConversation(conversationId);
    const messages = await this.conversationsService.getConversationHistory(
      conversationId,
      1000, // Get all messages
    );

    const summary = {
      totalMessages: messages.length,
      userMessages: messages.filter((m) => m.role === 'user').length,
      assistantMessages: messages.filter((m) => m.role === 'assistant').length,
      toolCalls: messages.filter((m) => m.role === 'tool').length,
      duration: conversation.lastMessageAt
        ? Math.floor(
            (conversation.lastMessageAt.getTime() - conversation.createdAt.getTime()) /
              1000,
          )
        : 0,
    };

    return { conversation, messages, summary };
  }
}
```

### 6. API Endpoints for Conversation Management

#### `ConversationsController`
```typescript
// src/conversations/conversations.controller.ts
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly conversationLoggerService: ConversationLoggerService,
  ) {}

  /**
   * Get user's conversations
   */
  @Get()
  async getUserConversations(
    @Request() req: any,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    const userId = req.user?.id;
    return this.conversationsService.getUserConversations(userId, limit, offset);
  }

  /**
   * Get conversation by ID with messages
   */
  @Get(':id')
  async getConversation(@Param('id') id: string) {
    const conversation = await this.conversationsService.getConversation(id);
    const messages = await this.conversationsService.getConversationHistory(id);
    return { conversation, messages };
  }

  /**
   * Get conversation trace (for debugging)
   */
  @Get(':id/trace')
  async getConversationTrace(@Param('id') id: string) {
    return this.conversationLoggerService.getConversationTrace(id);
  }

  /**
   * Archive conversation
   */
  @Patch(':id/archive')
  async archiveConversation(@Param('id') id: string) {
    return this.conversationsService.archiveConversation(id);
  }

  /**
   * Delete conversation
   */
  @Delete(':id')
  async deleteConversation(@Param('id') id: string) {
    return this.conversationsService.deleteConversation(id);
  }
}
```

## Implementation Steps

### Phase 1: Database & Entities
1. ✅ Create migration for `conversations` table
2. ✅ Create migration for `conversation_messages` table
3. ✅ Create `Conversation` entity
4. ✅ Create `ConversationMessage` entity
5. ✅ Create `ConversationsModule`

### Phase 2: Service Layer
1. ✅ Implement `ConversationsService`
2. ✅ Add to `WorkflowNodeContext`
3. ✅ Update `WorkflowNodeContextProvider`

### Phase 3: AI Agent Integration
1. ✅ Update `AIAgentNode` to use conversation context
2. ✅ Replace `uuidv4()` thread_id with persistent `conversation.threadId`
3. ✅ Load conversation history before LLM invocation
4. ✅ Save user messages and assistant responses
5. ✅ Use `threadId` directly for framework-specific thread_id/session_id

### Phase 4: Tracing & Debugging
1. ✅ Implement `ConversationLoggerService`
2. ✅ Add conversation trace endpoints
3. ✅ Add logging for conversation flow

### Phase 5: API & UI Support
1. ✅ Create `ConversationsController`
2. ✅ Add Swagger documentation
3. ✅ (Optional) Create conversation list UI component

## Benefits

1. **Conversation Continuity**: LLM remembers previous messages in the same conversation
2. **Context Retention**: Full conversation history is available to the LLM
3. **Tracing**: Complete conversation history stored and queryable
4. **Debugging**: Easy to trace issues by viewing conversation flow
5. **Analytics**: Can analyze conversation patterns, tool usage, etc.
6. **Multi-Platform**: Works across Telegram, Web Chat, WhatsApp with separate conversations per chat
7. **Scalability**: Database-backed, can handle millions of conversations

## Configuration Options

### Conversation History Limit
```typescript
// In AIAgentNode config
{
  conversationHistoryLimit: 20, // Number of previous messages to include
  maxConversationAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
}
```

### Thread ID Strategy
- **Single Framework**: Since only one framework is used, we use a simple `thread_id` VARCHAR field
- **Persistent Per Conversation**: `thread_id` is generated ONCE when conversation is created and NEVER changes
- **Framework Mapping**: 
  - **DeepAgents/LangGraph**: `thread_id` used directly in framework config
  - **OpenAI Agents**: `thread_id` used directly in OpenAI API
  - **PocketFlow**: `thread_id` used as `session_id` in PocketFlow
- **Conversation Continuity**: Same `thread_id` across all messages in a conversation enables LLM to remember context

### Conversation Strategy
- **Option 1**: One conversation per chat (current plan) - Recommended
  - Each Telegram chat, Web Chat session gets its own conversation
  - Separate conversation history per platform/chat
- **Option 2**: One conversation per user (all platforms combined)
  - Unified conversation across all platforms
- **Option 3**: New conversation after N messages or time period
  - Auto-archive old conversations and create new ones

## Future Enhancements

1. **Conversation Summarization**: Auto-generate conversation titles
2. **Context Window Management**: Smart truncation of old messages
3. **Conversation Search**: Full-text search across conversations
4. **Export Conversations**: Download conversation history
5. **Conversation Analytics**: Track metrics, tool usage, user satisfaction
6. **Multi-turn Tool Execution**: Better handling of tool call chains

