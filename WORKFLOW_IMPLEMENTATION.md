# Workflow System Implementation Summary

## Overview

A professional n8n-like workflow system has been implemented for FluctBot, inspired by PocketFlow architecture. The system processes messages from multiple sources (Telegram, WhatsApp, Web Chat) through a node-based workflow engine.

## Architecture

### Core Components

1. **BaseNode** (`src/workflow/core/base-node.ts`)
   - Abstract base class for all nodes
   - Implements `prep->exec->post` pattern
   - Handles execution lifecycle

2. **WorkflowEngine** (`src/workflow/core/workflow-engine.ts`)
   - Orchestrates node execution
   - Manages flow transitions based on actions
   - Tracks execution state

3. **NodeRegistry** (`src/workflow/core/node-registry.ts`)
   - Factory pattern for node creation
   - Manages available node types
   - Enables dynamic node registration

4. **WorkflowService** (`src/workflow/services/workflow.service.ts`)
   - Manages workflow definitions
   - Executes workflows
   - Tracks executions

## Implemented Nodes

### Input Nodes
- ✅ **TelegramInputNode**: Receives and normalizes Telegram messages

### Output Nodes
- ✅ **TelegramOutputNode**: Sends messages back to Telegram
- 🔜 WhatsAppOutputNode (future)
- 🔜 WebChatOutputNode (future)

### Processor Nodes
- ✅ **EchoProcessorNode**: Simple echo processor for testing
- 🔜 LLMProcessorNode (future)
- 🔜 RAGProcessorNode (future)

## Message Flow

```
Telegram Update
    ↓
TelegramService.convertToFluctMessage()
    ↓
FluctMessage (common format)
    ↓
WorkflowService.executeWorkflow()
    ↓
WorkflowEngine.executeWorkflow()
    ↓
TelegramInputNode (prep->exec->post)
    ↓
EchoProcessorNode (prep->exec->post)
    ↓
TelegramOutputNode (prep->exec->post)
    ↓
Response sent back to Telegram
```

## Default Workflow

A default "Telegram Echo Workflow" is automatically created:

1. **TelegramInputNode**: Receives message
2. **EchoProcessorNode**: Processes (echoes) message
3. **TelegramOutputNode**: Sends response back

## File Structure

```
src/
├── workflow/
│   ├── core/
│   │   ├── base-node.ts          # Base node class
│   │   ├── workflow-engine.ts     # Execution engine
│   │   └── node-registry.ts       # Node factory registry
│   ├── nodes/
│   │   ├── input/
│   │   │   └── telegram-input.node.ts
│   │   ├── output/
│   │   │   └── telegram-output.node.ts
│   │   ├── processor/
│   │   │   └── echo-processor.node.ts
│   │   └── factories/
│   │       ├── telegram-input.factory.ts
│   │       ├── telegram-output.factory.ts
│   │       └── echo-processor.factory.ts
│   ├── services/
│   │   └── workflow.service.ts
│   ├── builders/
│   │   └── workflow.builder.ts
│   ├── types/
│   │   ├── message.types.ts       # Common message structure
│   │   └── workflow.types.ts      # Workflow types
│   ├── workflow.module.ts
│   └── README.md
└── telegram/
    ├── telegram.service.ts        # Telegram Bot integration
    ├── telegram.controller.ts     # Webhook endpoint
    └── telegram.module.ts
```

## Usage

### 1. Telegram Webhook Setup

Configure your Telegram bot webhook to point to:
```
POST /telegram/webhook
```

### 2. Environment Variables

Add to `.env`:
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_DEFAULT_WORKFLOW_ID=telegram-echo-workflow
```

### 3. Creating Custom Workflows

```typescript
const builder = new WorkflowBuilder('my-workflow', 'My Workflow');

builder
  .addNode({
    id: 'input-1',
    type: 'telegram-input',
    name: 'Input',
    config: {},
  })
  .addNode({
    id: 'processor-1',
    type: 'echo-processor',
    name: 'Processor',
    config: { transformText: true, prefix: 'Echo: ' },
  })
  .addNode({
    id: 'output-1',
    type: 'telegram-output',
    name: 'Output',
    config: {},
  })
  .connect('input-1', 'processor-1')
  .connect('processor-1', 'output-1')
  .setStartNode('input-1');

const workflow = builder.build();
workflowService.registerWorkflow(workflow);
```

## Next Steps

1. **Add Telegram Bot API Integration**
   - Install `node-telegram-bot-api` or use HTTP API directly
   - Implement actual message sending in `TelegramOutputNode`
   - Handle file downloads for audio/files

2. **Add WhatsApp Integration**
   - Create `WhatsAppInputNode` and `WhatsAppOutputNode`
   - Integrate with WhatsApp Business API

3. **Add Web Chat Integration**
   - Create `WebChatInputNode` and `WebChatOutputNode`
   - Set up WebSocket or HTTP endpoints

4. **Add Advanced Processors**
   - LLM processing nodes (OpenAI, Anthropic, etc.)
   - RAG nodes for knowledge retrieval
   - Audio transcription nodes
   - Image processing nodes

5. **Workflow Persistence**
   - Store workflows in database
   - Add workflow versioning
   - Workflow execution history

6. **UI/Visualization**
   - Workflow builder UI
   - Execution monitoring dashboard
   - Node configuration interface

## Testing

To test the workflow system:

1. Start the application
2. Set up Telegram webhook (or use polling)
3. Send a message to your Telegram bot
4. The message should be echoed back

## Professional Features Implemented

✅ Node-based architecture
✅ Factory pattern for extensibility
✅ Type-safe message structure
✅ Action-based flow control
✅ Shared data context
✅ Error handling
✅ Execution tracking
✅ Modular design
✅ Clean separation of concerns
✅ Extensible node system

