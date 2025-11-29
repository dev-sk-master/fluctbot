# FluctBot - Complete Workflow Diagram

This document provides a comprehensive visual representation of the FluctBot workflow system, showing all nodes, connections, and decision points.

## Main Workflow Architecture

```mermaid
graph TB
    %% Message Sources
    Telegram[Telegram Bot API<br/>Webhook/Polling]
    WebChat[Web Chat API<br/>HTTP Endpoint]
    
    %% Entry Point
    UnifiedInput[Unified Input Node<br/>Routes by source]
    
    %% Platform-Specific Input Nodes
    TelegramInput[Telegram Input Node<br/>Normalizes Telegram messages]
    WebChatInput[Web Chat Input Node<br/>Normalizes Web Chat messages]
    
    %% Access Control
    AccessControl[Access Control Node<br/>Checks: User exists?<br/>Email set? Email verified?<br/>Phone set?]
    
    %% Decision: User Status
    UserCheck{User Status}
    
    %% Onboarding Flow
    Onboarding[Onboarding Node<br/>Stateful multi-step process]
    
    %% Onboarding Sub-steps
    EmailStep[Email Step<br/>Collect email]
    VerifyEmailStep[Verify Email Step<br/>Send code & verify]
    PhoneStep[Phone Step<br/>Collect phone]
    CreateUserStep[Create/Update User<br/>Link platform]
    
    %% Processor
    EchoProcessor[Echo Processor Node<br/>Processes message]
    
    %% Output Routing
    UnifiedOutput[Unified Output Node<br/>Routes by source]
    
    %% Platform-Specific Output Nodes
    TelegramOutput[Telegram Output Node<br/>Sends to Telegram]
    WebChatOutput[Web Chat Output Node<br/>Sends to Web Chat]
    
    %% Flow Connections
    Telegram -->|Message| UnifiedInput
    WebChat -->|Message| UnifiedInput
    
    UnifiedInput -->|action: telegram_input| TelegramInput
    UnifiedInput -->|action: web_chat_input| WebChatInput
    
    TelegramInput --> AccessControl
    WebChatInput --> AccessControl
    
    AccessControl -->|action: onboarding<br/>Missing: user/email/phone/verification| Onboarding
    AccessControl -->|action: exists<br/>All checks pass| EchoProcessor
    
    %% Onboarding Internal Flow
    Onboarding -->|step: email| EmailStep
    Onboarding -->|step: verify_email| VerifyEmailStep
    Onboarding -->|step: phone| PhoneStep
    Onboarding -->|step: create_user| CreateUserStep
    
    EmailStep -->|email collected| VerifyEmailStep
    VerifyEmailStep -->|code verified| PhoneStep
    VerifyEmailStep -->|phone exists| CreateUserStep
    PhoneStep -->|phone collected| CreateUserStep
    
    %% Onboarding Output
    Onboarding -->|action: send_response<br/>Prompts/messages| UnifiedOutput
    Onboarding -->|action: completed<br/>User created| UnifiedOutput
    
    %% Processor Output
    EchoProcessor --> UnifiedOutput
    
    %% Output Routing
    UnifiedOutput -->|action: telegram_output| TelegramOutput
    UnifiedOutput -->|action: web_chat_output| WebChatOutput
    
    %% Styling
    classDef sourceNode fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef inputNode fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef controlNode fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef onboardingNode fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef processorNode fill:#fce4ec,stroke:#880e4f,stroke-width:2px
    classDef outputNode fill:#e0f2f1,stroke:#004d40,stroke-width:2px
    
    class Telegram,WebChat sourceNode
    class UnifiedInput,TelegramInput,WebChatInput inputNode
    class AccessControl controlNode
    class Onboarding,EmailStep,VerifyEmailStep,PhoneStep,CreateUserStep onboardingNode
    class EchoProcessor processorNode
    class UnifiedOutput,TelegramOutput,WebChatOutput outputNode
```

## Detailed Onboarding Flow

```mermaid
stateDiagram-v2
    [*] --> AccessControl: Message arrives
    
    AccessControl --> CheckUser: Evaluate user
    
    CheckUser --> Onboarding: User missing OR<br/>Email missing OR<br/>Email not verified OR<br/>Phone missing
    
    CheckUser --> EchoProcessor: All checks pass
    
    state Onboarding {
        [*] --> DetermineStep: Initialize
        
        DetermineStep --> EmailStep: No email
        DetermineStep --> VerifyEmailStep: Email exists<br/>but not verified
        DetermineStep --> PhoneStep: Email verified<br/>but no phone
        DetermineStep --> CreateUser: All fields present
        
        EmailStep --> WelcomeSent: First time
        WelcomeSent --> EmailCollected: User provides email
        EmailCollected --> VerifyEmailStep: Email validated
        
        VerifyEmailStep --> CodeSent: Send verification code
        CodeSent --> CodeVerified: User enters code
        CodeVerified --> CheckPhone: Email verified
        
        CheckPhone --> PhoneStep: Phone missing
        CheckPhone --> CreateUser: Phone exists
        
        PhoneStep --> PhoneCollected: User provides phone
        PhoneCollected --> CreateUser: Phone validated
        
        CreateUser --> UserCreated: User created/updated<br/>Platform linked
    }
    
    Onboarding --> UnifiedOutput: send_response<br/>(prompts/messages)
    Onboarding --> UnifiedOutput: completed<br/>(user created)
    
    EchoProcessor --> UnifiedOutput: Processed message
    
    UnifiedOutput --> TelegramOutput: telegram_output
    UnifiedOutput --> WebChatOutput: web_chat_output
    
    TelegramOutput --> [*]
    WebChatOutput --> [*]
```

## Access Control Decision Tree

```mermaid
graph TD
    Start[Access Control Node] --> CheckUser{User exists?}
    
    CheckUser -->|No| RouteOnboarding1[Route to Onboarding<br/>action: onboarding]
    
    CheckUser -->|Yes| CheckEmail{Email exists?}
    
    CheckEmail -->|No| RouteOnboarding2[Route to Onboarding<br/>action: onboarding]
    
    CheckEmail -->|Yes| CheckEmailVerified{Email verified?}
    
    CheckEmailVerified -->|No| RouteOnboarding3[Route to Onboarding<br/>action: onboarding]
    
    CheckEmailVerified -->|Yes| CheckPhone{Phone exists?}
    
    CheckPhone -->|No| RouteOnboarding4[Route to Onboarding<br/>action: onboarding]
    
    CheckPhone -->|Yes| RouteProcessor[Route to Echo Processor<br/>action: exists]
    
    RouteOnboarding1 --> End1[Onboarding Node]
    RouteOnboarding2 --> End1
    RouteOnboarding3 --> End1
    RouteOnboarding4 --> End1
    RouteProcessor --> End2[Echo Processor Node]
    
    style CheckUser fill:#ffeb3b
    style CheckEmail fill:#ffeb3b
    style CheckEmailVerified fill:#ffeb3b
    style CheckPhone fill:#ffeb3b
    style RouteOnboarding1 fill:#ffcdd2
    style RouteOnboarding2 fill:#ffcdd2
    style RouteOnboarding3 fill:#ffcdd2
    style RouteOnboarding4 fill:#ffcdd2
    style RouteProcessor fill:#c8e6c9
```

## Onboarding Step Determination Logic

```mermaid
graph LR
    Start[Onboarding Initialization] --> HasEmail{Has Email?}
    
    HasEmail -->|No| StepEmail[Start: email<br/>Collect email]
    
    HasEmail -->|Yes| IsVerified{Email Verified?}
    
    IsVerified -->|No| StepVerify[Start: verify_email<br/>Use existing email<br/>Send code]
    
    IsVerified -->|Yes| HasPhone{Has Phone?}
    
    HasPhone -->|No| StepPhone[Start: phone<br/>Collect phone]
    
    HasPhone -->|Yes| StepCreate[Start: create_user<br/>All fields present]
    
    StepEmail --> Flow[Onboarding Flow]
    StepVerify --> Flow
    StepPhone --> Flow
    StepCreate --> Flow
    
    style HasEmail fill:#e3f2fd
    style IsVerified fill:#e3f2fd
    style HasPhone fill:#e3f2fd
    style StepEmail fill:#fff3e0
    style StepVerify fill:#fff3e0
    style StepPhone fill:#fff3e0
    style StepCreate fill:#e8f5e9
```

## Message Flow Sequence

```mermaid
sequenceDiagram
    participant User
    participant Source as Telegram/WebChat
    participant UnifiedInput
    participant PlatformInput as TelegramInput/WebChatInput
    participant AccessControl
    participant Onboarding
    participant EchoProcessor
    participant UnifiedOutput
    participant PlatformOutput as TelegramOutput/WebChatOutput
    
    User->>Source: Sends message
    Source->>UnifiedInput: FluctMessage
    UnifiedInput->>PlatformInput: Route by source
    PlatformInput->>AccessControl: Normalized message
    
    alt User missing or incomplete
        AccessControl->>Onboarding: action: onboarding
        Onboarding->>Onboarding: Collect missing fields
        Onboarding->>UnifiedOutput: action: send_response/completed
    else User complete
        AccessControl->>EchoProcessor: action: exists
        EchoProcessor->>UnifiedOutput: Processed content
    end
    
    UnifiedOutput->>PlatformOutput: Route by source
    PlatformOutput->>Source: Send response
    Source->>User: Display message
```

## Node Types and Responsibilities

### Input Nodes
- **Unified Input Node**: Routes messages to platform-specific input nodes based on source
- **Telegram Input Node**: Converts Telegram messages to FluctMessage format
- **Web Chat Input Node**: Converts Web Chat messages to FluctMessage format

### Control Nodes
- **Access Control Node**: Validates user existence and required fields (email, email verification, phone)

### Processor Nodes
- **Onboarding Node**: Stateful multi-step process for user registration/update
  - Email collection
  - Email verification (code-based)
  - Phone collection
  - User creation/update
- **Echo Processor Node**: Simple message echo for existing users

### Output Nodes
- **Unified Output Node**: Routes responses to platform-specific output nodes
- **Telegram Output Node**: Sends messages back to Telegram
- **Web Chat Output Node**: Sends messages back to Web Chat

## Key Features

1. **Multi-Source Support**: Handles messages from Telegram and Web Chat (extensible to WhatsApp)
2. **Smart Routing**: Automatically routes based on message source
3. **Access Control**: Validates user completeness before processing
4. **Intelligent Onboarding**: Only collects missing fields, skips completed steps
5. **Stateful Onboarding**: Maintains state across multiple user interactions
6. **Extensible Architecture**: Easy to add new nodes, processors, and sources

## Workflow Execution Pattern

All nodes follow the `prep -> exec -> post` pattern:

1. **prep()**: Prepare data from shared context
2. **exec()**: Execute node logic, return action
3. **post()**: Post-process, update shared context, return routing action

The workflow engine orchestrates node execution based on connections and returned actions.

