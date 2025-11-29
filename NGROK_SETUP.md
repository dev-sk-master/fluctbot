# Setting Up Telegram Webhook with ngrok for Local Development

## Prerequisites

1. Install ngrok: https://ngrok.com/download
2. Sign up for a free ngrok account (optional but recommended)
3. Get your ngrok authtoken from https://dashboard.ngrok.com/get-started/your-authtoken

## Step 1: Install and Configure ngrok

### Windows (using Chocolatey or direct download)
```bash
# Download from https://ngrok.com/download
# Or using Chocolatey:
choco install ngrok
```

### Authenticate ngrok
```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

## Step 2: Start Your NestJS Application

Make sure your app is running on port 3000 (or your configured port):

```bash
pnpm run start:dev
```

## Step 3: Start ngrok Tunnel

In a separate terminal, start ngrok:

```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding    https://abc123.ngrok-free.app -> http://localhost:3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

## Step 4: Configure Environment Variables

Update your `.env` file:

```env
TELEGRAM_BOT_TOKEN=8470542411:AAFKjLOwkRFxpsfJKgCpOsYAvxVeoqX68WE
TELEGRAM_BOT_USERNAME=@fluctdevlocal_bot
TELEGRAM_DEFAULT_WORKFLOW_ID=telegram-echo-workflow
TELEGRAM_USE_WEBHOOK=true
TELEGRAM_WEBHOOK_URL=https://abc123.ngrok-free.app/telegram/webhook
```

**Important:** Replace `abc123.ngrok-free.app` with your actual ngrok URL.

## Step 5: Set Telegram Webhook

You have two options:

### Option A: Use the Telegram Service Method (Recommended)

Create a temporary script or use the API endpoint to set the webhook:

```typescript
// In a controller or script
await telegramService.setWebhook('https://abc123.ngrok-free.app/telegram/webhook');
```

### Option B: Use Telegram Bot API Directly

```bash
curl -X POST "https://api.telegram.org/bot8470542411:AAFKjLOwkRFxpsfJKgCpOsYAvxVeoqX68WE/setWebhook" \
  -d "url=https://abc123.ngrok-free.app/telegram/webhook"
```

Replace the URL with your actual ngrok URL.

## Step 6: Verify Webhook is Set

Check if webhook is configured correctly:

```bash
curl "https://api.telegram.org/bot8470542411:AAFKjLOwkRFxpsfJKgCpOsYAvxVeoqX68WE/getWebhookInfo"
```

You should see:
```json
{
  "ok": true,
  "result": {
    "url": "https://abc123.ngrok-free.app/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

## Step 7: Test

1. Send a message to your bot on Telegram
2. Check your application logs - you should see the webhook request
3. The bot should respond with an echo

## Important Notes

### ngrok Free Tier Limitations

- **URL changes on restart**: Each time you restart ngrok, you get a new URL
- **Session timeout**: Free tier has session limits
- **Solution**: Use ngrok's static domain (paid) or update webhook URL each time

### Updating Webhook URL

Every time you restart ngrok and get a new URL, you need to:
1. Update `.env` with the new URL
2. Restart your NestJS app
3. Set the webhook again using Option A or B above

### ngrok Dashboard

You can monitor requests at: http://localhost:4040 (ngrok web interface)

## Troubleshooting

### Webhook not receiving updates

1. **Check ngrok is running**: Make sure ngrok tunnel is active
2. **Verify URL**: Check webhook URL is correct with `getWebhookInfo`
3. **Check logs**: Look at ngrok dashboard (localhost:4040) for incoming requests
4. **Verify endpoint**: Make sure `/telegram/webhook` endpoint is accessible
5. **Check SSL**: Telegram requires HTTPS - ngrok provides this automatically

### 404 Not Found

- Make sure your NestJS app is running
- Verify the webhook URL path is `/telegram/webhook`
- Check ngrok is forwarding to the correct port

### 502 Bad Gateway

- Your NestJS app might not be running
- Check if the port matches (default 3000)

## Alternative: Use ngrok Static Domain (Paid)

If you have ngrok paid plan, you can use a static domain:

```bash
ngrok http 3000 --domain=your-static-domain.ngrok.app
```

This way, the URL never changes and you don't need to update the webhook each time.

## Switching Back to Polling Mode

To switch back to polling (no webhook needed):

```env
TELEGRAM_USE_WEBHOOK=false
```

Restart your application.

