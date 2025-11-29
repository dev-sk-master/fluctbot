# Factory Pattern in Workflow Nodes - Explanation

## What is the Factory Pattern?

The **Factory Pattern** is a creational design pattern that provides an interface for creating objects without specifying their exact classes. Instead of directly instantiating objects, you use a factory to create them.

## Why Use Factories in Our Workflow System?

### 1. **Dynamic Node Creation**

Workflows are defined as **data structures** (JSON-like), not code. When a workflow runs, the engine needs to create node instances based on the node type string.

**Without Factory:**
```typescript
// ❌ BAD: Hard to extend, requires switch/case or if-else chains
function createNode(type: string, id: string, name: string, config: any) {
  if (type === 'telegram-input') {
    return new TelegramInputNode(id, name, config);
  } else if (type === 'telegram-output') {
    return new TelegramOutputNode(id, name, config);
  } else if (type === 'echo-processor') {
    return new EchoProcessorNode(id, name, config);
  }
  // ... more if-else for every node type
  throw new Error('Unknown node type');
}
```

**With Factory:**
```typescript
// ✅ GOOD: Extensible, clean, follows Open/Closed Principle
const factory = nodeRegistry.getNode('telegram-input');
const node = factory.createInstance('node-1', 'Input Node', config);
```

### 2. **Separation of Concerns**

- **Workflow Definition** (data): Just stores node type as string: `"telegram-input"`
- **Node Registry**: Maps type strings to factories
- **Factory**: Knows how to create the actual node instance
- **Node Class**: Implements the actual logic

### 3. **Extensibility**

Adding a new node type is simple:

1. Create the node class: `WhatsAppInputNode`
2. Create a factory: `WhatsAppInputNodeFactory`
3. Register it: `nodeRegistry.register(new WhatsAppInputNodeFactory())`

**No need to modify existing code!** This follows the **Open/Closed Principle**.

### 4. **Dependency Injection**

Factories can inject dependencies that nodes need:

```typescript
// TelegramOutputNodeFactory can inject TelegramService
export class TelegramOutputNodeFactory implements NodeFactory {
  constructor(private readonly telegramService: TelegramService) {}
  
  createInstance(id: string, name: string, config: Record<string, unknown>): BaseNode {
    return new TelegramOutputNode(id, name, config, this.telegramService);
  }
}
```

### 5. **Configuration Management**

Factories provide default configurations:

```typescript
getDefaultConfig(): Record<string, unknown> {
  return {
    prefix: '',
    suffix: '',
    transformText: false,
  };
}
```

When creating a node, defaults are merged with workflow-specific config:
```typescript
{ ...factory.getDefaultConfig(), ...workflowNode.config }
```

## How It Works

### Step 1: Factory Registration

```typescript
// In WorkflowModule.onModuleInit()
this.nodeRegistry.register(this.inputFactory);  // Registers 'telegram-input'
this.nodeRegistry.register(this.outputFactory); // Registers 'telegram-output'
this.nodeRegistry.register(this.processorFactory); // Registers 'echo-processor'
```

### Step 2: Workflow Definition (Data)

```typescript
const workflow = {
  nodes: [
    {
      id: 'input-1',
      type: 'telegram-input',  // ← Just a string!
      name: 'Telegram Input',
      config: {}
    }
  ]
}
```

### Step 3: Runtime Node Creation

```typescript
// In WorkflowEngine.executeWorkflow()
const node = workflow.nodes.find(n => n.id === 'input-1');
// node.type = 'telegram-input'

const factory = nodeRegistry.getNode('telegram-input'); // Get factory
const instance = factory.createInstance(
  node.id,      // 'input-1'
  node.name,     // 'Telegram Input'
  node.config    // {}
);
// instance is now a TelegramInputNode ready to execute
```

## Real-World Example

### Scenario: Adding a WhatsApp Node

**Without Factory Pattern:**
1. Modify `WorkflowEngine` to add `else if (type === 'whatsapp-input')`
2. Import `WhatsAppInputNode` in `WorkflowEngine`
3. Hard-code the creation logic
4. Risk breaking existing code

**With Factory Pattern:**
1. Create `WhatsAppInputNode` class
2. Create `WhatsAppInputNodeFactory`
3. Register factory: `nodeRegistry.register(new WhatsAppInputNodeFactory())`
4. Done! No changes to `WorkflowEngine` needed

## Benefits Summary

| Benefit | Description |
|---------|-------------|
| **Extensibility** | Add new node types without modifying existing code |
| **Testability** | Easy to mock factories for testing |
| **Type Safety** | Factory interface ensures consistent node creation |
| **Dependency Injection** | Factories can inject services nodes need |
| **Configuration** | Default configs provided by factories |
| **Decoupling** | WorkflowEngine doesn't need to know about specific node classes |
| **Dynamic Loading** | Can load node types at runtime (future: plugin system) |

## Factory Interface

All factories implement this interface:

```typescript
interface NodeFactory {
  getType(): string;                    // 'telegram-input'
  getDescription(): string;             // Human-readable description
  getDefaultConfig(): Record<string, unknown>; // Default configuration
  createInstance(                       // Creates the actual node
    id: string,
    name: string,
    config: Record<string, unknown>
  ): BaseNode;
}
```

## Comparison: Direct Instantiation vs Factory

### Direct Instantiation (Without Factory)
```typescript
// ❌ Problems:
// 1. WorkflowEngine needs to import every node class
// 2. Hard to extend
// 3. Tight coupling
// 4. Can't inject dependencies easily

import { TelegramInputNode } from './nodes/input/telegram-input.node';
import { TelegramOutputNode } from './nodes/output/telegram-output.node';
// ... import every node type

const node = new TelegramInputNode(id, name, config);
```

### Factory Pattern (Current Implementation)
```typescript
// ✅ Benefits:
// 1. WorkflowEngine only knows about BaseNode
// 2. Easy to extend
// 3. Loose coupling
// 4. Dependencies injected via factory

const factory = nodeRegistry.getNode('telegram-input');
const node = factory.createInstance(id, name, config);
```

## Future Possibilities

With factories, you can easily:

1. **Plugin System**: Load node types from external packages
2. **Dynamic Registration**: Register nodes at runtime
3. **Node Marketplace**: Users can create and share custom nodes
4. **Versioning**: Support multiple versions of the same node type
5. **Validation**: Factories can validate config before creating nodes

## Example: Creating a Custom Node

```typescript
// 1. Create the node
export class LLMProcessorNode extends BaseNode {
  constructor(id: string, name: string, config: LLMConfig) {
    super(id, name, 'llm-processor', config);
  }
  // ... implement prep, exec, post
}

// 2. Create the factory
export class LLMProcessorNodeFactory implements NodeFactory {
  getType() { return 'llm-processor'; }
  getDescription() { return 'Processes messages using LLM'; }
  getDefaultConfig() { return { model: 'gpt-4', temperature: 0.7 }; }
  
  createInstance(id: string, name: string, config: Record<string, unknown>): BaseNode {
    return new LLMProcessorNode(id, name, config as LLMConfig);
  }
}

// 3. Register it
nodeRegistry.register(new LLMProcessorNodeFactory());

// 4. Use it in workflows
const workflow = {
  nodes: [{
    id: 'llm-1',
    type: 'llm-processor',  // ← Just works!
    name: 'LLM Processor',
    config: { model: 'gpt-4' }
  }]
};
```

## Conclusion

Factories provide a **clean, extensible, and maintainable** way to create workflow nodes dynamically. They enable:

- ✅ Adding new node types without touching existing code
- ✅ Injecting dependencies (like TelegramService)
- ✅ Providing default configurations
- ✅ Supporting future features (plugins, dynamic loading)
- ✅ Keeping the workflow engine decoupled from specific node implementations

This is a **professional, production-grade** architecture pattern used in systems like n8n, Zapier, and other workflow automation platforms.

