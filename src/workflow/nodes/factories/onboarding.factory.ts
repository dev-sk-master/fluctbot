import { Injectable } from '@nestjs/common';
import { NodeFactory } from '../../core/node-registry';
import { OnboardingNode, OnboardingConfig } from '../processor/onboarding.node';
import { BaseNode } from '../../core/base-node';
import { WorkflowNodeContextProvider } from '../../services/workflow-node-context.provider';

@Injectable()
export class OnboardingNodeFactory implements NodeFactory {
  private readonly context: ReturnType<WorkflowNodeContextProvider['createContext']>;

  constructor(
    private readonly contextProvider: WorkflowNodeContextProvider,
  ) {
    this.context = this.contextProvider.createContext();
  }

  getType(): string {
    return 'onboarding';
  }

  getDescription(): string {
    return 'Handles complete user onboarding flow: email collection, verification, phone collection, and user creation';
  }

  getDefaultConfig(): Record<string, unknown> {
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

  createInstance(
    id: string,
    name: string,
    config: Record<string, unknown>,
  ): BaseNode {
    return new OnboardingNode(
      id,
      name,
      config as OnboardingConfig,
      this.context,
    );
  }
}

