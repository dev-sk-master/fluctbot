import { Injectable, Logger } from '@nestjs/common';
import { Platform } from '../../users/entities/user-platform.entity';

export interface OnboardingState {
  platform: Platform;
  platformIdentifier: string;
  step: 'email' | 'verify_email' | 'phone' | 'create_user';
  email?: string;
  codeSent?: boolean;
  verified?: boolean; // Email verified flag
  phoneNumber?: string;
  welcomeSent?: boolean;
  startedAt: Date;
  lastActivityAt: Date;
}

@Injectable()
export class OnboardingStateService {
  private readonly logger = new Logger(OnboardingStateService.name);
  private readonly states = new Map<string, OnboardingState>();

  /**
   * Get onboarding state for a platform identifier
   */
  getState(
    platform: Platform,
    platformIdentifier: string,
  ): OnboardingState | null {
    const key = this.getKey(platform, platformIdentifier);
    return this.states.get(key) || null;
  }

  /**
   * Start onboarding for a user
   */
  startOnboarding(
    platform: Platform,
    platformIdentifier: string,
  ): OnboardingState {
    const key = this.getKey(platform, platformIdentifier);
    const now = new Date();

    const state: OnboardingState = {
      platform,
      platformIdentifier,
      step: 'email',
      startedAt: now,
      lastActivityAt: now,
    };

    this.states.set(key, state);
    this.logger.debug(
      `Started onboarding for ${platform}:${platformIdentifier}`,
    );

    return state;
  }

  /**
   * Update onboarding state
   */
  updateState(
    platform: Platform,
    platformIdentifier: string,
    updates: Partial<OnboardingState>,
  ): OnboardingState | null {
    const key = this.getKey(platform, platformIdentifier);
    const state = this.states.get(key);

    if (!state) {
      return null;
    }

    const updated: OnboardingState = {
      ...state,
      ...updates,
      lastActivityAt: new Date(),
    };

    this.states.set(key, updated);
    return updated;
  }

  /**
   * Complete onboarding (remove state)
   */
  completeOnboarding(
    platform: Platform,
    platformIdentifier: string,
  ): void {
    const key = this.getKey(platform, platformIdentifier);
    this.states.delete(key);
    this.logger.debug(
      `Completed onboarding for ${platform}:${platformIdentifier}`,
    );
  }

  /**
   * Check if user is in onboarding
   */
  isInOnboarding(
    platform: Platform,
    platformIdentifier: string,
  ): boolean {
    return this.getState(platform, platformIdentifier) !== null;
  }

  /**
   * Clean up old onboarding states (older than 1 hour)
   */
  cleanupOldStates(): void {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    for (const [key, state] of this.states.entries()) {
      if (state.lastActivityAt < oneHourAgo) {
        this.states.delete(key);
        this.logger.debug(`Cleaned up stale onboarding state: ${key}`);
      }
    }
  }

  private getKey(platform: Platform, platformIdentifier: string): string {
    return `${platform}:${platformIdentifier}`;
  }
}

