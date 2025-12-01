import { Injectable, Logger } from '@nestjs/common';
import {
  FluctMessage,
  MessagePlatform,
  MessageType,
  MessageStatus,
  MessageMetadata,
  MessageContent,
} from '../../types/message.types';
import { WorkflowService } from '../../services/workflow.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageResponseDto } from './dto/message-response.dto';

@Injectable()
export class WebChatService {
  private readonly logger = new Logger(WebChatService.name);

  constructor(private readonly workflowService: WorkflowService) {}

  /**
   * Convert Web Chat request to FluctMessage
   */
  convertToFluctMessage(dto: SendMessageDto): FluctMessage {
    const messageId = `web_chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userId = dto.userId;
    const platformIdentifier = dto.platformIdentifier || dto.userId;

    // Build content based on type
    let content: MessageContent;

    switch (dto.type) {
      case MessageType.TEXT:
        content = {
          type: MessageType.TEXT,
          text: dto.text || '',
        };
        break;

      case MessageType.AUDIO:
        content = {
          type: MessageType.AUDIO,
          audioUrl: dto.audioUrl,
          duration: dto.duration,
          mimeType: dto.mimeType,
          fileSize: dto.fileSize,
        };
        break;

      case MessageType.FILE:
      case MessageType.DOCUMENT:
        content = {
          type: dto.type,
          fileUrl: dto.fileUrl,
          fileName: dto.fileName,
          mimeType: dto.mimeType,
          fileSize: dto.fileSize,
        };
        break;

      case MessageType.IMAGE:
        content = {
          type: MessageType.IMAGE,
          fileUrl: dto.imageUrl || dto.fileUrl,
          thumbnailUrl: dto.thumbnailUrl,
          fileSize: dto.fileSize,
          mimeType: dto.mimeType,
        };
        break;

      case MessageType.VIDEO:
        content = {
          type: MessageType.VIDEO,
          fileUrl: dto.videoUrl || dto.fileUrl,
          duration: dto.duration,
          mimeType: dto.mimeType,
          fileSize: dto.fileSize,
          thumbnailUrl: dto.thumbnailUrl,
        };
        break;

      default:
        content = {
          type: MessageType.TEXT,
          text: '[Unsupported message type]',
        };
    }

    const metadata: MessageMetadata = {
      platform: MessagePlatform.WEB_CHAT,
      platformIdentifier, // Chat/conversation ID (Web Chat session_id)
      userId,
      timestamp: new Date(),

      // Raw source payload for downstream processing/debugging
      payload: dto,

      ...dto.metadata,
    };

    const message: FluctMessage = {
      id: messageId,
      metadata,
      content,
      status: MessageStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return message;
  }

  /**
   * Process message through workflow and return response
   */
  async processMessage(
    dto: SendMessageDto,
    workflowId: string = 'unified-workflow',
  ): Promise<MessageResponseDto> {
    // Convert to FluctMessage
    const message = this.convertToFluctMessage(dto);

    this.logger.debug(
      `Processing Web Chat message ${message.id} for user ${dto.userId}`,
    );

    // Execute workflow
    const execution = await this.workflowService.executeWorkflow(
      workflowId,
      message,
    );

    // Extract response from execution
    const response = (execution.sharedData.webChatResponse ||
      execution.sharedData.outputResponse) as
      | {
          messageId: string;
          content: MessageContent;
          metadata?: Record<string, unknown>;
        }
      | undefined;

    if (!response) {
      // Fallback: use processed content or original message
      const processedContent = execution.sharedData.processedContent as
        | MessageContent
        | undefined;
      const responseData = execution.sharedData.response as
        | { type: string; text?: string }
        | undefined;

      const responseText = responseData?.text;

      return {
        messageId: message.id,
        type: message.content.type,
        content: responseText
          ? {
              type: MessageType.TEXT,
              text: responseText,
            }
          : (processedContent || message.content),
        metadata: {
          workflowId: execution.id,
          status: execution.status,
        },
      };
    }

    return {
      messageId: response.messageId,
      type: response.content.type,
      content: response.content,
      metadata: response.metadata,
    };
  }
}
