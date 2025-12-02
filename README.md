# FluctBot - Maritime AI Assistant Platform

A production-grade NestJS application providing an intelligent maritime assistant bot with multi-platform support (Telegram, Web Chat), AI-powered conversations, subscription management, and a flexible workflow system inspired by n8n.

## 🚀 Features

### Core Capabilities

- **🤖 AI-Powered Assistant** - Universal agent system supporting multiple AI frameworks (DeepAgents, LangChain) with OpenRouter integration
- **📱 Multi-Platform Support** - Unified message processing for Telegram, Web Chat, and WhatsApp (planned)
- **🔄 Workflow Engine** - Node-based workflow system for flexible message processing and routing
- **💳 Subscription Management** - Complete Stripe integration with subscription plans, billing, and payment handling
- **👤 User Management** - Comprehensive user onboarding, platform linking, and profile management
- **💬 Conversation Management** - Persistent conversation history with thread-based continuity
- **🛠️ Maritime Tools** - Specialized tools for vessel tracking, port search, and maritime data (Datalistic integration)
- **🔍 Web Search** - Integrated web search (Tavily), Wikipedia, and weather APIs
- **📊 Fleet Management** - User fleet and vessel tracking capabilities
- **⏰ Reminders** - LLM-powered reminder creation and management
- **📧 Email Service** - Email verification and notification system

### Technical Features

- ✅ **Production-Ready Architecture** - Modular design with best practices
- ✅ **Type-Safe** - Full TypeScript with strict type checking
- ✅ **Database Migrations** - TypeORM migrations for schema management
- ✅ **Comprehensive Logging** - Winston-based logging with daily rotation
- ✅ **Error Handling** - Global exception filters with proper error responses
- ✅ **API Documentation** - Swagger/OpenAPI integration
- ✅ **Security** - Helmet, CORS, and security best practices
- ✅ **Health Checks** - Application and database health monitoring
- ✅ **Webhook Management** - Automatic ngrok integration for local development

## 🏗️ Architecture

### Workflow System

FluctBot uses an n8n-inspired workflow system with a node-based architecture:

```
Message Input → Access Control → Onboarding/Command/AI Agent → Unified Output → Platform Output
```

**Node Types:**
- **Input Nodes**: Receive messages from platforms (Telegram, Web Chat)
- **Processor Nodes**: Process messages (Access Control, Onboarding, Commands, AI Agent)
- **Output Nodes**: Send responses back to platforms

**Key Components:**
- `WorkflowEngine`: Orchestrates node execution
- `BaseNode`: Base class for all nodes (prep → exec → post pattern)
- `WorkflowNodeContext`: Centralized dependency injection for nodes
- `NodeRegistry`: Manages node factories and creation

### Message Flow

1. **Input**: Platform receives message → converts to `FluctMessage`
2. **Routing**: `UnifiedInputNode` routes to platform-specific input node
3. **Processing**: `AccessControlNode` checks user status → routes to Onboarding/Command/AI Agent
4. **Output**: `UnifiedOutputNode` routes response to platform-specific output node
5. **Delivery**: Platform sends message to user

## 📦 Tech Stack

### Core
- **NestJS** - Progressive Node.js framework
- **TypeScript** - Type-safe development
- **TypeORM** - Database ORM
- **PostgreSQL** - Primary database

### AI & LLM
- **Universal Agent** - Multi-framework AI agent system
- **DeepAgents** - AI framework integration
- **LangChain** - LLM orchestration
- **OpenRouter** - LLM API gateway

### Integrations
- **Stripe** - Payment processing and subscription management
- **Telegram Bot API** - Telegram integration
- **Tavily** - Web search API
- **Datalistic** - Maritime data API
- **Open-Meteo** - Weather API
- **Wikipedia** - Knowledge search

### Utilities
- **Winston** - Logging
- **Nodemailer** - Email sending
- **Ngrok** - Local webhook tunneling
- **FFmpeg** - Audio processing

## 📁 Project Structure

```
src/
├── common/                    # Shared modules and utilities
│   ├── services/             # Common services (email, commands, onboarding state)
│   ├── logger/               # Winston logger
│   ├── ngrok/                # Ngrok service for webhooks
│   └── ...
├── config/                    # Configuration modules
├── database/                  # Database configuration and data source
├── workflow/                  # Workflow engine and nodes
│   ├── core/                 # Workflow engine, base node, registry
│   ├── nodes/                # Workflow nodes
│   │   ├── input/            # Input nodes (telegram, web-chat)
│   │   ├── output/           # Output nodes (telegram, web-chat)
│   │   └── processor/        # Processor nodes (access-control, onboarding, command, ai-agent)
│   ├── services/             # Workflow services (tools, context)
│   │   └── tool-registries/  # Tool registries (web-search, datalistic)
│   └── sources/              # Platform integrations
│       ├── telegram/         # Telegram service and controller
│       └── web-chat/         # Web Chat service and controller
├── universal-agent/          # Universal AI agent system
│   ├── adapters/             # Framework adapters (deepagents, langchain)
│   └── utils/                # Agent utilities
├── users/                     # User management
├── subscriptions/            # Subscription management
│   ├── stripe/               # Stripe integration
│   └── services/             # Payment accounts service
├── conversations/            # Conversation management
├── fleets/                   # Fleet management
├── reminders/                # Reminder management
└── health/                   # Health check endpoints
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **pnpm** (or npm/yarn)
- **PostgreSQL** 12+ (or use Docker Compose)
- **Stripe Account** (for payment features)
- **Telegram Bot Token** (for Telegram integration)
- **OpenRouter API Key** (for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd FluctBot
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your configuration:
   ```env
   # Database
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=your_password
   DB_DATABASE=fluctbot
   
   # Telegram
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_BOT_USERNAME=your_bot_username
   TELEGRAM_USE_WEBHOOK=true
   
   # Stripe
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   
   # OpenRouter (AI)
   OPENROUTER_API_KEY=sk-or-v1-...
   OPENROUTER_HTTP_REFERER=https://fluct.ai
   
   # Email (SMTP)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   
   # Ngrok (for local webhooks)
   NGROK_AUTH_TOKEN=your_ngrok_token
   ```

4. **Start PostgreSQL** (using Docker Compose)
   ```bash
   docker-compose up -d
   ```

5. **Run database migrations**
   ```bash
   pnpm run migration:run
   ```

6. **Start the application**
   ```bash
   # Development
   pnpm run start:dev
   
   # Production
   pnpm run build
   pnpm run start:prod
   ```

## 🔧 Configuration

### Telegram Setup

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Get your bot token and username
3. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME` in `.env`
4. For webhook mode, ngrok will be automatically configured on startup

### Stripe Setup

1. Create a Stripe account and get API keys
2. Set `STRIPE_SECRET_KEY` in `.env`
3. Webhook secret will be automatically retrieved when webhook is set up
4. Subscription plans are seeded via migration

### Ngrok Setup (Local Development)

1. Sign up at [ngrok.com](https://ngrok.com) and get your auth token
2. Set `NGROK_AUTH_TOKEN` in `.env`
3. Ngrok will automatically start and configure webhooks when `TELEGRAM_USE_WEBHOOK=true`

## 📡 API Endpoints

### Health Check
- `GET /api/v1/health` - Application health status

### Telegram Webhook
- `POST /api/v1/telegram/webhook` - Telegram webhook endpoint
- `POST /api/v1/telegram/set-webhook` - Manually set webhook

### Web Chat
- `POST /api/v1/web-chat/messages` - Send message via API
- `GET /api/v1/web-chat/messages/:sessionId` - Get conversation history

### Subscriptions
- `POST /api/v1/subscriptions/checkout` - Create Stripe checkout session
- `POST /api/v1/subscriptions/webhook` - Stripe webhook endpoint
- `GET /api/v1/subscriptions/plans` - Get available subscription plans

### Users
- `GET /api/v1/users/:id` - Get user details
- `POST /api/v1/users` - Create user
- `PUT /api/v1/users/:id` - Update user

### API Documentation
- `GET /api/docs` - Swagger/OpenAPI documentation

## 🗄️ Database Schema

### Core Tables

- **users** - User accounts
- **user_platforms** - Platform links (Telegram, Web Chat, WhatsApp)
- **subscriptions** - User subscriptions with status (active, inactive, cancelled, expired)
- **subscription_plans** - Available subscription plans with pricing
- **payment_accounts** - Payment provider accounts (Stripe, PayPal, etc.)
- **conversations** - Conversation threads with thread_id
- **conversation_messages** - Individual messages in conversations

### Feature Tables

- **fleets** - User fleets
- **fleet_vessels** - Vessels in fleets
- **reminders** - User reminders
- **referrals** - Referral tracking
- **user_credits_usage** - Credit usage tracking

## 🔄 Workflow System

### Default Workflow

The system uses a default workflow for message processing:

```
Telegram/Web Chat Input
    ↓
Unified Input Node (routes to platform-specific input)
    ↓
Access Control Node (checks user status)
    ├─→ Onboarding Node (if user incomplete)
    ├─→ Command Node (if command detected)
    └─→ AI Agent Node (default processing)
    ↓
Unified Output Node (routes to platform-specific output)
    ↓
Telegram/Web Chat Output
```

### Node Types

#### Input Nodes
- **TelegramInputNode**: Receives and processes Telegram messages
- **WebChatInputNode**: Receives messages via API

#### Processor Nodes
- **AccessControlNode**: Checks user status and routes accordingly
- **OnboardingNode**: Handles user onboarding (email, phone verification)
- **CommandNode**: Processes bot commands (`/subscribe`, `/credits`, `/fleet`, `/reminder`, etc.)
- **AIAgentNode**: AI-powered message processing with tool execution

#### Output Nodes
- **TelegramOutputNode**: Sends messages to Telegram
- **WebChatOutputNode**: Sends messages via API

## 🤖 AI Agent System

### Universal Agent

The system uses a universal agent architecture supporting multiple AI frameworks:

- **DeepAgents** - Primary framework
- **LangChain** - Alternative framework
- **OpenRouter** - LLM API gateway (supports multiple models)

### Available Tools

#### Web Search Tools
- **Web Search** (Tavily) - General web search
- **Wikipedia Search** - Wikipedia article search
- **Weather Search** - Weather data (Open-Meteo)

#### Maritime Tools (Datalistic)
- **Search Vessels** - Find vessels by IMO, MMSI, or name
- **Get Vessel Position** - Get current AIS position
- **Search Ports** - Find ports by name
- **Get Vessel Specs** - Get vessel specifications

### Tool Execution

Tools return standardized responses:
```typescript
{
  success: boolean;
  summary: string;      // Human-readable summary
  data?: any;          // Tool-specific data
  metadata?: {         // Execution metadata
    executionTime: number;
    toolCalls?: any[];
  }
}
```

## 💳 Subscription System

### Subscription Plans

Plans are stored in `subscription_plans` table with:
- **Plan Codes**: `free`, `basic`, `pro`
- **Pricing**: JSONB with multiple tiers (daily, monthly, yearly, one-time, fixed)
- **Capabilities**: JSONB with feature limits (fleets, reminders, etc.)
- **Stripe Integration**: Product and Price IDs stored in pricing metadata

### Subscription Status

- **ACTIVE** - Subscription is active and user has access
- **INACTIVE** - Subscription cancelled or replaced
- **CANCELLED** - User cancelled, but still has access until period ends
- **EXPIRED** - Subscription period has ended

### Payment Flow

1. User runs `/subscribe` command
2. System creates Stripe checkout session
3. User completes payment on Stripe
4. Webhook receives `checkout.session.completed`
5. System creates subscription in database
6. User receives confirmation message

### Cancellation Flow

1. User cancels subscription (via Stripe or command)
2. `cancel_at_period_end` is set to `true` in Stripe
3. `customer.subscription.updated` webhook fires
4. System sets `canceledAt` and updates `endDate` to `current_period_end`
5. Status becomes `CANCELLED` (user still has access)
6. When period ends, `customer.subscription.deleted` fires
7. Status becomes `INACTIVE`

## 📝 Bot Commands

### Subscription Commands
- `/subscribe` - View and subscribe to plans
- `/credits` - View account and subscription details

### Fleet Commands
- `/fleet_create <name>` - Create a fleet
- `/fleet_list` - List all fleets
- `/fleet_delete <name>` - Delete a fleet
- `/fleet_rename <old_name> <new_name>` - Rename a fleet
- `/fleet_vessel_add <fleet_name> <imo|mmsi>` - Add vessel to fleet
- `/fleet_vessel_remove <fleet_name> <imo|mmsi>` - Remove vessel from fleet
- `/fleet_vessels <fleet_name>` - List vessels in fleet

### Reminder Commands
- `/reminder <query>` - Create a reminder (LLM-powered extraction)
- `/reminders` - List all active reminders
- `/delete_reminder <number>` - Delete a reminder by index

## 🔐 Access Control & Onboarding

### Access Control Flow

1. **User Check**: System checks if user exists based on platform identifier
2. **Profile Check**: Verifies email, phone, and email verification status
3. **Routing**:
   - If incomplete → Routes to `OnboardingNode`
   - If command detected → Routes to `CommandNode`
   - Otherwise → Routes to `AIAgentNode`

### Onboarding Process

1. **Email Collection**: User provides email address
2. **Email Verification**: System sends 6-digit code, user verifies
3. **Phone Collection**: User provides phone number (if not set)
4. **Phone Verification**: System validates phone format
5. **Completion**: User account created/updated, welcome message sent

## 🛠️ Development

### Available Scripts

```bash
# Development
pnpm run start:dev      # Start with hot reload
pnpm run start:debug   # Start in debug mode

# Production
pnpm run build         # Build application
pnpm run start:prod    # Start production server

# Database
pnpm run migration:generate  # Generate migration
pnpm run migration:create     # Create empty migration
pnpm run migration:run        # Run migrations
pnpm run migration:revert     # Revert last migration
pnpm run migration:show       # Show migration status

# Code Quality
pnpm run lint          # Lint codebase
pnpm run format        # Format code
pnpm run test          # Run tests
pnpm run test:watch    # Run tests in watch mode
pnpm run test:cov      # Run tests with coverage
```

### Creating Custom Nodes

1. **Extend BaseNode**:
   ```typescript
   export class MyNode extends BaseNode {
     constructor(
       id: string,
       name: string,
       config: MyConfig,
       private readonly context: WorkflowNodeContext,
     ) {
       super(id, name, 'my-node', config);
     }
     
     protected async prep(context: NodeExecutionContext) { ... }
     protected async exec(prepResult, context) { ... }
     protected async post(context, prepResult, execResult) { ... }
   }
   ```

2. **Create Factory**:
   ```typescript
   export class MyNodeFactory implements NodeFactory {
     getType() { return 'my-node'; }
     createInstance(id, name, config, context) {
       return new MyNode(id, name, config, context);
     }
   }
   ```

3. **Register in WorkflowModule**

### Adding New Tools

1. **Create Tool Registry** (or add to existing):
   ```typescript
   @Injectable()
   export class MyToolsRegistry {
     getTools(): UniversalTool[] {
       return [
         {
           name: 'my_tool',
           description: 'Tool description',
           parameters: z.object({ ... }),
           execute: async (params) => { ... }
         }
       ];
     }
   }
   ```

2. **Register in AgentToolsService**

## 📊 Database Migrations

Migrations are managed via TypeORM. Key migrations:

- `CreateUsers` - User accounts
- `CreateUserPlatforms` - Platform linking
- `CreateSubscriptions` - Subscription management
- `CreateSubscriptionPlans` - Plan definitions
- `CreateConversations` - Conversation tracking
- `CreatePaymentAccounts` - Payment provider accounts
- `AddStatusToSubscriptions` - Status enum migration
- `AddCanceledAtToSubscriptions` - Cancellation tracking

## 🔒 Security

- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing configuration
- **Input Validation** - Class-validator for all inputs
- **Error Handling** - No sensitive data in error responses
- **Webhook Verification** - Stripe webhook signature verification

## 📈 Monitoring & Logging

- **Winston Logger** - Structured logging with daily rotation
- **Request Logging** - All API requests logged
- **Error Tracking** - Comprehensive error logging
- **Health Checks** - Database and application health monitoring

## 🧪 Testing

```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Coverage
pnpm run test:cov
```

## 📚 Additional Documentation

- **Workflow System**: See `src/workflow/README.md`
- **API Documentation**: Available at `/api/docs` when running

## 🤝 Contributing

1. Follow TypeScript best practices
2. Use the existing node architecture for new features
3. Add proper error handling and logging
4. Update migrations for database changes
5. Write tests for new features

## 📄 License

UNLICENSED

## 🆘 Support

For issues and questions, please refer to the project documentation or contact the development team.

---

**Built with ❤️ using NestJS, TypeScript, and modern best practices**
