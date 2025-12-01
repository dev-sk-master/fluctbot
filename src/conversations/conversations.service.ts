import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationMessage } from './entities/conversation-message.entity';
import { FluctMessage, MessageContent, MessageType } from '../workflow/types/message.types';
import { v4 as uuidv4 } from 'uuid';
import { UniversalMessage } from '../universal-agent';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

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
      this.logger.debug(
        `Created new conversation ${conversation.id} with thread_id ${conversation.threadId} for user ${userId} on ${platform}`,
      );
    } else {
      this.logger.debug(
        `Found existing conversation ${conversation.id} with thread_id ${conversation.threadId} for user ${userId} on ${platform}`,
      );
    }

    // thread_id remains the same for existing conversations
    // This ensures the LLM maintains conversation context across all messages

    return conversation;
  }

  /**
   * Get conversation history (last N messages)
   * Returns messages in UniversalMessage format for LLM
   * 
   * Note: Converts MessageContent to UniversalMessageContent (string)
   * For history, we only use text content (multimodal is only for current message)
   * 
   * @param conversationId - Conversation ID
   * @param limit - Maximum number of messages to retrieve
   * @param excludeMessageId - Optional: Exclude this message ID from history (to avoid duplicates)
   */
  async getConversationHistory(
    conversationId: string,
    limit: number = 20,
    excludeMessageId?: string,
  ): Promise<UniversalMessage[]> {
    // Exclude current message if provided (to avoid duplicates)
    const messages = await this.messageRepo.find({
      where: excludeMessageId 
        ? { conversationId, messageId: Not(excludeMessageId) }
        : { conversationId },
      order: { createdAt: 'ASC' },
      take: limit,
    });

    return messages.map((msg) => {
      // Convert MessageContent to UniversalMessageContent (string for history)
      // contentData is a MessageContent object, contentText is the text field
      let content: string;
      
      if (msg.contentText) {
        // Use contentText if available (direct text)
        content = msg.contentText;
      } else if (msg.contentData) {
        // If contentData exists, extract text from MessageContent object
        if (typeof msg.contentData === 'string') {
          content = msg.contentData;
        } else if (typeof msg.contentData === 'object' && msg.contentData !== null) {
          // MessageContent object: extract text field
          content = (msg.contentData as any).text || '';
        } else {
          content = '';
        }
      } else {
        content = '';
      }
      
      return {
        role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
        content: content, // Always string for history (multimodal only for current message)
      };
    });
  }

  /**
   * Check if a message with the given messageId already exists in conversation
   */
  async messageExistsInConversation(
    conversationId: string,
    messageId: string,
  ): Promise<boolean> {
    const existing = await this.messageRepo.findOne({
      where: {
        conversationId,
        messageId,
      },
    });
    return !!existing;
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

    const savedMessage = await this.messageRepo.save(conversationMessage);
    this.logger.debug(`Saved user message ${savedMessage.id} to conversation ${conversationId}`);

    return savedMessage;
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

    const savedMessage = await this.messageRepo.save(conversationMessage);
    this.logger.debug(`Saved assistant message ${savedMessage.id} to conversation ${conversationId}`);

    return savedMessage;
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

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    return this.conversationRepo.findOne({
      where: { id: conversationId },
      relations: ['messages'],
    });
  }

  /**
   * Archive conversation
   */
  async archiveConversation(conversationId: string): Promise<void> {
    await this.conversationRepo.update(conversationId, { isArchived: true });
    this.logger.debug(`Archived conversation ${conversationId}`);
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.conversationRepo.delete(conversationId);
    this.logger.debug(`Deleted conversation ${conversationId}`);
  }

  /**
   * Unified method to save message and response to conversation
   * Used by all nodes (Command, Onboarding, AI Agent) to maintain conversation history
   */
  async saveMessageToConversation(
    userId: number,
    platform: string,
    platformIdentifier: string,
    message: FluctMessage,
    response?: MessageContent,
    metadata?: {
      nodeType?: 'command' | 'onboarding' | 'ai-agent' | 'echo';
      commandName?: string;
      onboardingStep?: string;
      toolCalls?: any[];
    },
  ): Promise<void> {
    try {
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
        // Merge metadata with response metadata
        const responseMetadata = {
          ...message.metadata,
          ...(metadata || {}),
        };

        await this.saveAssistantMessage(
          conversation.id,
          `response-${Date.now()}`,
          response,
          metadata?.toolCalls,
        );

        this.logger.debug(
          `Saved ${metadata?.nodeType || 'unknown'} interaction to conversation ${conversation.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to save message to conversation: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - conversation tracking should not break the workflow
    }
  }

  /**
   * Save assistant response from workflow sharedData
   * Detects node type and extracts response content automatically
   * 
   * Note: User message should already be saved by Access Control or Onboarding node
   */
  async saveAssistantResponseFromSharedData(
    userId: number,
    message: FluctMessage,
    sharedData: {
      processedContent?: MessageContent;
      response?: { type: string; text?: string };
      commandResponse?: string;
      aiAgentToolCalls?: any[];
    },
    commandsService?: {
      isCommand: (text: string) => boolean;
      extractCommand: (text: string) => string | null;
    },
  ): Promise<void> {
    try {
      // Get or create conversation (should already exist, user message already saved)
      const conversation = await this.getOrCreateConversation(
        userId,
        message.metadata.platform,
        message.metadata.platformIdentifier,
        message.metadata,
      );

      // Determine response content and node type from sharedData
      const { processedContent, response: responseData, commandResponse, aiAgentToolCalls } = sharedData;

      let nodeType: 'command' | 'onboarding' | 'ai-agent' | 'echo' = 'echo';
      let commandName: string | undefined;
      let responseContent: MessageContent | undefined;

      // Check for command response
      if (commandResponse) {
        nodeType = 'command';
        responseContent = {
          type: MessageType.TEXT,
          text: commandResponse,
        };
        // Try to extract command name from message
        if (commandsService && message.content.type === MessageType.TEXT && message.content.text) {
          const text = message.content.text.trim();
          if (commandsService.isCommand(text)) {
            const cmd = commandsService.extractCommand(text);
            commandName = cmd || undefined;
          }
        }
      }
      // Check for onboarding response
      else if (responseData && responseData.type === 'text' && responseData.text) {
        nodeType = 'onboarding';
        responseContent = {
          type: MessageType.TEXT,
          text: responseData.text,
        };
      }
      // Check for AI agent or echo processor response
      else if (processedContent) {
        // Check if tool calls are present (indicates AI agent)
        if (aiAgentToolCalls && aiAgentToolCalls.length > 0) {
          nodeType = 'ai-agent';
        } else {
          nodeType = 'echo';
        }
        responseContent = processedContent;
      }

      // Save assistant response if we have response content
      if (responseContent) {
        await this.saveAssistantMessage(
          conversation.id,
          `response-${message.id}-${Date.now()}`,
          responseContent,
          aiAgentToolCalls,
        );

        this.logger.debug(
          `Saved ${nodeType} response to conversation ${conversation.id}${commandName ? ` (command: ${commandName})` : ''}`,
        );
      }
    } catch (error) {
      // Don't break the workflow if conversation saving fails
      this.logger.error(
        `Failed to save assistant response to conversation: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

