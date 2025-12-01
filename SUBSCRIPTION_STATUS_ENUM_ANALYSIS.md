# Subscription Status: Boolean vs Enum Analysis

## Current Implementation

**Current Schema:**
- `is_active` (boolean): true/false
- `canceled_at` (timestamp): null or date when canceled
- `end_date` (timestamp): when subscription ends

**Current States (derived):**
- **Active**: `is_active = true` AND `end_date > now()`
- **Inactive**: `is_active = false`
- **Cancelled**: `canceled_at IS NOT NULL`
- **Expired**: `end_date < now()`

## Proposed: Status Enum

**Proposed Schema:**
- `status` (enum): 'active' | 'inactive' | 'cancelled' | 'expired'
- `canceled_at` (timestamp): Keep for audit trail
- `end_date` (timestamp): Keep for period tracking

## Comparison

### ✅ Benefits of Status Enum

1. **Explicit State Management**
   - Clear, single source of truth for subscription state
   - No need to derive status from multiple fields
   - Easier to query: `WHERE status = 'cancelled'`

2. **Better Data Integrity**
   - Prevents invalid combinations (e.g., `is_active = true` but `end_date < now()`)
   - Type-safe in code (TypeScript enum)

3. **Easier Filtering & Reporting**
   - Simple queries: `status IN ('active', 'cancelled')`
   - Better for analytics and dashboards

4. **More Professional**
   - Industry standard approach
   - Clearer for new developers
   - Better API documentation

5. **Future-Proof**
   - Easy to add new states (e.g., 'suspended', 'trial', 'pending')
   - No breaking changes to logic

### ❌ Drawbacks of Status Enum

1. **Migration Complexity**
   - Need to migrate existing data
   - Need to update all code references
   - Risk of data inconsistency during migration

2. **State Synchronization**
   - Need to keep `status` in sync with `end_date` and `canceled_at`
   - Could have: `status = 'active'` but `end_date < now()` (inconsistency)

3. **More Code Changes**
   - All `isActive` checks need to change to `status === 'active'`
   - More places to update

## Recommendation: **Use Status Enum** ✅

### Why?

1. **Current system already has complexity**
   - We're checking `isActive` AND `endDate` in `getUserActiveSubscription`
   - Having `canceledAt` separate from `isActive` creates confusion
   - Status enum would simplify this

2. **Better for cancellation logic**
   - Current: `isActive = true` + `canceledAt IS NOT NULL` = "cancelled but still active"
   - With enum: `status = 'cancelled'` = clear state

3. **Professional standard**
   - Most subscription systems use status enums
   - Stripe uses status strings internally
   - Better for API consumers

### Implementation Strategy

1. **Add `status` column** (nullable initially)
2. **Migrate existing data**:
   ```sql
   UPDATE subscriptions SET status = 
     CASE 
       WHEN is_active = true AND (end_date IS NULL OR end_date > NOW()) THEN 'active'
       WHEN canceled_at IS NOT NULL THEN 'cancelled'
       WHEN end_date < NOW() THEN 'expired'
       ELSE 'inactive'
     END;
   ```
3. **Update all code** to use `status` instead of `is_active`
4. **Keep `canceled_at`** for audit trail
5. **Remove `is_active`** column after migration

### Status Definitions

- **`active`**: Subscription is active and user has access
  - `end_date IS NULL OR end_date > NOW()`
  - `canceled_at IS NULL OR (canceled_at IS NOT NULL AND end_date > NOW())`

- **`cancelled`**: User cancelled, but still has access until period ends
  - `canceled_at IS NOT NULL`
  - `end_date > NOW()`

- **`expired`**: Subscription period has ended
  - `end_date < NOW()`

- **`inactive`**: Subscription is not active (general inactive state)
  - Default for subscriptions that don't fit other categories

## Alternative: Keep Boolean + Add Status Helper

If migration is too risky, we could:
1. Keep `is_active` boolean
2. Add computed `status` property in entity
3. Use helper methods for status checks

But this adds complexity and doesn't solve the core issue.

## Final Recommendation

**Proceed with Status Enum** - It's more professional, clearer, and better for long-term maintenance.

