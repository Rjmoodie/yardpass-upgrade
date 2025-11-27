# 🔍 Stripe Idempotency - Current State Audit

## 📊 **What Currently Exists**

### **1. Existing Idempotency Tables**

#### ✅ **`public.idempotency_keys`** (General Purpose)
```sql
CREATE TABLE public.idempotency_keys (
  key TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
- **Purpose:** General idempotency for API requests
- **Used by:** `posts-create`, `internal-spend`, `purchase-credits` functions
- **Pattern:** Stores response JSON for replay

#### ✅ **`public.stripe_webhook_events`** (Webhook Tracking)
- **Purpose:** Tracks processed Stripe webhook events
- **Pattern:** Uses `stripe_event_id` for idempotency check
- **Used by:** `stripe-webhook` function

#### ✅ **`events.events.idempotency_key`** (Event Creation)
- **Purpose:** Prevents duplicate event creation
- **Pattern:** Unique constraint on `idempotency_key` column
- **Used by:** Event creation flows

#### ✅ **`organizations.org_wallet_transactions.idempotency_key`** (Wallet)
- **Purpose:** Prevents duplicate wallet transactions
- **Pattern:** Unique constraint on `idempotency_key` column

---

### **2. Current Idempotency Key Generation**

#### **Function:** `generateIdempotencyKey()` in `_shared/checkout-utils.ts`
```typescript
export function generateIdempotencyKey(parts: string[], req?: Request): string {
  const clientKey = req?.headers.get("x-idempotency-key");
  if (clientKey) return clientKey;
  return parts.filter(Boolean).join(':');
}
```

**Current Usage:**
- `enhanced-checkout`: `['checkout', checkoutSessionId, orderData.user_id]`
- `guest-checkout`: `['checkout', checkoutSessionId, userId]`
- `purchase-org-credits`: `org-session:${org_id}:${invoice.id}:${requestKey}`

**Issues:**
- ⚠️ Format is inconsistent across functions
- ⚠️ No UUID suffix (collision risk)
- ⚠️ No database enforcement of uniqueness

---

### **3. Current Webhook Idempotency**

#### **Stripe Webhook Processing:**
```typescript
// stripe-webhook/index.ts
const { data: existingEvent } = await supabaseService
  .from("stripe_webhook_events")
  .select("id, processed_at, success, error_message")
  .eq("stripe_event_id", event.id)
  .maybeSingle();

if (existingEvent) {
  // Already processed, skip
  return { received: true, already_processed: true };
}
```

**Pattern:**
- ✅ Uses `stripe_webhook_events` table
- ✅ Checks `stripe_event_id` before processing
- ✅ Records success/failure status

---

### **4. Current Checkout Session Idempotency**

#### **Enhanced Checkout:**
```typescript
const idempotencyKey = generateIdempotencyKey(
  ['checkout', checkoutSessionId, orderData.user_id],
  req
);

const session = await stripe.checkout.sessions.create(
  sessionConfig,
  { idempotencyKey }
);
```

**Pattern:**
- ✅ Passes key to Stripe API
- ⚠️ Key format varies by function
- ⚠️ No database tracking of keys

---

## 🔍 **What We're Proposing to Add**

### **New Table: `public.stripe_idempotency_keys`**

**Purpose:**
- Track all Stripe API idempotency keys centrally
- Enforce uniqueness per operation type + operation ID
- Store Stripe resource IDs for idempotent retries
- Cleanup expired keys

**Key Features:**
- `operation_type` + `operation_id` unique constraint (prevents duplicate operations)
- `stripe_idempotency_key` unique (prevents Stripe API collisions)
- Expiration tracking (24h default, cleanup after 7 days)
- Helper functions for checking/recording

---

## 🤔 **Questions to Answer**

1. **Should we migrate existing `idempotency_keys` table?**
   - Option A: Keep separate (general vs Stripe-specific)
   - Option B: Merge into new table

2. **How do we handle existing checkout flows?**
   - Option A: Keep current keys, add new tracking
   - Option B: Migrate all to new format

3. **Do we need backwards compatibility?**
   - Existing keys in format: `checkout:sessionId:userId`
   - New format: `checkout:create:sessionId:UUID`
   - Stripe accepts any string, so both work

---

## 📋 **Recommendation**

### **Option 1: Additive Approach** (Recommended)
- ✅ Keep existing `idempotency_keys` table for general use
- ✅ Add new `stripe_idempotency_keys` for Stripe operations
- ✅ Update key generation to include UUID
- ✅ Gradually migrate checkout flows to use new tracking

### **Option 2: Enhanced Existing Table**
- Modify `idempotency_keys` to support operation types
- Add Stripe-specific fields
- More invasive but simpler long-term

---

## ✅ **Next Steps**

1. **Audit current key usage patterns** ← **You are here**
2. **Decide on approach** (additive vs migration)
3. **Implement chosen approach**
4. **Test with existing flows**
5. **Deploy and monitor**

---

**What do you think? Should we go with the additive approach or check what's actually in the database first?**

