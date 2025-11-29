# Workflow Connections Explanation

## How Telegram Input → Echo Processor → Telegram Output is Connected

The workflow connection is defined in **`src/workflow/workflow.module.ts`** using the `WorkflowBuilder` fluent API.

## Visual Flow

```
┌─────────────────┐
│ Telegram Update │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      Connection 1      ┌──────────────────┐
│ Telegram Input  │ ──────────────────────> │ Echo Processor   │
│   (input-1)     │                         │  (processor-1)  │
└─────────────────┘                         └────────┬─────────┘
                                                       │
                                                       │ Connection 2
                                                       ▼
                                              ┌──────────────────┐
                                              │ Telegram Output  │
                                              │   (output-1)     │
                                              └────────┬─────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────┐
                                              │  Send to Telegram │
                                              └──────────────────┘
```

## Code Definition

The workflow is defined in `WorkflowModule.createDefaultWorkflow()`:

```typescript
// File: src/workflow/workflow.module.ts

private createDefaultWorkflow(): void {
  const builder = new WorkflowBuilder(
    'telegram-echo-workflow',
    'Telegram Echo Workflow',
  );

  // Step 1: Define the three nodes
  const inputNode = {
    id: 'input-1',                    // Unique node ID
    type: 'telegram-input',           // Node type (registered in NodeRegistry)
    name: 'Telegram Input',
    config: {},                       // Node-specific configuration
  };

  const processorNode = {
    id: 'processor-1',
    type: 'echo-processor',
    name: 'Echo Processor',
    config: {
      transformText: false,
    },
  };

  const outputNode = {
    id: 'output-1',
    type: 'telegram-output',
    name: 'Telegram Output',
    config: {},
  };

  // Step 2: Add nodes to workflow
  builder
    .addNode(inputNode)
    .addNode(processorNode)
    .addNode(outputNode)
    
    // Step 3: Define connections between nodes
    .connect('input-1', 'processor-1')      // Connection 1: Input → Processor
    .connect('processor-1', 'output-1')     // Connection 2: Processor → Output
    
    // Step 4: Set the entry point
    .setStartNode('input-1');

  // Step 5: Build and register the workflow
  const workflow = builder.build();
  this.workflowService.registerWorkflow(workflow);
}
```

## Connection Structure

Each connection is defined as a `NodeConnection`:

```typescript
interface NodeConnection {
  from: NodeId;        // Source node ID (e.g., 'input-1')
  to: NodeId;          // Target node ID (e.g., 'processor-1')
  action?: Action;     // Optional action (defaults to 'default')
}
```

## How Connections Work at Runtime

### 1. Connection Map Building

When a workflow executes, the `WorkflowEngine` builds a connection map:

```typescript
// File: src/workflow/core/workflow-engine.ts

private buildConnectionMap(connections: NodeConnection[]): Map<string, Map<string, string>> {
  const map = new Map<string, Map<string, string>>();
  
  // For connection: { from: 'input-1', to: 'processor-1' }
  // Creates: map['input-1']['default'] = 'processor-1'
  
  for (const conn of connections) {
    if (!map.has(conn.from)) {
      map.set(conn.from, new Map());
    }
    const actionMap = map.get(conn.from)!;
    actionMap.set(conn.action || 'default', conn.to);
  }
  
  return map;
}
```

### 2. Node Execution Flow

The engine executes nodes sequentially based on connections:

```typescript
// Start from the start node
let currentNodeId = 'input-1';  // Set in setStartNode()

while (currentNodeId) {
  // 1. Execute current node (e.g., 'input-1')
  const result = await nodeInstance.execute(context);
  
  // 2. Get the action returned by the node (defaults to 'default')
  const action = result.action || 'default';
  
  // 3. Find next node using connection map
  const nextNodeId = findNextNode(connections, currentNodeId, action);
  // For 'input-1' with action 'default' → returns 'processor-1'
  
  // 4. Move to next node
  currentNodeId = nextNodeId;
}
```

### 3. Finding Next Node

```typescript
private findNextNode(
  connections: Map<string, Map<string, string>>,
  currentNodeId: string,
  action: string,
): string | undefined {
  const nodeConnections = connections.get(currentNodeId);
  // For 'input-1' → returns Map with 'default' → 'processor-1'
  
  // Try specific action first
  if (nodeConnections.has(action)) {
    return nodeConnections.get(action);
  }
  
  // Fallback to default
  if (nodeConnections.has('default')) {
    return nodeConnections.get('default');
  }
  
  return undefined; // No next node = workflow complete
}
```

## Complete Execution Flow

1. **Telegram message arrives** → `TelegramService.handleUpdate()`
2. **Convert to FluctMessage** → `TelegramService.convertToFluctMessage()`
3. **Execute workflow** → `WorkflowService.executeWorkflow('telegram-echo-workflow', message)`
4. **WorkflowEngine starts** → Begins at `startNodeId: 'input-1'`
5. **Execute TelegramInputNode** → Processes message, stores in sharedData
6. **Find next node** → Connection map: `'input-1'` → `'processor-1'`
7. **Execute EchoProcessorNode** → Echoes the message
8. **Find next node** → Connection map: `'processor-1'` → `'output-1'`
9. **Execute TelegramOutputNode** → Sends message back to Telegram
10. **No next node** → Workflow completes

## Action-Based Routing (Advanced)

Connections can also use actions for conditional routing:

```typescript
// Example: Different paths based on action
builder
  .connect('processor-1', 'output-1', 'success')    // If action = 'success'
  .connect('processor-1', 'error-handler', 'error'); // If action = 'error'
```

The node returns an action in its execution result:

```typescript
// In EchoProcessorNode
async exec(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  // ... processing ...
  return {
    action: 'success',  // This determines which connection to follow
    shouldContinue: true,
  };
}
```

## Summary

- **Connections are defined** using `.connect(fromNodeId, toNodeId)` in `WorkflowBuilder`
- **Connections are stored** as `NodeConnection[]` in the `WorkflowDefinition`
- **At runtime**, `WorkflowEngine` builds a connection map for fast lookup
- **Node execution** follows connections sequentially based on returned actions
- **Default action** is `'default'` if no action is specified

The workflow is essentially a **directed graph** where nodes are vertices and connections are edges, executed sequentially from the start node.

