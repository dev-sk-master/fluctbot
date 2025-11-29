# Telegram Bot Setup Guide

## Installation

1. Install dependencies:
```bash
pnpm install
```

This will install `node-telegram-bot-api` and its types.

## Configuration

The bot is configured via environment variables in `.env`:

```env
TELEGRAM_BOT_TOKEN=8470542411:AAFKjLOwkRFxpsfJKgCpOsYAvxVeoqX68WE
TELEGRAM_BOT_USERNAME=@fluctdevlocal_bot
TELEGRAM_DEFAULT_WORKFLOW_ID=telegram-echo-workflow
TELEGRAM_USE_WEBHOOK=false
TELEGRAM_WEBHOOK_URL=https://your-domain.com/telegram/webhook
```

## Modes

### Polling Mode (Development - Default)

Set `TELEGRAM_USE_WEBHOOK=false` or omit it.

The bot will use long polling to receive updates. This is ideal for development.

**Advantages:**
- No need for public URL
- Easy to test locally
- No SSL certificate required

**Disadvantages:**
- Less efficient for production
- Requires the bot to continuously poll

### Webhook Mode (Production)

Set `TELEGRAM_USE_WEBHOOK=true` and provide `TELEGRAM_WEBHOOK_URL`.

The bot will receive updates via webhook. This is recommended for production.

**Advantages:**
- More efficient
- Real-time updates
- Better for production

**Disadvantages:**
- Requires public HTTPS URL
- Requires SSL certificate
- More complex setup

## Setting Up Webhook

If using webhook mode, you need to:

1. Deploy your application with a public HTTPS URL
2. Set the webhook URL:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://your-domain.com/telegram/webhook"
```

Or use the service method:
```typescript
await telegramService.setWebhook('https://your-domain.com/telegram/webhook');
```

## Testing

1. Start your application:
```bash
pnpm run start:dev
```

2. Send a message to your bot on Telegram: `@fluctdevlocal_bot`

3. The bot should echo your message back

## Features

- ✅ Text messages
- ✅ Audio messages
- ✅ Images
- ✅ Videos
- ✅ Documents
- ✅ Voice messages
- ✅ Automatic workflow execution
- ✅ Error handling
- ✅ Logging

## Workflow Integration

When a message is received:

1. TelegramService converts it to FluctMessage
2. WorkflowService executes the default workflow
3. TelegramOutputNode sends the response back

The default workflow is "Telegram Echo Workflow" which:
- Receives message (TelegramInputNode)
- Processes it (EchoProcessorNode)
- Sends it back (TelegramOutputNode)

## Troubleshooting

### Bot not responding

1. Check if bot token is correct
2. Check application logs for errors
3. Verify bot is initialized (check logs on startup)
4. Make sure you've started a conversation with the bot first

### Webhook not working

1. Verify your URL is publicly accessible
2. Check SSL certificate is valid
3. Verify webhook is set correctly:
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

### Polling errors

1. Check internet connection
2. Verify bot token is valid
3. Check rate limits (Telegram has rate limits)

## Security

⚠️ **Important**: Never commit your bot token to version control!

- Keep `.env` in `.gitignore`
- Use environment variables in production
- Consider using secret management services

## Next Steps

- Add more complex processors (LLM, RAG, etc.)
- Implement message persistence
- Add user session management
- Create custom workflows via API

