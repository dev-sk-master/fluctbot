/**
 * AI Agent Node
 * Uses UniversalAgent to process user input with LLM and tool execution
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseNode } from '../../core/base-node';
import { NodeExecutionContext } from '../../types/workflow.types';
import { FluctMessage, MessageType, MessageContent } from '../../types/message.types';
import { UniversalAgent, UniversalAgentConfig, UniversalTool, UniversalFramework, UniversalMessageContent, UniversalAgentInvokeInput } from '../../../universal-agent';
import { MemorySaver } from "@langchain/langgraph";
import { WorkflowNodeContext } from '../../services/workflow-node-context';
import { ChatOpenAI } from '@langchain/openai';
import OpenAI from "openai";
import { v4 as uuidv4 } from 'uuid';


export interface AIAgentConfig {
  framework?:  'deepagents';
  modelProvider?: 'openai' | 'openrouter' | 'anthropic' | 'custom';
  modelName?: string;
  apiKey?: string;
  baseURL?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

@Injectable()
export class AIAgentNode extends BaseNode {
  private readonly logger = new Logger(AIAgentNode.name);
  private agent: UniversalAgent | null = null;
  private agentInitialized = false;

  constructor(
    id: string,
    name: string,
    config: AIAgentConfig = {},
    private readonly context: WorkflowNodeContext,
  ) {
    super(id, name, 'ai-agent', config);
  }

  /**
   * Prepare input from context
   * Supports multimodal inputs: text, image, audio, file (with captions)
   */
  protected async prep(
    context: NodeExecutionContext,
  ): Promise<{ message: FluctMessage; user: any; userInput: UniversalMessageContent }> {
    //this.logger.debug(`[prep] Context:\n${JSON.stringify(context, null, 2)}`);
    const message = context.sharedData.message as FluctMessage;
    const user = context.sharedData.user as any;

    if (!message || !message.content) {
      throw new Error('No input message content found');
    }

    // Format multimodal input for LLM (OpenRouter format)
    const userInput = await this.formatMultimodalInput(message.content, message.metadata);

    return { message, user, userInput };
  }

  /**
   * Format multimodal message content for LLM input (OpenRouter format)
   * Returns UniversalMessageContent: string for text, or array for multimodal
   */
  private async formatMultimodalInput(
    content: MessageContent,
    metadata: any,
  ): Promise<UniversalMessageContent> {
    switch (content.type) {
      case MessageType.TEXT:
        // Simple text message - return as string
        return content.text || '';

      case MessageType.IMAGE:
        // Build multimodal array: [text (caption), image]
        const imageContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
        
        // Add caption as text if provided
        if (content.text) {
          imageContent.push({
            type: 'text',
            text: content.text,
          });
        }
        
        // Use pre-populated base64 data from input node
        if (content.base64Data) {
          const mimeType = content.mimeType || 'image/jpeg';
          imageContent.push({
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${content.base64Data}`,
            },
          });
        } else if (content.directUrl) {
          // Fallback: use direct URL if base64 not available
          imageContent.push({
            type: 'image_url',
            image_url: {
              url: content.directUrl,
            },
          });
        }
        
        return imageContent.length > 0 ? imageContent : [{ type: 'text', text: '[Image received]' }];

      case MessageType.AUDIO:
        // Build multimodal array: [text (caption), audio]
        const audioContent: Array<{ type: 'text'; text: string } | { type: 'input_audio'; input_audio: { data: string; format: string } }> = [];
        
        // Add caption as text if provided
        if (content.text) {
          audioContent.push({
            type: 'text',
            text: content.text,
          });
        }
        
        // Use pre-populated base64 audio from input node
        // Audio is converted to WAV format by input node for LLM compatibility
        if (content.base64Audio) {
          // Extract format extension from MIME type (e.g., 'audio/wav' -> 'wav')
          // Default to 'wav' since input node converts all audio to WAV
          let format = 'wav';
          if (content.mimeType) {
            const mimeParts = content.mimeType.split('/');
            if (mimeParts.length > 1) {
              format = mimeParts[1]; // Extract 'wav' from 'audio/wav'
            }
          }
         
          audioContent.push({
            type: 'input_audio',
            input_audio: {
              data: content.base64Audio,
              format: format,
            },
          });
        }
        
        return audioContent.length > 0 ? audioContent : [{ type: 'text', text: '[Audio received]' }];

      case MessageType.DOCUMENT:
      case MessageType.FILE:
        // Build multimodal array: [text (caption), file]
        // Only PDF files are supported for LLM processing
        const fileContent: Array<{ type: 'text'; text: string } | { type: 'file'; file: { filename: string; file_data: string } }> = [];
        
        // Add caption as text if provided
        if (content.text) {
          fileContent.push({
            type: 'text',
            text: content.text,
          });
        }
        
        // Use pre-populated base64 file data from input node
        // Only process PDF files (OpenRouter requirement)
        if (content.base64Data) {
          const mimeType = content.mimeType || 'application/octet-stream';
          
          // Verify it's a PDF file
          if (mimeType !== 'application/pdf') {
            this.logger.warn(
              `Unsupported file type: ${mimeType}. Only PDF files are supported. Skipping file.`,
            );
            // Fallback to text description
            fileContent.push({
              type: 'text',
              text: `[File received - unsupported type: ${mimeType}. Only PDF files are supported.]`,
            });
          } else {
            // Ensure filename has .pdf extension
            let filename = content.fileName || 'document.pdf';
            if (!filename.toLowerCase().endsWith('.pdf')) {
              filename = filename.endsWith('.') ? filename + 'pdf' : filename + '.pdf';
            }
            
            // Construct data URL with PDF MIME type (OpenRouter format)
            // OpenRouter expects file_data (snake_case) with data URL format
            const dataUrl = `data:application/pdf;base64,${content.base64Data}`;
            
            fileContent.push({
              type: 'file',
              file: {
                filename: filename,
                file_data: dataUrl, // Use snake_case as required by OpenRouter API
              } as any, // Type assertion needed for snake_case property
            });
            
            this.logger.debug(`Added PDF file: ${filename}, data length: ${content.base64Data.length}`);
          }
        }
        
        return fileContent.length > 0 ? fileContent : [{ type: 'text', text: `[File received: ${content.type === MessageType.DOCUMENT ? 'Document' : 'File'}]` }];

      case MessageType.VIDEO:
        // For video, treat similar to image (some models support video)
        // For now, use image_url format or fallback to text description
        const videoContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
        
        if (content.text) {
          videoContent.push({
            type: 'text',
            text: content.text,
          });
        }
        
        // Use pre-populated base64 thumbnail from input node
        // Note: OpenRouter may not support video directly, so we'll use thumbnail
        if (content.base64Thumbnail) {
          videoContent.push({
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${content.base64Thumbnail}`,
            },
          });
        }
        
        return videoContent.length > 0 ? videoContent : [{ type: 'text', text: '[Video received]' }];

      default:
        return '[Unsupported message type]';
    }
  }


  /**
   * Format file size in human-readable format
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Format agent input for logging (shows text or content type, not full base64 data)
   */
  private formatInputForLogging(input: UniversalAgentInvokeInput): string {
    if (typeof input === 'string') {
      return `[TEXT] ${input.substring(0, 200)}${input.length > 200 ? '...' : ''}`;
    }

    if (Array.isArray(input)) {
      const parts: string[] = [];
      for (const msg of input) {
        if (typeof msg === 'string') {
          parts.push(`[TEXT] ${msg.substring(0, 200)}${msg.length > 200 ? '...' : ''}`);
        } else if (msg && typeof msg === 'object' && 'role' in msg && 'content' in msg) {
          const role = msg.role;
          const content = msg.content;

          if (typeof content === 'string') {
            parts.push(`[${role.toUpperCase()}] [TEXT] ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`);
          } else if (Array.isArray(content)) {
            const contentParts: string[] = [];
            for (const part of content) {
              if (part.type === 'text') {
                contentParts.push(`[TEXT] ${(part as any).text?.substring(0, 100) || ''}${(part as any).text?.length > 100 ? '...' : ''}`);
              } else if (part.type === 'image_url') {
                contentParts.push(`[IMAGE]`);
              } else if (part.type === 'input_audio') {
                contentParts.push(`[AUDIO]`);
              } else if (part.type === 'file') {
                contentParts.push(`[FILE]`);
              } else {
                contentParts.push(`[${part.type.toUpperCase()}]`);
              }
            }
            parts.push(`[${role.toUpperCase()}] ${contentParts.join(', ')}`);
          } else {
            parts.push(`[${role.toUpperCase()}] [UNKNOWN]`);
          }
        }
      }
      return parts.join(' | ');
    }

    return '[UNKNOWN INPUT FORMAT]';
  }

  /**
   * Execute AI Agent processing
   */
  protected async exec(
    prepResult: unknown,
    context: NodeExecutionContext,
  ): Promise<MessageContent> {
    //this.logger.debug(`[exec] Context:\n${JSON.stringify(context, null, 2)}`);
    //this.logger.debug(`[exec] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    const { userInput, user, message } = prepResult as { message: FluctMessage; user: any; userInput: UniversalMessageContent };
    const config = this.config as AIAgentConfig;

    try {
      // 1. Get or create conversation
      // This will return existing conversation with SAME thread_id if it exists
      // Or create new conversation with NEW thread_id if it doesn't exist
      // Note: User message is already saved by access-control node
      const conversationsService = this.context.services.conversationsService;
      const conversation = await conversationsService.getOrCreateConversation(
        user.id,
        message.metadata.platform,
        message.metadata.platformIdentifier,
        message.metadata,
      );

      // 2. Get conversation history (last 20 messages)
      // Exclude current message ID to avoid duplicates (user message already saved by access-control node)
      const history = await conversationsService.getConversationHistory(
        conversation.id,
        20,
        message.id, // Exclude current message to prevent duplicate
      );

      // 4. Initialize agent if not already done
      if (!this.agentInitialized) {
        await this.initializeAgent(config, user);
      }

      if (!this.agent) {
        throw new Error('Agent not initialized');
      }

      // 5. Build input with conversation history
      // If userInput is string, prepend history; if array (multimodal), prepend history
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

      // 6. Use persistent thread_id for the agent framework
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
      } 
      // else if (agentFramework === 'openai-agents') {
      //   frameworkOptions['openai-agents'] = {
      //     thread_id: conversation.threadId, // Use thread_id directly
      //   };
      // } else if (agentFramework === 'pocketflow') {
      //   frameworkOptions.pocketflow = {
      //     session_id: conversation.threadId, // Use thread_id as session_id
      //   };
      // }
      // Other frameworks can use thread_id as their session/thread identifier

      // 7. Invoke agent with conversation context
      const inputSummary = this.formatInputForLogging(agentInput);
      this.logger.debug(
        `Invoking AI agent with conversation context (${history.length} previous messages, thread_id: ${conversation.threadId}): ${inputSummary}`,
      );
      console.log('agentInput',JSON.stringify(agentInput,null,2));
      const result = await this.agent.invoke(agentInput, {
        framework: frameworkOptions,
      });

      this.logger.debug(`AI Agent response: ${JSON.stringify(result, null, 2)}`);

      // 8. Extract output from result
      const outputText = result.output || 'I apologize, but I could not generate a response.';

      // 9. Create response content
      // Note: Response will be saved to conversation by unified-output node
      const outputContent: MessageContent = {
        type: MessageType.TEXT,
        text: outputText,
      };

      // Store tool calls in sharedData for unified-output to save (if available)
      // Tool calls might be in result.metadata or result object
      const toolCalls = (result as any).toolCalls || (result as any).metadata?.toolCalls;
      if (toolCalls) {
        context.sharedData.aiAgentToolCalls = toolCalls;
      }

      return outputContent;
    } catch (error) {
      this.logger.error(
        `Error in AI Agent execution: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Return error message to user
      return {
        type: MessageType.TEXT,
        text: 'I apologize, but I encountered an error processing your request. Please try again.',
      };
    }
  }

  /**
   * Store processed content in shared data
   */
  protected async post(
    context: NodeExecutionContext,
    prepResult: unknown,
    execResult: unknown,
  ): Promise<string | undefined> {
    //this.logger.debug(`[post] Context:\n${JSON.stringify(context, null, 2)}`);
    //this.logger.debug(`[post] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    //this.logger.debug(`[post] ExecResult:\n${JSON.stringify(execResult, null, 2)}`);
    const processedContent = execResult as MessageContent;

    // Store processed content for output nodes
    context.sharedData.processedContent = processedContent;

    this.logger.debug('AI Agent node completed');

    return undefined; // Continue to next node
  }

  /**
   * Initialize the UniversalAgent with configuration
   */
  private async initializeAgent(config: AIAgentConfig, user: any): Promise<void> {
    if (this.agentInitialized) {
      return;
    }

    try {
      // Get tools and wrap them with user context
      const tools = this.getToolsWithContext(user);

      // Determine framework (default to langchain)
      const framework = config.framework || 'langchain';

      // Create model based on provider
      const model = this.createModel(config);

      const checkpointer = new MemorySaver();

      // Get system prompt
      const systemPrompt = `
You are Fluct's Maritime Assistant.

Your job is to provide accurate, concise, and helpful information about:
- maritime operations and shipping
- navigation, ports, and logistics
- vessel types, AIS data, and movements
- maritime regulations and compliance
- weather and conditions at sea
- maritime history and general knowledge

Guidelines:
- Be factual, clear, and professional.
- Answer only what the user asked, unless important context is required for clarity.
- If a question is ambiguous, choose the most reasonable interpretation and state your assumption.
- Use standard maritime units (knots, NM, TEU, GT, UTC) unless the user specifies otherwise.
- When referencing times, default to UTC.
- If multiple questions are asked, answer each one separately and clearly.
- For images: extract visible text, combine with caption, and answer all questions found.
- For audio: transcribe all spoken content and answer all questions or instructions found.
- Never fabricate AIS or vessel data; if unavailable, explain what is missing and what can be done.
- Keep responses concise but not lacking important details.      
      `;

      // Create agent configuration
      const agentConfig: UniversalAgentConfig = {
        framework,
        model,
        tools,
        systemPrompt,
        options: {
          framework: {
            deepagents: {
              checkpointer: checkpointer,
              interruptOn: {},
            },
          },
        },
      };

      // Create and initialize agent
      this.agent = new UniversalAgent(agentConfig);

      await this.agent.init();

      this.agentInitialized = true;
      this.logger.log(`AI Agent initialized with framework: ${framework}, tools: ${tools.length}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize AI Agent: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get tools with user context bound
   */
  private getToolsWithContext(user: any): UniversalTool[] {
    const tools = this.context.services.agentToolsService.getTools();

    // Wrap tools to inject user context
    return tools.map((tool) => ({
      ...tool,
      execute: async (...args: any[]) => {
        // Extract parameters (could be object or array)
        const params = args.length === 1 && typeof args[0] === 'object' ? args[0] : { input: args[0] };

        // Add user context
        const context = { userId: user?.id };

        // Call original execute with params and context
        return await tool.execute(params, context);
      },
    }));
  }

  /**
   * Create model instance based on configuration
   * Uses the createModel pattern from universal-agent
   */
  private createModel(config: AIAgentConfig): any {
    const framework = (config.framework || 'langchain') as UniversalFramework;
    const modelName = config.modelName || 'openai/gpt-4o-mini';
    const apiKey = config.apiKey || this.context.config.configService.get<string>('OPENROUTER_API_KEY') || this.context.config.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      throw new Error(`API key not found. Please set OPENROUTER_API_KEY or OPENAI_API_KEY environment variable.`);
    }

    // Use ChatOpenAI for deepagents and langchain frameworks
    if (framework === 'deepagents' || framework === 'langchain') {
      return new ChatOpenAI({
        model: modelName,
        temperature: config.temperature ?? 0.7,
        apiKey: apiKey,
        configuration: {
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': this.context.config.configService.get<string>('OPENROUTER_HTTP_REFERER') || 'https://github.com/fluct/fluctbot',
            'X-Title': 'FluctBot',
          },
        },
        timeout: 60 * 1000,
      });
    } else {

      return new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || "https://github.com/yourusername/universal-agent",
          "X-Title": "Universal Agent",
        },
      });
    }
  }



  validateConfig(): boolean {
    return true;
  }
}

