/**
 * Telegram Input Node
 * Receives messages from Telegram and converts them to FluctMessage format
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseNode } from '../../core/base-node';
import { NodeExecutionContext } from '../../types/workflow.types';
import {
  FluctMessage,
  MessagePlatform,
  MessageType,
  MessageStatus,
  MessageMetadata,
  MessageContent,
} from '../../types/message.types';
import { WorkflowNodeContext } from '../../services/workflow-node-context';
import ffmpeg from 'fluent-ffmpeg';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface TelegramInputConfig {
  botToken?: string; // Usually handled at service level
  webhookUrl?: string;
  [key: string]: unknown;
}

@Injectable()
export class TelegramInputNode extends BaseNode {
  private readonly logger = new Logger(TelegramInputNode.name);

  constructor(
    id: string,
    name: string,
    config: TelegramInputConfig = {},
    private readonly context?: WorkflowNodeContext,
  ) {
    super(id, name, 'telegram-input', config);
  }

  /**
   * Convert Telegram update to FluctMessage
   */
  protected async prep(
    context: NodeExecutionContext,
  ): Promise<unknown> {
    //this.logger.debug(`[prep] Context:\n${JSON.stringify(context, null, 2)}`);
    // The message should already be a FluctMessage if coming from Telegram service
    // But we can validate and enhance it here
    const message = context.message as FluctMessage;

    if (!message || !message.metadata) {
      throw new Error('Invalid message format in TelegramInputNode');
    }

    // Ensure message is from Telegram
    if (message.metadata.platform !== MessagePlatform.TELEGRAM) {
      this.logger.warn(
        `Message platform is ${message.metadata.platform}, expected TELEGRAM`,
      );
    }

    return message;
  }

  /**
   * Process and normalize the message
   * Downloads and converts media files to base64 for downstream nodes
   */
  protected async exec(
    prepResult: unknown,
    context: NodeExecutionContext,
  ): Promise<FluctMessage> {
    //this.logger.debug(`[exec] Context:\n${JSON.stringify(context, null, 2)}`);
    //this.logger.debug(`[exec] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    const message = prepResult as FluctMessage;

    // Validate message structure
    if (!message.id || !message.metadata || !message.content) {
      throw new Error('Invalid FluctMessage structure');
    }

    // Ensure status is set
    message.status = MessageStatus.PROCESSING;

    // Download and convert media files to base64 if needed
    // This ensures downstream nodes (like AI agent) don't need to call source services
    if (this.context?.services.telegramService && message.metadata.platform === MessagePlatform.TELEGRAM) {
      await this.enrichContentWithBase64(message.content);
    }

    this.logger.debug(
      `Processing Telegram message ${message.id} from chat ${message.metadata.platformIdentifier}`,
    );

    return message;
  }

  /**
   * Download and convert media files to base64
   * Populates base64Data, base64Audio, base64Thumbnail fields in MessageContent
   */
  private async enrichContentWithBase64(content: MessageContent): Promise<void> {
    if (!this.context?.services.telegramService) {
      return;
    }

    const telegramService = this.context.services.telegramService;

    try {
      switch (content.type) {
        case MessageType.IMAGE:
          if (content.fileUrl && !content.base64Data) {
            this.logger.debug(`Downloading image ${content.fileUrl} for base64 conversion`);
            const base64Image = await telegramService.downloadFileAsBase64(content.fileUrl);
            if (base64Image) {
              content.base64Data = base64Image;
              // Also get direct URL as fallback
              const directUrl = await telegramService.getFileUrl(content.fileUrl);
              if (directUrl) {
                content.directUrl = directUrl;
              }
            }
          }
          break;

        case MessageType.AUDIO:
          if (content.audioUrl && !content.base64Audio) {
            this.logger.debug(`Downloading audio ${content.audioUrl} for base64 conversion`);
            await this.processAudioContent(content, telegramService);
          }
          break;

        case MessageType.DOCUMENT:
        case MessageType.FILE:
          if (content.fileUrl && !content.base64Data) {
            this.logger.debug(`Downloading file ${content.fileUrl} for base64 conversion`);
            const base64File = await telegramService.downloadFileAsBase64(content.fileUrl);
            if (base64File) {
              content.base64Data = base64File;
            }
          }
          break;

        case MessageType.VIDEO:
          // Download thumbnail if available
          if (content.thumbnailUrl && !content.base64Thumbnail) {
            this.logger.debug(`Downloading video thumbnail ${content.thumbnailUrl} for base64 conversion`);
            const base64Thumbnail = await telegramService.downloadFileAsBase64(content.thumbnailUrl);
            if (base64Thumbnail) {
              content.base64Thumbnail = base64Thumbnail;
            }
          }
          // Also download video file if needed (for future video processing)
          if (content.fileUrl && !content.base64Data) {
            this.logger.debug(`Downloading video ${content.fileUrl} for base64 conversion`);
            const base64Video = await telegramService.downloadFileAsBase64(content.fileUrl);
            if (base64Video) {
              content.base64Data = base64Video;
            }
          }
          break;

        case MessageType.TEXT:
          // No media to download
          break;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to enrich content with base64: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Continue without base64 data - downstream nodes can handle fallback
    }
  }

  /**
   * Store normalized message in shared data
   */
  protected async post(
    context: NodeExecutionContext,
    prepResult: unknown,
    execResult: unknown,
  ): Promise<string | undefined> {
    //this.logger.debug(`[post] Context:\n${JSON.stringify(context, null, 2)}`);
    //this.logger.debug(`[post] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    //this.logger.debug(`[post] ExecResult:\n${JSON.stringify(execResult, null, 2)}`);
    const message = execResult as FluctMessage;

    // Store in shared data for next nodes (mutable version)
    // Note: platform, platformIdentifier, userId are available via message.metadata.*
    context.sharedData.message = message;

    this.logger.debug(
      `Telegram input node completed for message ${message.id}`,
    );

    return undefined; // Continue to next node
  }

  /**
   * Process audio content: download, convert to WAV if needed, and store as base64
   */
  private async processAudioContent(
    content: MessageContent,
    telegramService: any,
  ): Promise<void> {
    if (!content.audioUrl) {
      return;
    }

    let tempAudioPath: string | null = null;
    let tempWavPath: string | null = null;

    try {
      // Download audio as buffer
      const audioBuffer = await telegramService.downloadFileAsBuffer(content.audioUrl);
      if (!audioBuffer) {
        this.logger.warn('Failed to download audio buffer');
        return;
      }

      // Determine file extension from mime type or default to ogg
      const mimeType = content.mimeType || 'audio/ogg';
      const fileExtension = this.getFileExtensionFromMimeType(mimeType) || 'ogg';

      // Save downloaded audio to temporary file
      const tempDir = os.tmpdir();
      tempAudioPath = path.join(tempDir, `telegram_audio_${Date.now()}.${fileExtension}`);
      await fs.writeFile(tempAudioPath, audioBuffer);

      // Convert to WAV if not already WAV
      let finalAudioBuffer = audioBuffer;
      let finalMimeType = 'audio/wav';

      if (fileExtension !== 'wav') {
        this.logger.debug(`Converting ${fileExtension} to WAV format...`);
        tempWavPath = path.join(tempDir, `telegram_audio_${Date.now()}.wav`);
        
        await this.convertOggToWav(tempAudioPath, tempWavPath);
        this.logger.debug('Audio conversion to WAV complete!');

        // Read the converted WAV file
        finalAudioBuffer = await fs.readFile(tempWavPath);
      } else {
        // Already WAV, use original
        finalMimeType = 'audio/wav';
      }

      // Convert to base64 for LLM
      const base64Audio = finalAudioBuffer.toString('base64');
      content.base64Audio = base64Audio;
      
      // Update mime type to WAV for LLM compatibility
      content.mimeType = finalMimeType;

      this.logger.debug(`Audio processed successfully: ${finalAudioBuffer.length} bytes, format: ${finalMimeType}`);
    } catch (error) {
      this.logger.error(
        `Error processing audio: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Fallback: try to use original audio without conversion
      try {
        const base64Audio = await telegramService.downloadFileAsBase64(content.audioUrl);
        if (base64Audio) {
          content.base64Audio = base64Audio;
        }
      } catch (fallbackError) {
        this.logger.error(`Fallback audio download also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
      }
    } finally {
      // Clean up temporary files
      if (tempAudioPath) {
        try {
          await fs.unlink(tempAudioPath);
        } catch (err: unknown) {
          this.logger.warn(`Failed to delete temporary audio file: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      if (tempWavPath) {
        try {
          await fs.unlink(tempWavPath);
        } catch (err: unknown) {
          this.logger.warn(`Failed to delete temporary WAV file: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  /**
   * Convert OGG (or other audio format) to WAV using ffmpeg
   */
  private async convertOggToWav(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!ffmpegPath) {
        reject(new Error('@ffmpeg-installer/ffmpeg not found'));
        return;
      }

      this.logger.debug(`Using FFmpeg at: ${ffmpegPath}`);

      ffmpeg(inputPath)
        .setFfmpegPath(ffmpegPath)
        .toFormat('wav')
        .on('end', () => {
          this.logger.debug(`Audio conversion completed: ${outputPath}`);
          resolve();
        })
        .on('error', (err: Error) => {
          this.logger.error(`FFmpeg conversion error: ${err.message}`);
          reject(err);
        })
        .save(outputPath);
    });
  }

  /**
   * Get file extension from MIME type
   */
  private getFileExtensionFromMimeType(mimeType: string): string | null {
    const mimeToExt: Record<string, string> = {
      'audio/ogg': 'ogg',
      'audio/oga': 'oga',
      'audio/opus': 'opus',
      'audio/wav': 'wav',
      'audio/wave': 'wav',
      'audio/x-wav': 'wav',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a',
      'audio/webm': 'webm',
    };

    return mimeToExt[mimeType.toLowerCase()] || null;
  }

  validateConfig(): boolean {
    // Telegram input node doesn't require specific config
    // Bot token is handled at service level
    return true;
  }
}

