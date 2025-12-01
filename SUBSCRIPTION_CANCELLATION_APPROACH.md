# Professional Subscription Cancellation Approach

## Current Problem

When a user cancels a subscription:
- **Current behavior**: Subscription is immediately deactivated in DB (`isActive = false`)
- **Expected behavior**: Subscription should remain active until the end of the current billing period

## Example Scenarios

### Scenario 1: Monthly Subscription (1-year duration)
- **Subscription created**: Jan 1, 2025
- **End date in DB**: Jan 1, 2026 (1 year from start)
- **Billing frequency**: Monthly (£10/month)
- **User cancels**: Jan 15, 2025 (mid-month)
- **Expected**: User should have access until Jan 31, 2025 (end of current billing period)
- **Current**: Subscription immediately deactivated ❌

### Scenario 2: Daily Subscription
- **Subscription created**: Jan 1, 2025
- **End date in DB**: Jan 1, 2026
- **Billing frequency**: Daily (£1/day)
- **User cancels**: Jan 15, 2025 at 2 PM
- **Expected**: User should have access until end of Jan 15, 2025 (end of current day)
- **Current**: Subscription immediately deactivated ❌

### Scenario 3: Yearly Subscription
- **Subscription created**: Jan 1, 2025
- **End date in DB**: Jan 1, 2026
- **Billing frequency**: Yearly (£100/year)
- **User cancels**: June 15, 2025 (mid-year)
- **Expected**: User should have access until Jan 1, 2026 (end of current billing period)
- **Current**: Subscription immediately deactivated ❌

## Professional Solution

### 1. Add `canceledAt` Field
Track when cancellation was requested separately from active status.

### 2. Use Stripe's `current_period_end`
Stripe automatically calculates the end of the current billing period based on frequency:
- **Daily**: End of current day
- **Monthly**: End of current month
- **Yearly**: End of current year (or based on subscription start date)

### 3. Subscription States

| State | `isActive` | `canceledAt` | `endDate` | Access |
|-------|-----------|--------------|-----------|--------|
| **Active** | `true` | `null` | Future date | ✅ Full access |
| **Canceled (period not ended)** | `true` | Set | `current_period_end` | ✅ Access until period end |
| **Expired** | `false` | Set/null | Past date | ❌ No access |

### 4. Stripe Events to Handle

1. **`customer.subscription.updated`**:
   - When `cancel_at_period_end: true` → Set `canceledAt`, keep `isActive = true`, update `endDate = current_period_end`
   - When `cancel_at_period_end: false` → Clear `canceledAt` (renewal)

2. **`customer.subscription.deleted`**:
   - Only fires when period actually ends
   - Set `isActive = false`, `endDate = current_period_end`

### 5. Database Schema Changes

```sql
ALTER TABLE subscriptions ADD COLUMN canceled_at TIMESTAMP NULL;
```

### 6. Logic Flow

```
User cancels subscription
    ↓
Stripe: cancel_at_period_end = true
    ↓
Webhook: customer.subscription.updated
    ↓
DB: canceledAt = now(), isActive = true, endDate = current_period_end
    ↓
User continues to have access until endDate
    ↓
Period ends → Stripe: customer.subscription.deleted
    ↓
DB: isActive = false
```

## Implementation Steps

1. Add `canceledAt` column to subscriptions table
2. Update `handleSubscriptionUpdated` to track cancellation
3. Update `handleSubscriptionDeleted` to only deactivate when period ends
4. Update `getUserActiveSubscription` to check both `isActive` and `endDate`
5. Update cancellation messages to show actual end date

