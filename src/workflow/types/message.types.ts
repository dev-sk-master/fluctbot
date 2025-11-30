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
  text?: string; // Text content for TEXT type, or caption for IMAGE/AUDIO/FILE/DOCUMENT/VIDEO
  
  // File references (source-specific IDs/URLs)
  audioUrl?: string; // Source file ID or URL (e.g., Telegram file_id)
  fileUrl?: string; // Source file ID or URL (e.g., Telegram file_id)
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  thumbnailUrl?: string; // Source thumbnail ID or URL
  duration?: number; // For audio/video
  
  // Pre-processed data (populated by input nodes)
  // These are set by input nodes so downstream nodes don't need to call source services
  base64Data?: string; // Base64-encoded file data (for images, documents, files)
  base64Audio?: string; // Base64-encoded audio data
  base64Thumbnail?: string; // Base64-encoded thumbnail (for videos)
  directUrl?: string; // Direct download URL (if available, as fallback)
  
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

