# Onboarding Implementation Guide

## Overview

The onboarding system handles new user registration across multiple platforms (Telegram, WhatsApp, Web Chat). It uses a stateful workflow that guides users through email collection, email verification, phone collection, and user creation.

## Architecture

### Components

1. **OnboardingStateService** - Manages onboarding state across multiple messages
2. **UserCheckNode** - Checks if user exists, routes to onboarding if not
3. **OnboardingNode** - Handles the entire onboarding flow
4. **EmailVerificationService** - Sends and verifies email codes

### Flow

```
Message Arrives
    ↓
UserCheckNode
    ├─ User exists → Continue to normal workflow
    └─ User doesn't exist → Start onboarding
            ↓
    OnboardingStateService.startOnboarding()
            ↓
    OnboardingNode (handles all steps)
            ├─ Step 1: Collect Email
            ├─ Step 2: Verify Email (send code, wait for code)
            ├─ Step 3: Collect Phone
            └─ Step 4: Create User & Platform Entry
```

## State Management

Onboarding state is stored in `OnboardingStateService` (in-memory, can be moved to database):

```typescript
interface OnboardingState {
  platform: Platform;
  platformIdentifier: string;
  step: 'email' | 'verify_email' | 'phone' | 'create_user';
  email?: string;
  codeSent?: boolean;
  verified?: boolean;
  phoneNumber?: string;
  startedAt: Date;
  lastActivityAt: Date;
}
```

## Workflow Definition

The onboarding workflow is defined in `WorkflowModule`:

```typescript
// Check user → Onboarding → Normal flow
builder
  .addNode({ id: 'user-check', type: 'user-check', ... })
  .addNode({ id: 'onboarding', type: 'onboarding', ... })
  .addNode({ id: 'echo-processor', type: 'echo-processor', ... })
  .addNode({ id: 'telegram-output', type: 'telegram-output', ... })
  
  .connect('user-check', 'onboarding', 'onboarding')
  .connect('user-check', 'echo-processor', 'exists')
  .connect('onboarding', 'echo-processor', 'completed')
  .connect('echo-processor', 'telegram-output')
  
  .setStartNode('user-check');
```

## Implementation Status

- ✅ OnboardingStateService - State management
- ✅ EmailVerificationService - Email verification
- 🔄 UserCheckNode - Needs BaseNode pattern fix
- 🔄 OnboardingNode - Needs implementation
- ⏳ Workflow integration - Pending

## Next Steps

1. Fix all nodes to follow BaseNode pattern
2. Create unified OnboardingNode
3. Register factories in WorkflowModule
4. Create onboarding workflow
5. Test end-to-end flow

