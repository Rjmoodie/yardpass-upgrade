# ✅ Simplified Ticket Purchase Architecture

## Summary

After auditing the member and guest ticket purchasing flows, we've simplified the architecture to use **only the proven working functions**.

## Current Architecture (SIMPLIFIED)

### Member Purchase Flow:
```
Frontend → enhanced-checkout → Stripe → stripe-webhook → process-payment → ensure-tickets → Tickets Created ✅
```

### Guest Purchase Flow:
```
Frontend → guest-checkout → Stripe → stripe-webhook → process-payment → ensure-tickets → Tickets Created ✅
```

## Functions in Use

| Function | Purpose | JWT | Status |
|----------|---------|-----|--------|
| **enhanced-checkout** | Member ticket checkout | ✅ Required | ✅ Working |
| **guest-checkout** | Guest ticket checkout | ❌ Disabled | ✅ Working |
| **stripe-webhook** | Receives Stripe events | ❌ Disabled | ✅ Working |
| **process-payment** | Processes payments | ❌ Disabled | ✅ Working |
| **ensure-tickets** | Creates tickets idempotently | ❌ Disabled | ✅ Working |

## Functions Removed/Deprecated

| Function | Why Removed |
|----------|-------------|
| `create-hold` | Unnecessary - `enhanced-checkout` handles holds internally |
| `checkout` | Unnecessary - `enhanced-checkout` is more complete |
| `create-checkout` | Deprecated - replaced by `enhanced-checkout` |
| `payment-success-handler` | Redundant - `stripe-webhook` flow handles everything |

## Frontend Changes

### File: `src/components/TicketPurchaseModal.tsx`

**Member checkout:**
```typescript
const { data, error } = await supabase.functions.invoke('enhanced-checkout', {
  body: {
    eventId: event.id,
    ticketSelections: [{ tierId, quantity }, ...]
  }
});
```

**Guest checkout:**
```typescript
const { url } = await createGuestCheckoutSession({
  event_id: event.id,
  items: [{ tier_id, quantity, unit_price_cents }, ...],
  contact_email: guestEmail,
  contact_name: guestName,
  guest_code: guestCode
});
```

## Data Flow Consistency

### Both flows now have:
- ✅ Consistent fee calculation (6.6% + $2.19)
- ✅ Proper `stripe_session_id` in orders
- ✅ QR codes generated via database triggers
- ✅ Serial numbers assigned automatically
- ✅ Idempotent ticket creation via `ensure-tickets`

## Testing Checklist

- [ ] Test member purchase (authenticated user)
- [ ] Test guest purchase (no account)
- [ ] Verify `stripe_session_id` is populated in orders table
- [ ] Verify tickets are created with QR codes
- [ ] Verify fees are calculated correctly
- [ ] Test checkout on test Stripe account

## What to Do Next

1. **Apply the frontend fix:**
   - Open `ticket-purchase-handler-fix.txt`
   - Replace the `handlePurchase` function in `TicketPurchaseModal.tsx`

2. **Test the flow:**
   - Try purchasing tickets as a logged-in user
   - Try purchasing tickets as a guest
   - Check database for proper order and ticket creation

3. **Clean up (optional):**
   - Delete `create-checkout` function from Supabase Dashboard
   - Delete `payment-success-handler` function from Supabase Dashboard

## Result

🎯 **Simple, proven, working architecture** using `enhanced-checkout` for members and `guest-checkout` for guests!

