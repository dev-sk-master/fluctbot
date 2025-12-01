# Stripe Webhook Setup - How It Works

## Questions Answered

### 1. Will Stripe webhook be set each time the app starts?

**Yes!** ✅

- The webhook is set automatically in `StripeService.onModuleInit()` (runs on app startup)
- It checks if webhook already exists (by URL) and reuses it
- If not found, creates a new one
- **Webhooks persist in Stripe** - they don't get deleted when your app stops

### 2. Is it removed when the app stops on local?

**No!** ❌

- Stripe webhooks are stored in Stripe's system, not locally
- They persist even after your app stops
- When you restart the app, it finds the existing webhook and reuses it
- **Old webhooks accumulate** - that's why we have cleanup logic

### 3. Can we get the webhook secret dynamically?

**Partially** ✅

- **When creating a NEW webhook**: Secret is returned in the API response
- **For existing webhooks**: Secret is NOT available via API (security)
- **Solution**: 
  - For new webhooks: Secret is logged automatically
  - For existing webhooks: Get it from Stripe Dashboard

## How It Works (Based on Old Project)

### Automatic Setup Flow:

1. **App Starts** → `StripeService.onModuleInit()` runs
2. **Check Environment**:
   - If `STRIPE_WEBHOOK_URL` is set → Use that
   - If not set → Auto-detect ngrok URL
3. **Check Existing Webhooks**:
   - List all webhooks from Stripe
   - Find webhook matching the URL
   - If found → Reuse it (update if needed)
   - If not found → Create new one
4. **Cleanup Old Webhooks** (if hitting limit):
   - Stripe has a limit (16 webhooks in test mode)
   - Automatically deletes old webhooks that don't match current URL
   - Only deletes webhooks in same mode (test/live)
5. **Get Secret**:
   - For NEW webhooks: Secret is in the response
   - For existing: Log instructions to get from dashboard

### Webhook Persistence:

```
App Start 1:
  → Creates webhook: we_123 (URL: https://abc.ngrok.app/...)
  → Secret: whsec_xxx (logged)

App Stop:
  → Webhook still exists in Stripe ✅

App Start 2 (new ngrok URL):
  → Creates NEW webhook: we_456 (URL: https://xyz.ngrok.app/...)
  → Old webhook we_123 still exists in Stripe
  → After 16 webhooks, cleanup deletes old ones

App Start 3 (same ngrok URL as Start 2):
  → Finds existing webhook we_456
  → Reuses it (no new webhook created) ✅
```

## Improvements from Old Project

### ✅ What We Added:

1. **Automatic ngrok Detection**: Same as Telegram webhook
2. **Webhook Cleanup**: Automatically removes old webhooks (prevents hitting 16 limit)
3. **Secret Logging**: Logs secret when creating new webhook
4. **Better Error Handling**: Retries with exponential backoff
5. **Mode Detection**: Only deletes webhooks in same mode (test/live)

### 📝 What Happens:

**First Time (New Webhook):**
```
✅ Stripe webhook automatically set to: https://abc.ngrok.app/api/v1/subscriptions/webhook
   Webhook ID: we_1234567890
   Webhook Secret: whsec_xxxxx
⚠️  Add this to your .env file: STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

**Subsequent Starts (Existing Webhook):**
```
✅ Stripe webhook automatically set to: https://abc.ngrok.app/api/v1/subscriptions/webhook
   Webhook ID: we_1234567890
⚠️  Webhook secret not available. Retrieve it from Stripe Dashboard:
   https://dashboard.stripe.com/webhooks/we_1234567890
```

## Important Notes

### Webhook Secret:

- **New webhooks**: Secret is logged automatically ✅
- **Existing webhooks**: Get from Stripe Dashboard (security restriction)
- **Production**: Set `STRIPE_WEBHOOK_SECRET` in `.env` manually

### Webhook Cleanup:

- Only runs when hitting the 16 webhook limit
- Only deletes webhooks in same mode (test/live)
- Keeps webhooks matching current URL
- Prevents accumulation of old ngrok URLs

### Local Development:

- Each ngrok restart = new URL = new webhook (if URL changes)
- Old webhooks accumulate until cleanup runs
- Secret is logged for new webhooks
- For existing webhooks, use Stripe Dashboard

## Summary

✅ **Webhook is set automatically** on each app start
✅ **Reuses existing webhook** if URL matches
✅ **Creates new webhook** if URL doesn't match
✅ **Cleans up old webhooks** when hitting limit
✅ **Logs secret** for new webhooks
⚠️ **Webhooks persist** in Stripe (not deleted when app stops)
⚠️ **Secret for existing webhooks** must be retrieved from Stripe Dashboard

This matches your old project's behavior but with better automation and cleanup!

