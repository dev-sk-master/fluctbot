# Stripe Payment Implementation Plan

## Analysis of Old Project

### Current Old Implementation:
1. **Checkout Session Creation:**
   - Uses `stripe.checkout.sessions.create()` with `mode: 'subscription'`
   - Fetches products from Stripe: `stripe.products.list()` and `stripe.prices.list()`
   - Creates checkout session with Stripe Price ID
   - Stores `telegram_id` and `plan` in metadata

2. **Webhook Handling:**
   - Listens to `checkout.session.completed` event
   - Extracts `telegram_id` and `plan` from metadata
   - Creates subscription in database with hardcoded values from env vars

3. **Issues with Old Approach:**
   - ❌ Hardcoded prices in code (2000 cents, 1000 cents)
   - ❌ Plan details come from env vars (not database)
   - ❌ No link between Stripe products and database plans

## Recommended Approach for New Project

### Option 1: Store Stripe IDs in Database (Recommended) ✅

**Store in `subscription_plans` table:**
- Add `stripe_product_id` and `stripe_price_ids` (JSONB) to metadata
- Example: `{"stripe_product_id": "prod_xxx", "stripe_price_ids": {"monthly": "price_xxx", "yearly": "price_yyy"}}`

**Benefits:**
- ✅ Single source of truth (database)
- ✅ Can change prices in Stripe without code changes
- ✅ Supports multiple pricing tiers (monthly/yearly) per plan
- ✅ Professional and maintainable
- ✅ Easy to sync with Stripe products

**Implementation:**
1. Add Stripe IDs to `subscription_plans.metadata` JSONB field
2. Create checkout session using Stripe Price ID from database
3. Webhook uses plan code from metadata to find plan in database

### Option 2: Hardcode Stripe IDs in Code

**Issues:**
- ❌ Requires code changes for price updates
- ❌ Not flexible for multiple pricing options
- ❌ Harder to maintain

## Implementation Plan

### 1. Database Schema Update
- Use existing `metadata` JSONB field in `subscription_plans`
- Store: `{"stripe_product_id": "...", "stripe_price_ids": {"monthly": "...", "yearly": "..."}}`

### 2. Stripe Service
- Create `StripeService` for:
  - Creating checkout sessions
  - Handling webhooks
  - Verifying webhook signatures
  - Managing Stripe products/prices

### 3. Subscription Controller
- `POST /api/v1/subscriptions/checkout` - Create checkout session
- `POST /api/v1/subscriptions/webhook` - Handle Stripe webhooks
- `GET /api/v1/subscriptions/plans` - List available plans

### 4. Command Integration
- Add `/subscribe` command to `CommandNode`
- Lists plans with checkout links

### 5. Webhook Handler
- Handle `checkout.session.completed`
- Handle `customer.subscription.updated`
- Handle `customer.subscription.deleted`
- Handle `invoice.payment_failed`

## File Structure

```
src/
  subscriptions/
    stripe/
      stripe.service.ts          # Stripe API wrapper
      stripe-webhook.service.ts  # Webhook handling
    subscriptions.controller.ts  # REST endpoints
    subscriptions.service.ts     # Business logic (already exists)
```

## Next Steps

1. ✅ Analyze old implementation (done)
2. ⏳ Create StripeService
3. ⏳ Create StripeWebhookService
4. ⏳ Create SubscriptionsController
5. ⏳ Update subscription_plans migration to include Stripe IDs
6. ⏳ Add /subscribe command
7. ⏳ Test webhook handling

