# FluctBot Workflow System

A professional n8n-like workflow system for processing messages from multiple sources (Telegram, WhatsApp, Web Chat) with a node-based architecture.

## Architecture

The workflow system is inspired by PocketFlow and n8n, featuring:

- **Node-based Architecture**: Each processing step is a node
- **Flow Orchestration**: Nodes are connected in a graph structure
- **Shared Data Store**: Nodes communicate through shared context
- **Action-based Transitions**: Nodes can branch based on actions
- **Factory Pattern**: Nodes are created through factories for flexibility

## Core Components

### 1. Base Node (`core/base-node.ts`)

All nodes extend `BaseNode` and implement the `prep->exec->post` pattern:

- **prep()**: Prepare data from shared context
- **exec()**: Execute the node's main logic
- **post()**: Post-process and update shared context, return action for next node

### 2. Workflow Engine (`core/workflow-engine.ts`)

Orchestrates node execution following the workflow graph. Handles:
- Node execution flow
- Action-based transitions
- Error handling
- Execution tracking

### 3. Node Registry (`core/node-registry.ts`)

Manages available node types using the factory pattern. Allows:
- Dynamic node registration
- Node instance creation
- Type discovery

## Node Types

### Input Nodes

- **TelegramInputNode**: Receives messages from Telegram and converts to FluctMessage

### Output Nodes

- **TelegramOutputNode**: Sends messages back to Telegram
- **WhatsAppOutputNode**: (Future) Sends messages to WhatsApp
- **WebChatOutputNode**: (Future) Sends messages to web chat

### Processor Nodes

- **EchoProcessorNode**: Simple echo processor for testing
- More processors can be added (LLM, RAG, etc.)

## Message Structure

All messages are converted to a common `FluctMessage` format:

```typescript
interface FluctMessage {
  id: string;
  metadata: {
    source: MessageSource; // TELEGRAM, WHATSAPP, WEB_CHAT
    sourceId: string;
    userId: string;
    chatId: string;
    timestamp: Date;
  };
  content: {
    type: MessageType; // TEXT, AUDIO, FILE, IMAGE, VIDEO
    text?: string;
    audioUrl?: string;
    fileUrl?: string;
    // ... other content fields
  };
  status: MessageStatus;
}
```

## Creating Workflows

### Using WorkflowBuilder

```typescript
const builder = new WorkflowBuilder('workflow-id', 'Workflow Name');

builder
  .addNode({
    id: 'input-1',
    type: 'telegram-input',
    name: 'Telegram Input',
    config: {},
  })
  .addNode({
    id: 'processor-1',
    type: 'echo-processor',
    name: 'Echo Processor',
    config: { transformText: false },
  })
  .addNode({
    id: 'output-1',
    type: 'telegram-output',
    name: 'Telegram Output',
    config: {},
  })
  .connect('input-1', 'processor-1')
  .connect('processor-1', 'output-1')
  .setStartNode('input-1');

const workflow = builder.build();
workflowService.registerWorkflow(workflow);
```

## Creating Custom Nodes

1. Extend `BaseNode`:

```typescript
export class MyCustomNode extends BaseNode {
  constructor(id: string, name: string, config: MyConfig) {
    super(id, name, 'my-custom-node', config);
  }

  protected async prep(context: NodeExecutionContext): Promise<unknown> {
    // Extract data from shared context
    return context.sharedData.someData;
  }

  protected async exec(prepResult: unknown, context: NodeExecutionContext): Promise<unknown> {
    // Do processing
    return processedResult;
  }

  protected async post(
    context: NodeExecutionContext,
    prepResult: unknown,
    execResult: unknown,
  ): Promise<string | undefined> {
    // Store results and return action
    context.sharedData.result = execResult;
    return 'default'; // or 'success', 'error', etc.
  }
}
```

2. Create a factory:

```typescript
export class MyCustomNodeFactory implements NodeFactory {
  getType(): string {
    return 'my-custom-node';
  }

  createInstance(id: string, name: string, config: Record<string, unknown>): BaseNode {
    return new MyCustomNode(id, name, config as MyConfig);
  }

  getDefaultConfig(): Record<string, unknown> {
    return {};
  }

  getDescription(): string {
    return 'Description of my custom node';
  }
}
```

3. Register in `WorkflowModule`:

```typescript
this.nodeRegistry.register(new MyCustomNodeFactory());
```

## Default Workflow

The system includes a default "Telegram Echo Workflow" that:
1. Receives a Telegram message (TelegramInputNode)
2. Processes it (EchoProcessorNode)
3. Sends it back (TelegramOutputNode)

This workflow is automatically registered on module initialization.

## Future Enhancements

- WhatsApp integration
- Web Chat integration
- LLM processing nodes
- RAG (Retrieval Augmented Generation) nodes
- Database storage nodes
- Conditional branching nodes
- Parallel execution nodes
- Workflow visualization UI
- Workflow persistence to database

