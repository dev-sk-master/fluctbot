import { Injectable, Logger } from '@nestjs/common';
import { BaseNode } from '../../core/base-node';
import {
  NodeExecutionContext,
  NodeExecutionResult,
} from '../../types/workflow.types';
import { FluctMessage, MessageSource } from '../../types/message.types';
import { UsersService } from '../../../users/users.service';
import { Platform } from '../../../users/entities/user-platform.entity';

export interface AccessControlConfig {
  [key: string]: unknown;
}

@Injectable()
export class AccessControlNode extends BaseNode {
  private readonly logger = new Logger(AccessControlNode.name);

  constructor(
    id: string,
    name: string,
    config: AccessControlConfig = {},
    private readonly usersService: UsersService,
  ) {
    super(id, name, 'access-control', config);
  }

  protected async prep(
    context: NodeExecutionContext,
  ): Promise<{ message: FluctMessage; platform: Platform | null; platformIdentifier: string | null }> {
    this.logger.debug(`[prep] Context:\n${JSON.stringify(context, null, 2)}`);
    const message = context.message as FluctMessage;
    const metadata = message.metadata;

    // Extract platform information from message source
    const platform = this.mapMessageSourceToPlatform(metadata.source);
    const platformIdentifier = metadata.userId;

    return { message, platform, platformIdentifier };
  }

  protected async exec(
    prepResult: unknown,
    context: NodeExecutionContext,
  ): Promise<{ action: string; user?: any }> {
    this.logger.debug(`[exec] Context:\n${JSON.stringify(context, null, 2)}`);
    this.logger.debug(`[exec] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    const { platform, platformIdentifier } = prepResult as {
      platform: Platform | null;
      platformIdentifier: string | null;
    };

    if (!platform || !platformIdentifier) {
      this.logger.warn(
        `Invalid platform or identifier: ${platform}, ${platformIdentifier}`,
      );
      throw new Error('Invalid platform or user identifier');
    }

    // Check if user exists
    const user = await this.usersService.findByPlatform(
      platform,
      platformIdentifier,
    );

    if (!user) {
      // User doesn't exist - route to onboarding
      this.logger.debug(
        `User not found for platform ${platform}:${platformIdentifier}, routing to onboarding`,
      );
      return {
        action: 'onboarding', // Route to onboarding workflow
      };
    }

    // User exists - check if email and phone are set
    const hasEmail = user.email && user.email.trim().length > 0;
    const isEmailVerified = user.emailVerified;
    const hasPhone = user.phoneNumber && user.phoneNumber.trim().length > 0;

    if (!hasEmail || !isEmailVerified || !hasPhone) {
      // User exists but missing email, email verification, or phone - route to onboarding
      this.logger.debug(
        `User ${user.id} found but missing required fields (email: ${hasEmail}, emailVerified: ${isEmailVerified}, phone: ${hasPhone}), routing to onboarding`,
      );
      return {
        action: 'onboarding', // Route to onboarding workflow
      };
    }

    // User exists and has both email and phone - store in shared data and continue
    context.sharedData['user'] = {
      id: user.id,
      email: user.email,
      name: user.name,
      phoneNumber: user.phoneNumber,
      emailVerified: user.emailVerified,
    };
    context.sharedData['platform'] = platform;
    context.sharedData['platformIdentifier'] = platformIdentifier;

    this.logger.debug(
      `User ${user.id} found with complete profile (email: ${hasEmail}, phone: ${hasPhone}) for platform ${platform}:${platformIdentifier}`,
    );

    return {
      action: 'exists', // Route to normal workflow
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phoneNumber: user.phoneNumber,
        emailVerified: user.emailVerified,
      },
    };
  }

  protected async post(
    context: NodeExecutionContext,
    prepResult: unknown,
    execResult: unknown,
  ): Promise<string | undefined> {
    this.logger.debug(`[post] Context:\n${JSON.stringify(context, null, 2)}`);
    this.logger.debug(`[post] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    this.logger.debug(`[post] ExecResult:\n${JSON.stringify(execResult, null, 2)}`);
    const result = execResult as { action: string };
    // Return the action for routing
    return result.action;
  }

  private mapMessageSourceToPlatform(
    source: MessageSource,
  ): Platform | null {
    switch (source) {
      case MessageSource.TELEGRAM:
        return Platform.TELEGRAM;
      case MessageSource.WHATSAPP:
        return Platform.WHATSAPP;
      case MessageSource.WEB_CHAT:
        return Platform.WEB;
      default:
        return null;
    }
  }
}

