/**
 * Ngrok Service
 * Handles ngrok tunnel detection and URL retrieval
 * General utility for making local endpoints publicly accessible
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ngrok from '@ngrok/ngrok';

@Injectable()
export class NgrokService implements OnModuleDestroy {
  private readonly logger = new Logger(NgrokService.name);
  private readonly appPort: number;
  private ngrokListener: any = null; // ngrok.Listener instance
  private ngrokUrl: string | null = null;
  private isNgrokStartedByUs = false;

  constructor(private readonly configService: ConfigService) {
    // Get port from environment or config
    this.appPort = parseInt(
      this.configService.get<string>('PORT') || '3000',
      10,
    );
  }

  async onModuleDestroy() {
    // Disconnect ngrok tunnel if we started it
    if (this.isNgrokStartedByUs && this.ngrokListener) {
      this.logger.log('Disconnecting ngrok tunnel...');
      try {
        await this.ngrokListener.close();
        this.ngrokListener = null;
        this.ngrokUrl = null;
        this.isNgrokStartedByUs = false;
        this.logger.log('Ngrok tunnel disconnected');
      } catch (error) {
        this.logger.warn(
          `Error disconnecting ngrok: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Get ngrok public URL
   */
  async getNgrokUrl(): Promise<string | null> {
    // If we started ngrok, return the stored URL
    if (this.ngrokUrl) {
      return this.ngrokUrl;
    }

    // Try to get URL from ngrok listener (if started externally)
    // Note: The new SDK doesn't have a global getUrl() method
    // We can only get URL from the listener instance we created
    return null;
  }

  /**
   * Check if ngrok is running
   */
  async isNgrokRunning(): Promise<boolean> {
    // Check if we have an active listener
    return this.ngrokListener !== null && this.ngrokUrl !== null;
  }

  /**
   * Wait for ngrok to be available (with retries)
   */
  async waitForNgrok(maxRetries = 10, delayMs = 1000): Promise<string | null> {
    for (let i = 0; i < maxRetries; i++) {
      const url = await this.getNgrokUrl();
      if (url) {
        return url;
      }

      if (i < maxRetries - 1) {
        this.logger.debug(
          `Waiting for ngrok... (${i + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return null;
  }

  /**
   * Start ngrok tunnel if not already running
   */
  async startNgrok(): Promise<string | null> {
    // Check if ngrok is already running
    const isRunning = await this.isNgrokRunning();
    if (isRunning) {
      this.logger.log('Ngrok is already running');
      return this.ngrokUrl;
    }

    // Check if we already started it
    if (this.isNgrokStartedByUs && this.ngrokUrl) {
      this.logger.log('Ngrok tunnel already started by us');
      return this.ngrokUrl;
    }

    this.logger.log(`Starting ngrok tunnel for port ${this.appPort}...`);

    try {
      // Forward port using new SDK
      // authtoken_from_env: true will automatically read from NGROK_AUTHTOKEN env var
      // Or we can pass it explicitly via authtoken if NGROK_AUTH_TOKEN is set
      const authToken = this.configService.get<string>('NGROK_AUTH_TOKEN');
      
      const listener = await ngrok.forward({
        addr: this.appPort,
        authtoken_from_env: true, // Read from NGROK_AUTHTOKEN env var
        ...(authToken && { authtoken: authToken }), // Override with config if available
      });

      if (listener && listener.url()) {
        this.ngrokListener = listener;
        this.ngrokUrl = listener.url();
        this.isNgrokStartedByUs = true;
        this.logger.log(`✅ Ngrok tunnel started successfully: ${this.ngrokUrl}`);
        return this.ngrokUrl;
      } else {
        this.logger.error('Ngrok tunnel started but URL is null');
        return null;
      }
    } catch (error) {
      this.logger.error(
        `Failed to start ngrok tunnel: ${error instanceof Error ? error.message : String(error)}`,
      );
      
      // Provide helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('authtoken') || error.message.includes('authentication') || error.message.includes('NGROK_AUTHTOKEN')) {
          this.logger.error('Ngrok authentication token not set.');
          this.logger.error('Set NGROK_AUTH_TOKEN in your .env file or set NGROK_AUTHTOKEN environment variable');
          this.logger.error('Get your token from: https://dashboard.ngrok.com/get-started/your-authtoken');
        } else if (error.message.includes('EADDRINUSE')) {
          this.logger.error(`Port ${this.appPort} is already in use or ngrok is already running`);
        } else {
          this.logger.error('Make sure ngrok is properly installed and configured');
        }
      }
      
      return null;
    }
  }

  /**
   * Get ngrok URL, starting ngrok if not running
   */
  async getOrStartNgrok(): Promise<string | null> {
    // First check if ngrok is already running
    const existingUrl = await this.getNgrokUrl();
    if (existingUrl) {
      return existingUrl;
    }

    // If not running, try to start it
    this.logger.log('Ngrok not detected, attempting to start it automatically...');
    return await this.startNgrok();
  }
}

