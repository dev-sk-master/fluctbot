# Subscription Cancellation Logic

## Current Issue

When a subscription is cancelled:
- Status shows as `EXPIRED` instead of `CANCELLED`
- `endDate` shows original subscription end date (e.g., Dec 1, 2026) instead of current billing period end
- `canceledAt` is set but status is wrong

## Expected Behavior

### When Subscription is Cancelled:

1. **Update `endDate`**: Should be set to `current_period_end` (end of current billing period), NOT the original subscription end date
   - Example: Subscription started Dec 1, 2025, original end Dec 1, 2026
   - User cancels on Dec 15, 2025 (monthly billing)
   - `endDate` should be Dec 31, 2025 (end of current month), NOT Dec 1, 2026

2. **Set `canceledAt`**: Timestamp when cancellation was requested

3. **Set Status**: Should be `CANCELLED` (not `INACTIVE` or `EXPIRED`)
   - `CANCELLED` = User cancelled, but still has access until `endDate`
   - `EXPIRED` = Period has ended, no access
   - `INACTIVE` = Subscription is not active (replaced by new subscription, etc.)

## Status Priority

1. **EXPIRED**: `endDate < now()` (period has ended)
2. **CANCELLED**: `canceledAt` is set AND `endDate > now()` (cancelled but period not ended)
3. **ACTIVE**: Currently active and period not ended
4. **INACTIVE**: Default (not active, not cancelled, period not ended)

## Solution

When `cancel_at_period_end = true`:
- Always update `endDate` to `current_period_end` (current billing period end)
- Set `canceledAt = now()`
- Status will be calculated as `CANCELLED` (because `canceledAt` is set and `endDate > now()`)

When period ends:
- `endDate` will be in the past
- Status will be calculated as `EXPIRED` (because `endDate < now()`)

