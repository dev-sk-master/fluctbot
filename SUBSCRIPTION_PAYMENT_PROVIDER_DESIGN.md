# Subscription Payment Provider Design

## Current Issue

**Current Structure:**
- `subscriptions` table has `stripe_subscription_id` column
- This is Stripe-specific and won't scale for other providers (PayPal, Square, etc.)

**Problem:**
- Adding PayPal would require `paypal_subscription_id`
- Adding Square would require `square_subscription_id`
- Multiple columns for each provider = schema pollution

---

## Recommended Solutions

### **Option 1: Generic Provider Columns** ⭐ **RECOMMENDED**

**Structure:**
```sql
ALTER TABLE subscriptions
  ADD COLUMN payment_provider VARCHAR(50), -- 'stripe', 'paypal', 'square', etc.
  RENAME COLUMN stripe_subscription_id TO payment_provider_subscription_id;
```

**Benefits:**
- ✅ **Scalable**: One column works for all providers
- ✅ **Clear**: `payment_provider` + `payment_provider_subscription_id` = complete picture
- ✅ **Type-safe**: Can use enum for `payment_provider`
- ✅ **Simple queries**: Easy to find "all Stripe subscriptions" or "subscription by provider ID"
- ✅ **Professional**: Industry standard approach

**Example:**
```typescript
// Stripe subscription
{
  paymentProvider: PaymentProvider.STRIPE,
  paymentProviderSubscriptionId: 'sub_1234567890'
}

// PayPal subscription (future)
{
  paymentProvider: PaymentProvider.PAYPAL,
  paymentProviderSubscriptionId: 'I-BW452GLLEP1G'
}
```

---

### **Option 2: JSONB Provider Metadata**

**Structure:**
```sql
ALTER TABLE subscriptions
  ADD COLUMN payment_provider VARCHAR(50),
  ADD COLUMN provider_metadata JSONB DEFAULT '{}';
  -- Remove stripe_subscription_id
```

**Store in JSONB:**
```json
{
  "stripe": { "subscription_id": "sub_123" },
  "paypal": { "subscription_id": "I-BW452GLLEP1G" }
}
```

**Benefits:**
- ✅ **Very Flexible**: Can store any provider-specific data
- ✅ **No schema changes**: Add new providers without migrations

**Drawbacks:**
- ❌ **Less type-safe**: No schema enforcement
- ❌ **Harder queries**: Need JSONB operators
- ❌ **More complex**: Harder to index and query

---

### **Option 3: Separate Subscription Provider Data Table**

**Structure:**
```sql
CREATE TABLE subscription_provider_data (
  id BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT REFERENCES subscriptions(id),
  payment_provider VARCHAR(50),
  provider_subscription_id VARCHAR(255),
  metadata JSONB,
  UNIQUE(subscription_id, payment_provider)
);
```

**Benefits:**
- ✅ **Very flexible**: Can have multiple provider subscriptions per subscription
- ✅ **Clean separation**: Provider data separate from subscription

**Drawbacks:**
- ❌ **Overkill**: Most subscriptions use one provider
- ❌ **More complex**: Requires joins
- ❌ **Unnecessary**: Adds complexity for simple use case

---

## **Recommendation: Option 1** ⭐

### **Why Option 1 is Best:**

1. **Matches your existing pattern**: You already use `payment_provider` + `payment_provider_identifier` in `payment_accounts` table
2. **Consistent naming**: Same pattern across the codebase
3. **Simple and clear**: Easy to understand and maintain
4. **Type-safe**: Enum ensures valid provider values
5. **Efficient queries**: Direct column access, no JSON parsing
6. **Professional**: Standard approach used by major platforms

### **Implementation Plan:**

1. **Add `payment_provider` column** to `subscriptions` table
2. **Rename `stripe_subscription_id`** to `payment_provider_subscription_id`
3. **Update entity** to use `PaymentProvider` enum
4. **Update all code** that references `stripeSubscriptionId`
5. **Migration** to migrate existing data and add new column

### **Updated Entity Structure:**

```typescript
@Entity('subscriptions')
export class Subscription {
  // ... existing fields ...
  
  @Column({ type: 'varchar', length: 50, name: 'payment_provider', nullable: true })
  paymentProvider?: PaymentProvider; // 'stripe', 'paypal', 'square', etc.
  
  @Column({ type: 'varchar', length: 255, name: 'payment_provider_subscription_id', nullable: true })
  paymentProviderSubscriptionId?: string; // Provider-specific subscription ID
}
```

### **Query Examples:**

```typescript
// Find subscription by Stripe subscription ID
const subscription = await repo.findOne({
  where: {
    paymentProvider: PaymentProvider.STRIPE,
    paymentProviderSubscriptionId: 'sub_1234567890'
  }
});

// Find all Stripe subscriptions
const stripeSubscriptions = await repo.find({
  where: { paymentProvider: PaymentProvider.STRIPE }
});

// Find subscription by any provider ID
const subscription = await repo.findOne({
  where: { paymentProviderSubscriptionId: subscriptionId }
});
```

---

## **Migration Strategy**

### **Step 1: Create Migration**
```typescript
// 1. Add payment_provider column
ALTER TABLE subscriptions ADD COLUMN payment_provider VARCHAR(50);

// 2. Migrate existing data (set all existing to 'stripe')
UPDATE subscriptions 
SET payment_provider = 'stripe' 
WHERE stripe_subscription_id IS NOT NULL;

// 3. Rename column
ALTER TABLE subscriptions 
  RENAME COLUMN stripe_subscription_id TO payment_provider_subscription_id;

// 4. Add index for performance
CREATE INDEX idx_subscriptions_payment_provider 
  ON subscriptions(payment_provider, payment_provider_subscription_id);
```

### **Step 2: Update Entity**
- Add `paymentProvider` field
- Rename `stripeSubscriptionId` to `paymentProviderSubscriptionId`

### **Step 3: Update Code**
- Update `SubscriptionsService.createSubscriptionFromPlan()` to accept `paymentProvider`
- Update `SubscriptionsService.getSubscriptionByStripeId()` to `getSubscriptionByProviderId()`
- Update webhook handlers to use new field names
- Update all references throughout codebase

---

## **Final Recommendation**

**Go with Option 1: Generic Provider Columns**

- ✅ Matches your `payment_accounts` pattern
- ✅ Scalable for future providers
- ✅ Simple and maintainable
- ✅ Professional and industry-standard

