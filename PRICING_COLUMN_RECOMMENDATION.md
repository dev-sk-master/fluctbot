# Pricing Column Structure Recommendation

## Current Situation

**Current Structure:**
- `pricing` column: `{"monthly": 5, "yearly": 50}` - Display amounts only
- `metadata` column: `{}` - Currently empty, used for Stripe IDs

**Usage:**
- `pricing` is used in `/subscribe` command to display prices to users
- `metadata` is used by `StripeService` to get Stripe Price IDs

## Recommendation: **Enhanced Pricing Structure** ✅

### Option 1: Enhance `pricing` Column (Recommended)

**Structure:**
```json
{
  "monthly": {
    "amount": 5,
    "stripe_price_id": "price_1SZSoHHlEU90bP9J3ioSOT1O"
  },
  "yearly": {
    "amount": 50,
    "stripe_price_id": "price_1SZSkYHlEU90bP9JpwcB0n9P"
  }
}
```

**Benefits:**
✅ Single source of truth - amounts and Stripe IDs together
✅ Easy to maintain - update prices and IDs in one place
✅ Clear structure - each pricing tier has its amount and Stripe ID
✅ Backward compatible - can migrate existing data

**Column Name Options:**
1. **Keep `pricing`** - Simple, but might be confusing (contains more than just prices)
2. **Rename to `payment_config`** - Clear, indicates payment configuration
3. **Rename to `stripe_config`** - Specific to Stripe (less flexible for future)
4. **Rename to `pricing_config`** - Indicates pricing + configuration

**My Recommendation: Keep `pricing`** - It's already established, and the enhanced structure makes sense.

---

### Option 2: Keep Separate Columns

- `pricing`: Display amounts only
- `stripe_config`: Stripe IDs only

**Disadvantages:**
❌ Two places to update when prices change
❌ Risk of data inconsistency
❌ More complex queries

---

## Implementation Plan

### Step 1: Update Entity Interface

```typescript
export interface SubscriptionPlanPricing {
  monthly?: {
    amount: number;
    stripe_price_id: string;
  };
  yearly?: {
    amount: number;
    stripe_price_id: string;
  };
  weekly?: {
    amount: number;
    stripe_price_id: string;
  };
  one_time?: {
    amount: number;
    stripe_price_id: string;
  };
  fixed?: {
    amount: number;
    stripe_price_id: string;
  };
}
```

### Step 2: Update StripeService

Read from `pricing` instead of `metadata`:
```typescript
const pricing = plan.pricing || {};
const monthlyPriceId = pricing.monthly?.stripe_price_id;
const yearlyPriceId = pricing.yearly?.stripe_price_id;
```

### Step 3: Update CommandNode

Display amounts from `pricing`:
```typescript
const monthlyAmount = pricing.monthly?.amount;
const yearlyAmount = pricing.yearly?.amount;
```

### Step 4: Migration

Update existing plans with new structure.

---

## Your Data

**Basic Plan:**
- Product ID: `prod_TWVmStuP1yegFh`
- Monthly Price ID: `price_1SZSoHHlEU90bP9J3ioSOT1O`
- Yearly Price ID: `price_1SZSkYHlEU90bP9JpwcB0n9P`

**Pro Plan:**
- Product ID: `prod_TWVmlPBVUtqRhx`
- Monthly Price ID: `price_1SZSnsHlEU90bP9JPx9mTRPn`
- Yearly Price ID: `price_1SZSlHHlEU90bP9JfN2TA5qs`

**Free Plan:**
- Product ID: `prod_TWVjskWDuc5TWj`
- No pricing (free plan)

---

## Final Recommendation

✅ **Keep `pricing` column name**
✅ **Enhance structure to include Stripe IDs**
✅ **Store Product ID in `metadata`** (or add to pricing structure)

**Structure:**
```json
{
  "stripe_product_id": "prod_xxx",  // Optional: can be in metadata or pricing
  "monthly": {
    "amount": 5,
    "stripe_price_id": "price_xxx"
  },
  "yearly": {
    "amount": 50,
    "stripe_price_id": "price_yyy"
  }
}
```

**OR keep product ID in metadata:**
- `metadata.stripe_product_id`
- `pricing.monthly.stripe_price_id`
- `pricing.yearly.stripe_price_id`

This keeps product ID separate (doesn't change per pricing tier) and price IDs with their amounts.

