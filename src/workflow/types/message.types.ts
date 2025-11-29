/**
 * Common message structure for all input sources
 * This ensures consistent processing across Telegram, WhatsApp, and Web Chat
 */

export enum MessageSource {
  TELEGRAM = 'telegram',
  WHATSAPP = 'whatsapp',
  WEB_CHAT = 'web_chat',
}

export enum MessageType {
  TEXT = 'text',
  AUDIO = 'audio',
  FILE = 'file',
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
}

export enum MessageStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface MessageMetadata {
  source: MessageSource;
  sourceId: string; // Original message ID from source
  userId: string; // User identifier from source
  chatId: string; // Chat/Conversation ID
  timestamp: Date;
  [key: string]: unknown; // Additional source-specific metadata
}

export interface MessageContent {
  type: MessageType;
  text?: string;
  audioUrl?: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  thumbnailUrl?: string;
  duration?: number; // For audio/video
  [key: string]: unknown; // Additional content-specific data
}

export interface FluctMessage {
  id: string; // Internal message ID
  metadata: MessageMetadata;
  content: MessageContent;
  status: MessageStatus;
  workflowId?: string; // Associated workflow execution ID
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageResponse {
  messageId: string;
  source: MessageSource;
  chatId: string;
  content: MessageContent;
  metadata?: Record<string, unknown>;
}

