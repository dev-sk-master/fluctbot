/**
 * Common message structure for all input platforms
 * This ensures consistent processing across Telegram, WhatsApp, and Web Chat
 */

export enum MessagePlatform {
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
  platform: MessagePlatform;
  platformIdentifier: string; // Platform identifier (e.g., Telegram chat_id, Web Chat session_id)
  userId: string; // User identifier from platform
  timestamp: Date;
  [key: string]: unknown; // Additional platform-specific metadata
}

export interface MessageContent {
  type: MessageType;
  text?: string; // Text content for TEXT type, or caption for IMAGE/AUDIO/FILE/DOCUMENT/VIDEO
  
  // File references (platform-specific IDs/URLs)
  audioUrl?: string; // Platform file ID or URL (e.g., Telegram file_id)
  fileUrl?: string; // Platform file ID or URL (e.g., Telegram file_id)
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  thumbnailUrl?: string; // Source thumbnail ID or URL
  duration?: number; // For audio/video
  
  // Pre-processed data (populated by input nodes)
  // These are set by input nodes so downstream nodes don't need to call platform services
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
  platform: MessagePlatform;
  platformIdentifier: string; // Platform identifier (e.g., Telegram chat_id, Web Chat session_id)
  content: MessageContent;
  metadata?: Record<string, unknown>;
}

