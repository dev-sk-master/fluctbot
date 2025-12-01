import { Injectable, Logger } from '@nestjs/common';
import { BaseNode } from '../../core/base-node';
import {
  NodeExecutionContext,
  NodeExecutionResult,
} from '../../types/workflow.types';
import { FluctMessage, MessageType } from '../../types/message.types';
import { WorkflowNodeContext } from '../../services/workflow-node-context';
import { Platform } from '../../../users/entities/user-platform.entity';

export interface OnboardingConfig {
  promptEmailMessage?: string;
  invalidEmailMessage?: string;
  codeSentMessage?: string;
  invalidCodeMessage?: string;
  verifiedMessage?: string;
  promptPhoneMessage?: string;
  invalidPhoneMessage?: string;
      welcomeMessage?: string;
      completionMessage?: string;
  codeLength?: number;
  [key: string]: unknown;
}

@Injectable()
export class OnboardingNode extends BaseNode {
  private readonly logger = new Logger(OnboardingNode.name);

  constructor(
    id: string,
    name: string,
    config: OnboardingConfig = {},
    private readonly context: WorkflowNodeContext,
  ) {
    super(id, name, 'onboarding', config);
  }

  getDefaultConfig(): OnboardingConfig {
    return {
      welcomeMessage: '👋 Welcome to FluctBot! Let\'s get you set up.',
      promptEmailMessage: 'To get started, please provide your email address:',
      invalidEmailMessage:
        'Invalid email format. Please provide a valid email address:',
      codeSentMessage:
        'A verification code has been sent to your email. Please enter the 6-digit code:',
      invalidCodeMessage:
        'Invalid or expired code. Please enter the correct verification code:',
      verifiedMessage: 'Email verified successfully!',
      promptPhoneMessage: 'Please provide your phone number (e.g., +1234567890):',
      invalidPhoneMessage:
        'Invalid phone number format. Please provide a valid phone number (e.g., +1234567890):',
      completionMessage:
        '🎉 Your account has been created successfully! You can now use all features.',
      codeLength: 6,
    };
  }

  protected async prep(
    context: NodeExecutionContext,
  ): Promise<{ message: FluctMessage; state: any; onboardingUser: any }> {
    //this.logger.debug(`[prep] Context:\n${JSON.stringify(context, null, 2)}`);
    // Get message from sharedData (set by input nodes)
    const message = context.sharedData.message as FluctMessage;
    const metadata = message.metadata;

    // Get or create onboarding state
    const platform = this.mapMessageSourceToPlatform(metadata.platform);
    const platformIdentifier = metadata.userId;

    if (!platform || !platformIdentifier) {
      throw new Error('Invalid platform or user identifier');
    }

    // Check if user already exists
    let onboardingUser = await this.context.services.usersService.findByPlatform(
      platform,
      platformIdentifier,
    );

    // Check if onboarding already started
    let state = this.context.services.onboardingStateService.getState(
      platform,
      platformIdentifier,
    );

    // If no state, initialize onboarding based on what's missing
    if (!state) {
      state = this.context.services.onboardingStateService.startOnboarding(
        platform,
        platformIdentifier,
      );

      // Determine what fields are missing and set initial step
      const hasEmail = onboardingUser?.email && onboardingUser.email.trim().length > 0;
      const isEmailVerified = onboardingUser?.emailVerified === true;
      const hasPhone = onboardingUser?.phoneNumber && onboardingUser.phoneNumber.trim().length > 0;

      // Populate state with existing data
      if (onboardingUser) {
        if (hasEmail) {
          state.email = onboardingUser.email;
          if (isEmailVerified) {
            state.verified = true;
          }
        }
        if (hasPhone) {
          state.phoneNumber = onboardingUser.phoneNumber;
        }
      }

      // Determine initial step based on what's missing
      let initialStep: 'email' | 'verify_email' | 'phone' | 'create_user';
      
      if (!hasEmail) {
        // No email at all - start at email collection
        initialStep = 'email';
      } else if (!isEmailVerified) {
        // Email exists but not verified - start at verification
        initialStep = 'verify_email';
      } else if (!hasPhone) {
        // Email verified but no phone - start at phone collection
        initialStep = 'phone';
      } else {
        // All fields present and verified - should not reach here (access control should prevent)
        initialStep = 'create_user';
      }

      // Set the initial step
      state.step = initialStep;

      this.logger.debug(
        `Started onboarding for ${platform}:${platformIdentifier}, initial step: ${initialStep}, existing user: ${onboardingUser ? onboardingUser.id : 'none'}, hasEmail: ${hasEmail}, isEmailVerified: ${isEmailVerified}, hasPhone: ${hasPhone}`,
      );
    }

    return { message, state, onboardingUser: onboardingUser || null };
  }

  protected async exec(
    prepResult: unknown,
    context: NodeExecutionContext,
  ): Promise<{ action: string; response?: string; user?: any }> {
    //this.logger.debug(`[exec] Context:\n${JSON.stringify(context, null, 2)}`);
    //this.logger.debug(`[exec] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    const { message, state, onboardingUser } = prepResult as {
      message: FluctMessage;
      state: any;
      onboardingUser: any;
    };
    const config = this.config as OnboardingConfig;
    const defaultConfig = this.getDefaultConfig();
    const platform = state.platform;
    const platformIdentifier = state.platformIdentifier;

    // Store existing user in context for use in handlers
    //context.sharedData['onboardingUser'] = onboardingUser;

    // Route based on current step
    switch (state.step) {
      case 'email':
        return await this.handleEmailStep(
          message,
          state,
          platform,
          platformIdentifier,
          config,
          onboardingUser,
        );

      case 'verify_email':
        return await this.handleVerifyEmailStep(
          message,
          state,
          platform,
          platformIdentifier,
          config,
          onboardingUser,
        );

      case 'phone':
        return await this.handlePhoneStep(
          message,
          state,
          platform,
          platformIdentifier,
          config,
          onboardingUser,
        );

      case 'create_user':
        return await this.handleCreateUserStep(
          state,
          platform,
          platformIdentifier,
          config,
          onboardingUser,
        );

      default:
        throw new Error(`Unknown onboarding step: ${state.step}`);
    }
  }

  protected async post(
    context: NodeExecutionContext,
    prepResult: unknown,
    execResult: unknown,
  ): Promise<string | undefined> {
    //this.logger.debug(`[post] Context:\n${JSON.stringify(context, null, 2)}`);
    //this.logger.debug(`[post] PrepResult:\n${JSON.stringify(prepResult, null, 2)}`);
    //this.logger.debug(`[post] ExecResult:\n${JSON.stringify(execResult, null, 2)}`);
    const result = execResult as { action: string; response?: string; user?: any };
    const message = context.sharedData.message as FluctMessage;

    // Store response message if provided
    if (result.response) {
      context.sharedData['response'] = {
        type: 'text',
        text: result.response,
      };
    }

    // If user created, store user data
    // Note: User message saving is handled by Access Control node after onboarding completes
    if (result.user) {
      context.sharedData['user'] = result.user;
      
      // Clear onboarding state
      const { state } = prepResult as { state: any };
      this.context.services.onboardingStateService.completeOnboarding(
        state.platform,
        state.platformIdentifier,
      );
      return 'completed'; // Onboarding complete, continue to normal flow
    }

    // If there's a response to send, route to output node
    // Otherwise, stay in onboarding (waiting for user input)
    if (result.response) {
      return 'send_response'; // Route to output node to send the message
    }

    // Return action for routing (or undefined for 'default')
    return result.action || undefined;
  }

  private async handleEmailStep(
    message: FluctMessage,
    state: any,
    platform: Platform,
    platformIdentifier: string,
    config: OnboardingConfig,
    onboardingUser: any,
  ): Promise<{ action: string; response?: string }> {
    const defaultConfig = this.getDefaultConfig();
    
    // If user exists and has verified email, skip email collection
    if (onboardingUser?.email && onboardingUser?.emailVerified) {
      this.logger.debug(
        `User ${onboardingUser.id} already has verified email, skipping to phone collection`,
      );
      // Move directly to phone collection
      this.context.services.onboardingStateService.updateState(platform, platformIdentifier, {
        email: onboardingUser.email,
        verified: true,
        step: 'phone',
      });
      const phonePrompt =
        config.promptPhoneMessage || defaultConfig.promptPhoneMessage;
      return {
        action: 'collect_phone',
        response: phonePrompt,
      };
    }

    // Check if email already collected in state
    if (state.email && state.emailVerified) {
      // Email already verified, move to phone
      this.context.services.onboardingStateService.updateState(platform, platformIdentifier, {
        step: 'phone',
      });
      const phonePrompt =
        config.promptPhoneMessage || defaultConfig.promptPhoneMessage;
      return {
        action: 'collect_phone',
        response: phonePrompt,
      };
    }

    if (state.email && !state.emailVerified) {
      // Email collected but not verified, move to verification
      this.context.services.onboardingStateService.updateState(platform, platformIdentifier, {
        step: 'verify_email',
      });
      return { action: 'verify_email' };
    }

    // If existing user has email but not verified, move to verification
    if (onboardingUser?.email && !onboardingUser?.emailVerified && !state.email) {
      // Populate state with existing email and move to verification
      this.context.services.onboardingStateService.updateState(platform, platformIdentifier, {
        email: onboardingUser.email,
        step: 'verify_email',
      });
      return { action: 'verify_email' };
    }

    // Check if welcome message was already sent
    if (!state.welcomeSent) {
      // First time - send welcome message + email prompt
      const welcomeMsg = config.welcomeMessage || defaultConfig.welcomeMessage;
      const emailPrompt = config.promptEmailMessage || defaultConfig.promptEmailMessage;
      const combinedMessage = `${welcomeMsg}\n\n${emailPrompt}`;
      
      this.context.services.onboardingStateService.updateState(platform, platformIdentifier, {
        welcomeSent: true,
      });
      
      return {
        action: 'prompt_email',
        response: combinedMessage,
      };
    }

    // Welcome already sent - check if this message contains email
    if (message.content.type === MessageType.TEXT && message.content.text) {
      const email = message.content.text.trim();

      if (this.isValidEmail(email)) {
        // Store email, send verification code, and move to verification step
        await this.context.services.emailService.sendVerificationCode(email);

        this.context.services.onboardingStateService.updateState(platform, platformIdentifier, {
          email,
          codeSent: true,
          step: 'verify_email',
        });

        this.logger.debug(`Email collected: ${email}`);

        // Inform the user that a code has been sent
        return {
          action: 'verify_email',
          response:
            config.codeSentMessage || defaultConfig.codeSentMessage ||
            'A verification code has been sent to your email. Please enter the 6-digit code:',
        };
      } else {
        // Invalid email
        return {
          action: 'invalid_email',
          response: config.invalidEmailMessage || defaultConfig.invalidEmailMessage,
        };
      }
    }

    // No email in message - prompt for email again
    return {
      action: 'prompt_email',
      response: config.promptEmailMessage || defaultConfig.promptEmailMessage,
    };
  }

  private async handleVerifyEmailStep(
    message: FluctMessage,
    state: any,
    platform: Platform,
    platformIdentifier: string,
    config: OnboardingConfig,
    onboardingUser: any,
  ): Promise<{ action: string; response?: string }> {
    const defaultConfig = this.getDefaultConfig();

    // Check if already verified
    if (state.verified) {
      // Email already verified - check if user exists by email (ONCE)
      let linkedUser = onboardingUser;
      if (state.email) {
        const userByEmail = await this.context.services.usersService.findByEmail(state.email);
        if (userByEmail) {
          this.logger.debug(
            `✅ User found with verified email ${state.email}: ${userByEmail.id}. Linking to existing user.`,
          );
          linkedUser = userByEmail;
        }
      }

      // Check if phone is needed
      if (state.phoneNumber || linkedUser?.phoneNumber) {
        // Phone already exists, proceed to link/update user
        this.logger.debug(
          `Email verified and phone already exists, proceeding to link/update user`,
        );
        const updatedState = this.context.services.onboardingStateService.updateState(
          platform,
          platformIdentifier,
          {
            step: 'create_user',
            phoneNumber: state.phoneNumber || linkedUser?.phoneNumber,
          },
        ) || { ...state, step: 'create_user' as const, phoneNumber: state.phoneNumber || linkedUser?.phoneNumber };
        
        return await this.handleCreateUserStep(
          updatedState,
          platform,
          platformIdentifier,
          { ...defaultConfig, ...config },
          linkedUser,
        );
      } else {
        // Move to phone collection
        this.context.services.onboardingStateService.updateState(platform, platformIdentifier, {
          step: 'phone',
        });
        const phonePrompt =
          config.promptPhoneMessage || defaultConfig.promptPhoneMessage;
        return {
          action: 'collect_phone',
          response: phonePrompt,
        };
      }
    }

    // Send code if not sent yet
    if (!state.codeSent) {
      try {
        const code = await this.context.services.emailService.sendVerificationCode(
          state.email,
        );
        this.context.services.onboardingStateService.updateState(platform, platformIdentifier, {
          codeSent: true,
        });

        this.logger.debug(`Verification code sent to ${state.email}`);
        return {
          action: 'code_sent',
          response: config.codeSentMessage,
        };
      } catch (error) {
        this.logger.error(`Failed to send verification code: ${error}`);
        throw error;
      }
    }

    // Check if code is provided in message
    if (message.content.type === MessageType.TEXT && message.content.text) {
      const code = message.content.text.trim().replace(/\D/g, ''); // Extract digits

      if (code.length === (config.codeLength || 6)) {
        // Verify the code
        const isValid = await this.context.services.emailService.verifyCode(
          state.email,
          code,
        );

        if (isValid) {
          // Email verified - check if user exists with this email (ONCE)
          const userByEmail = await this.context.services.usersService.findByEmail(state.email);
          
          // Use the user found by email, or fall back to onboardingUser from platform
          const linkedUser = userByEmail || onboardingUser;
          
          if (userByEmail) {
            this.logger.debug(
              `✅ Email verified and user found with email ${state.email}: ${userByEmail.id}. Linking onboarding to existing user.`,
            );
          } else {
            this.logger.debug(`✅ Email verified: ${state.email}`);
          }

          // Update state with verified email
          this.context.services.onboardingStateService.updateState(platform, platformIdentifier, {
            verified: true,
            email: state.email,
          });

          // Check if phone is needed
          const hasPhone = state.phoneNumber || linkedUser?.phoneNumber;
          
          if (hasPhone) {
            // Phone already exists, proceed to link/update user
            this.logger.debug(
              `Phone already exists, proceeding to link/update user`,
            );
            const updatedState = this.context.services.onboardingStateService.updateState(
              platform,
              platformIdentifier,
              {
                step: 'create_user',
                phoneNumber: state.phoneNumber || linkedUser?.phoneNumber,
              },
            ) || { ...state, step: 'create_user' as const, phoneNumber: state.phoneNumber || linkedUser?.phoneNumber };
            
            return await this.handleCreateUserStep(
              updatedState,
              platform,
              platformIdentifier,
              { ...defaultConfig, ...config },
              linkedUser, // Use the user found by email if available
            );
          } else {
            // Move to phone collection
            this.context.services.onboardingStateService.updateState(platform, platformIdentifier, {
              step: 'phone',
            });

            const verifiedMessage =
              config.verifiedMessage || defaultConfig.verifiedMessage;
            const phonePrompt =
              config.promptPhoneMessage || defaultConfig.promptPhoneMessage;
            const combinedMessage = `${verifiedMessage}\n\n${phonePrompt}`;

            return {
              action: 'collect_phone',
              response: combinedMessage,
            };
          }
        } else {
          // Invalid code
          return {
            action: 'invalid_code',
            response: config.invalidCodeMessage,
          };
        }
      } else {
        // Invalid code format
        return {
          action: 'invalid_code',
          response: config.invalidCodeMessage,
        };
      }
    }

    // No code in message - waiting for code
    return { action: 'waiting_for_code' };
  }

  private async handlePhoneStep(
    message: FluctMessage,
    state: any,
    platform: Platform,
    platformIdentifier: string,
    config: OnboardingConfig,
    onboardingUser: any,
  ): Promise<{ action: string; response?: string; user?: any }> {
    const defaultConfig = this.getDefaultConfig();

    // Check if user exists by email (if email was verified) - ONCE
    let linkedUser = onboardingUser;
    if (state.email && state.verified) {
      const userByEmail = await this.context.services.usersService.findByEmail(state.email);
      if (userByEmail) {
        this.logger.debug(
          `✅ User found with verified email ${state.email}: ${userByEmail.id}. Linking to existing user.`,
        );
        linkedUser = userByEmail;
      }
    }

    // If user exists and has phone, skip phone collection and link/update user
    if (linkedUser?.phoneNumber) {
      this.logger.debug(
        `User ${linkedUser.id} already has phone (${linkedUser.phoneNumber}), proceeding to link/update user`,
      );
      // Update state with existing phone
      const updatedState = this.context.services.onboardingStateService.updateState(
        platform,
        platformIdentifier,
        {
          phoneNumber: linkedUser.phoneNumber,
          step: 'create_user',
        },
      ) || { ...state, phoneNumber: linkedUser.phoneNumber, step: 'create_user' as const };
      
      return await this.handleCreateUserStep(
        updatedState,
        platform,
        platformIdentifier,
        { ...defaultConfig, ...config },
        linkedUser, // Use the user found by email
      );
    }

    // Check if phone already collected in state
    if (state.phoneNumber) {
      // Phone already in state, immediately link/update user
      this.logger.debug(
        `Phone already present (${state.phoneNumber}), linking/updating user immediately`,
      );
      return await this.handleCreateUserStep(
        state,
        platform,
        platformIdentifier,
        { ...defaultConfig, ...config },
        linkedUser, // Use the user found by email
      );
    }

    // Check if this message contains phone
    if (message.content.type === MessageType.TEXT && message.content.text) {
      const phone = message.content.text.trim();

      if (this.isValidPhone(phone)) {
        // Store phone and immediately create user
        const updatedState =
          this.context.services.onboardingStateService.updateState(
            platform,
            platformIdentifier,
            {
              phoneNumber: phone,
              step: 'create_user',
            },
          ) || { ...state, phoneNumber: phone, step: 'create_user' as const };

        this.logger.debug(`Phone collected: ${phone}, creating user immediately`);
        
        // Immediately link/update user and return completion message
        // Check if user exists by email (if email was verified) - ONCE
        let linkedUser = onboardingUser;
        if (state.email && state.verified) {
          const userByEmail = await this.context.services.usersService.findByEmail(state.email);
          if (userByEmail) {
            this.logger.debug(
              `✅ User found with verified email ${state.email}: ${userByEmail.id}. Linking to existing user.`,
            );
            linkedUser = userByEmail;
          }
        }

        return await this.handleCreateUserStep(
          updatedState,
          platform,
          platformIdentifier,
          { ...defaultConfig, ...config },
          linkedUser, // Use the user found by email
        );
      } else {
        // Invalid phone
        return {
          action: 'invalid_phone',
          response: config.invalidPhoneMessage || defaultConfig.invalidPhoneMessage,
        };
      }
    }

    // No phone in message - prompt for phone
    return {
      action: 'prompt_phone',
      response: config.promptPhoneMessage || defaultConfig.promptPhoneMessage,
    };
  }

  private async handleCreateUserStep(
    state: any,
    platform: Platform,
    platformIdentifier: string,
    config: OnboardingConfig,
    onboardingUser: any,
  ): Promise<{ action: string; response?: string; user?: any }> {
    try {
      // Priority: Use onboardingUser if provided (found by email or platform)
      // This user should already be linked to the verified email
      let user = onboardingUser;

      // If no user provided, check by platform (fallback)
      if (!user) {
        user = await this.context.services.usersService.findByPlatform(
          platform,
          platformIdentifier,
        );
      }

      // Final fallback: check by email if verified (shouldn't happen if flow is correct)
      if (!user && state.email && state.verified) {
        user = await this.context.services.usersService.findByEmail(state.email);
        if (user) {
          this.logger.debug(
            `Found existing user by email ${state.email}: ${user.id}`,
          );
        }
      }

      if (user) {
        // User exists - update missing fields
        this.logger.debug(
          `User ${user.id} already exists, updating missing fields`,
        );

        const updateData: any = {};
        // Update email if missing or if we have a new verified email
        if (state.email && (!user.email || user.email !== state.email)) {
          updateData.email = state.email;
          updateData.emailVerified = true; // Email was verified during onboarding
        } else if (state.verified && !user.emailVerified) {
          // Email was verified during onboarding, update verification status
          updateData.emailVerified = true;
        }
        // Update phone if missing
        if (!user.phoneNumber && state.phoneNumber) {
          updateData.phoneNumber = state.phoneNumber;
        }

        if (Object.keys(updateData).length > 0) {
          user = await this.context.services.usersService.update(user.id, updateData);
          this.logger.debug(`User ${user.id} updated with missing fields`);
        }

        // Ensure platform is linked (in case it wasn't)
        try {
          await this.context.services.usersService.linkPlatform(user.id, {
            platform: platform,
            platformIdentifier: platformIdentifier,
          });
          this.logger.debug(
            `Platform linked: ${platform}:${platformIdentifier}`,
          );
        } catch (error) {
          // Platform might already be linked, ignore error
          this.logger.debug(
            `Platform ${platform}:${platformIdentifier} already linked or link failed`,
          );
        }
      } else {
        // User doesn't exist - create new user
        user = await this.context.services.usersService.create({
          email: state.email,
          phoneNumber: state.phoneNumber,
          name: 'User', // Default name, can be updated later
        });

        // Update email verified status
        await this.context.services.usersService.update(user.id, {
          emailVerified: true,
        });

        this.logger.debug(`User created: ${user.id}`);

        // Link platform
        await this.context.services.usersService.linkPlatform(user.id, {
          platform: platform,
          platformIdentifier: platformIdentifier,
        });

        this.logger.debug(
          `Platform linked: ${platform}:${platformIdentifier}`,
        );
      }

      // Send welcome email after onboarding completion
      if (user.email) {
        try {
          await this.context.services.emailService.sendWelcomeEmail(
            user.email,
            user.name,
          );
          this.logger.debug(`Welcome email sent to ${user.email}`);
        } catch (error) {
          // Log error but don't fail onboarding
          this.logger.warn(
            `Failed to send welcome email to ${user.email}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      // Create free tier subscription after onboarding completion (only if never used free trial before)
      let freePlan = null;
      let subscriptionCreated = false;
      try {
        const hasUsedFreeTrial =
          await this.context.services.subscriptionsService.hasUsedFreeTrial(user.id);

        if (hasUsedFreeTrial) {
          this.logger.debug(
            `User ${user.id} has already used their free trial, skipping subscription creation`,
          );
        } else {
          await this.context.services.subscriptionsService.createFreeTierSubscription(user.id);
          subscriptionCreated = true;
          this.logger.debug(
            `Created free tier subscription for user ${user.id} after onboarding completion (first time)`,
          );

          // Get free tier plan for completion message
          freePlan = await this.context.services.subscriptionsService.getFreeTierPlan();
        }
      } catch (error) {
        // Log error but don't fail onboarding
        this.logger.error(
          `Failed to create subscription after onboarding: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Build completion message with subscription details
      const defaultConfig = this.getDefaultConfig();
      let completionMessage =
        config.completionMessage?.replace('{name}', user.name || 'User') ||
        defaultConfig.completionMessage ||
        `Welcome ${user.name || 'User'}! Your account has been created successfully.`;

      // Add subscription details if subscription was created
      if (subscriptionCreated && freePlan) {
        const periodText =
          freePlan.creditPeriodValue === 1
            ? freePlan.creditPeriodUnit
            : `${freePlan.creditPeriodValue} ${freePlan.creditPeriodUnit}s`;
        completionMessage += `\n\n✨ You now have access to our free tier with:\n• ${freePlan.creditLimit} credits per ${periodText}\n• ${freePlan.durationDays}-day trial period\n• Full access to all features\n\nStart chatting to explore what I can help you with!`;
      }

      // Return user data and completion message
      return {
        action: 'completed',
        response: completionMessage,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phoneNumber: user.phoneNumber,
          emailVerified: user.emailVerified,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to create/update user: ${error}`);
      throw error;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    return phoneRegex.test(cleaned) && cleaned.length >= 10;
  }

  private mapMessageSourceToPlatform(source: string): Platform | null {
    switch (source) {
      case 'telegram':
        return Platform.TELEGRAM;
      case 'whatsapp':
        return Platform.WHATSAPP;
      case 'web_chat':
        return Platform.WEB;
      default:
        return null;
    }
  }

  validateConfig(): boolean {
    return true;
  }
}

