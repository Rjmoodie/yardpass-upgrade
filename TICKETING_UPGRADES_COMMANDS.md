# Ticketing System Performance Upgrades - Push Commands

## Files Created/Updated:

### ✅ New Files (3):
1. src/lib/ticketApi.ts - Centralized ticket API functions
2. src/components/common/SkeletonList.tsx - Loading skeleton component
3. src/hooks/useCountdown.ts - Already created from auth upgrades

### ✅ Updated Files (1):
1. src/components/TicketPurchaseModal.tsx - Performance & reliability improvements

## What Was Upgraded:

### TicketPurchaseModal.tsx Improvements:
- ✅ Double-submit prevention with `busyRef` and `submitting` state
- ✅ Hold-based checkout to prevent overselling (with legacy fallback)
- ✅ Memoized `handlePurchase` with `useCallback`
- ✅ Added `createHold` and `createCheckoutSession` API calls
- ✅ Lazy-loaded `SkeletonList` component with `Suspense`
- ✅ Better error handling with guest code support
- ✅ Disabled button during submission

### New API Functions (ticketApi.ts):
- `createHold()` - Atomically reserve inventory
- `createCheckoutSession()` - Create Stripe session from hold
- `fetchTicketTiers()` - Get available tiers
- `fetchOrderStatus()` - Poll order completion
- `validateTicket()` - QR code validation with abort support

## Commands to Push:

```bash
# 1. Check what files were changed
git status

# 2. Add all the new and modified files
git add src/lib/ticketApi.ts
git add src/components/common/SkeletonList.tsx
git add src/components/TicketPurchaseModal.tsx

# 3. Commit with descriptive message
git commit -m "feat: Ticketing system performance and reliability upgrades

- Add centralized ticket API (ticketApi.ts) with hold-based checkout
- Implement double-submit prevention in TicketPurchaseModal
- Add hold creation to prevent ticket overselling
- Lazy load SkeletonList for better performance
- Memoize handlePurchase callback
- Add createHold and createCheckoutSession APIs
- Improve error handling with fallback to legacy checkout
- Add guest code support to hold creation

New API functions:
- createHold() - Atomic inventory reservation
- createCheckoutSession() - Stripe session from hold
- fetchTicketTiers() - Get available tiers
- fetchOrderStatus() - Poll order status
- validateTicket() - QR validation with abort

Performance benefits:
- Prevents race conditions in checkout
- Reduces overselling via atomic holds
- Better UX with disabled button during processing
- Lazy loading reduces initial bundle size

Backwards compatible - falls back to legacy if holds not implemented"

# 4. Push to main
git push origin main
```

## Or use the short version:

```bash
git add src/lib/ticketApi.ts src/components/common/SkeletonList.tsx src/components/TicketPurchaseModal.tsx
git commit -m "feat: Ticketing performance upgrades - hold-based checkout, double-submit prevention"
git push origin main
```

## Next Steps for Full Implementation:

### 1. Create Edge Function for Holds
Create `supabase/functions/create-hold/index.ts`:
- Atomically check tier availability
- Create hold record with expiration
- Calculate totals with guest code discount
- Return hold ID and totals

### 2. Create ticket_holds Table
```sql
CREATE TABLE ticket_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  user_id uuid REFERENCES auth.users(id),
  items jsonb NOT NULL,  -- { tier_id: quantity }
  guest_code_id uuid REFERENCES guest_codes(id),
  subtotal_cents int NOT NULL,
  fees_cents int NOT NULL,
  discount_cents int DEFAULT 0,
  total_cents int NOT NULL,
  expires_at timestamptz DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz DEFAULT now()
);
```

### 3. Update Stripe Webhook
Modify `supabase/functions/stripe-webhook/index.ts`:
- On `checkout.session.completed`:
  - Look up hold by session metadata
  - Convert hold to order
  - Issue tickets
  - Delete hold

### 4. Remaining File Upgrades (Not Yet Applied):

#### EventTicketModal.tsx:
- Add React Query staleTime and refetchOnWindowFocus
- Add Suspense with SkeletonList
- Better past-event handling

#### TicketsPage.tsx:
- Add virtualization with @tanstack/react-virtual
- Create QR lookup map for quick access
- 70vh scrollable container

#### TicketsRoute.tsx:
- Capture full redirect path (with search and hash)

#### TicketSuccessPage.tsx:
- Implement backoff polling for order status
- Memoize ICS/wallet pass generation
- Prevent spinner lock with retry limits

#### EnhancedTicketManagement.tsx:
- Add virtualization for large tables
- Throttle realtime updates (200ms)
- Queue deltas to reduce re-renders

#### ClaimTicketsPrompt.tsx:
- Add countdown timer for resend
- Better field validation
- Clear error display area

#### ScannerPage.tsx:
- Debounce duplicate scans (2.5s window)
- Abort in-flight validation requests
- Better error handling

All core ticketing performance upgrades are ready! 🎟️

