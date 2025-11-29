# API Messages Integration Guide

## Overview

The API message source allows external systems to send messages (text, audio, file, image, video) through the FluctBot workflow system and receive responses via HTTP API.

## Endpoint

### Send Message

**POST** `/api/messages/send`

Send a message through the workflow system.

#### Request Body

```json
{
  "userId": "user123",
  "chatId": "chat123",  // Optional, defaults to userId
  "type": "text",
  "text": "Hello, this is a test message",
  "metadata": {
    "customField": "value"
  }
}
```

#### Query Parameters

- `workflowId` (optional): Workflow ID to execute (defaults to `api-echo-workflow`)

#### Response

```json
{
  "messageId": "api_1234567890_abc123",
  "type": "text",
  "content": {
    "type": "text",
    "text": "Hello! Your message has been processed."
  },
  "metadata": {
    "workflowId": "exec_1234567890",
    "status": "completed"
  }
}
```

## Message Types

### Text Message

```json
{
  "userId": "user123",
  "type": "text",
  "text": "Hello world"
}
```

### Audio Message

```json
{
  "userId": "user123",
  "type": "audio",
  "audioUrl": "https://example.com/audio.mp3",
  "duration": 120,
  "mimeType": "audio/mpeg",
  "fileSize": 1024000
}
```

### File/Document Message

```json
{
  "userId": "user123",
  "type": "document",
  "fileUrl": "https://example.com/document.pdf",
  "fileName": "document.pdf",
  "mimeType": "application/pdf",
  "fileSize": 2048000
}
```

### Image Message

```json
{
  "userId": "user123",
  "type": "image",
  "imageUrl": "https://example.com/image.jpg",
  "thumbnailUrl": "https://example.com/thumb.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 512000
}
```

### Video Message

```json
{
  "userId": "user123",
  "type": "video",
  "videoUrl": "https://example.com/video.mp4",
  "duration": 300,
  "mimeType": "video/mp4",
  "fileSize": 10485760,
  "thumbnailUrl": "https://example.com/thumb.jpg"
}
```

## Workflow Integration

The API messages flow through the same workflow system:

```
API Input → AccessControl → (Onboarding OR EchoProcessor) → API Output
```

### Default Workflow: `api-echo-workflow`

1. **API Input Node**: Receives and normalizes API message
2. **Access Control Node**: Checks if user exists
   - If user exists → routes to EchoProcessor
   - If user doesn't exist → routes to Onboarding
3. **Onboarding Node**: Handles user registration (if needed)
4. **Echo Processor Node**: Processes the message
5. **API Output Node**: Returns response via API

## Example Usage

### cURL

```bash
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "type": "text",
    "text": "Hello from API"
  }'
```

### JavaScript/TypeScript

```typescript
const response = await fetch('http://localhost:3000/api/messages/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    userId: 'user123',
    type: 'text',
    text: 'Hello from API',
  }),
});

const result = await response.json();
console.log(result);
```

### Python

```python
import requests

response = requests.post(
    'http://localhost:3000/api/messages/send',
    json={
        'userId': 'user123',
        'type': 'text',
        'text': 'Hello from API'
    }
)

print(response.json())
```

## Custom Workflow

You can specify a custom workflow:

```bash
curl -X POST "http://localhost:3000/api/messages/send?workflowId=my-custom-workflow" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "type": "text",
    "text": "Hello"
  }'
```

## Features

✅ **Multiple Message Types**: Text, Audio, File, Image, Video  
✅ **User Onboarding**: Automatic onboarding for new users  
✅ **Access Control**: User verification before processing  
✅ **Workflow Integration**: Uses same workflow system as Telegram  
✅ **Response Handling**: Returns processed response via API  
✅ **Swagger Documentation**: Auto-generated API docs at `/api/docs`  

## Architecture

### Components

1. **ApiController** - HTTP endpoint for receiving messages
2. **ApiService** - Converts API requests to FluctMessage and executes workflow
3. **ApiInputNode** - Normalizes API messages
4. **ApiOutputNode** - Prepares API responses
5. **Workflow Integration** - Uses existing workflow system

### Message Flow

```
HTTP Request
    ↓
ApiController.sendMessage()
    ↓
ApiService.processMessage()
    ↓
ApiService.convertToFluctMessage() → FluctMessage
    ↓
WorkflowService.executeWorkflow()
    ↓
WorkflowEngine.executeWorkflow()
    ↓
ApiInputNode → AccessControlNode → OnboardingNode/EchoProcessorNode → ApiOutputNode
    ↓
ApiService extracts response
    ↓
HTTP Response
```

## Security Considerations

- Add authentication/authorization to the API endpoint
- Validate user permissions
- Rate limiting
- Input sanitization
- CORS configuration

## Next Steps

1. Add authentication middleware
2. Implement rate limiting
3. Add webhook support for async responses
4. Add message history/status endpoints
5. Add file upload support for direct file uploads

