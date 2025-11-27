# 🔍 Stripe Idempotency - Current State Documentation

## 📊 **What We Found in Codebase**

### **1. Existing Idempotency Mechanisms**

#### ✅ **A. `public.idempotency_keys` Table** (General Purpose)
- **Purpose:** General idempotency for API requests
- **Structure:**
  - `key` TEXT PRIMARY KEY
  - `user_id` UUID NOT NULL
  - `response` JSONB NOT NULL
  - `created_at` TIMESTAMPTZ
- **Used by:** `posts-create`, `internal-spend`, `purchase-credits` functions
- **Pattern:** Stores response JSON for replay

#### ✅ **B. `public.stripe_webhook_events` Table** (Webhook Tracking)
- **Purpose:** Tracks processed Stripe webhook events
- **Pattern:** Uses `stripe_event_id` for idempotency check
- **Used by:** `stripe-webhook` function
- **Check:** Query by `stripe_event_id` before processing

#### ✅ **C. Event Creation Idempotency**
- **Table:** `events.events`
- **Column:** `idempotency_key` TEXT (unique index)
- **Function:** `get_event_by_idempotency_key(p_idempotency_key TEXT)`
- **Purpose:** Prevents duplicate event creation

#### ✅ **D. Wallet Transaction Idempotency**
- **Table:** `organizations.org_wallet_transactions`
- **Column:** `idempotency_key` TEXT UNIQUE
- **Purpose:** Prevents duplicate wallet transactions

---

### **2. Current Stripe Checkout Idempotency**

#### **Key Generation Function:**
```typescript
// _shared/checkout-utils.ts
export function generateIdempotencyKey(parts: string[], req?: Request): string {
  const clientKey = req?.headers.get("x-idempotency-key");
  if (clientKey) return clientKey;
  return parts.filter(Boolean).join(':');
}
```

#### **Current Usage Patterns:**

**Enhanced Checkout:**
```typescript
const idempotencyKey = generateIdempotencyKey(
  ['checkout', checkoutSessionId, orderData.user_id],
  req
);
// Format: "checkout:sessionId:userId"
```

**Guest Checkout:**
```typescript
const idempotencyKey = generateIdempotencyKey(
  ['checkout', checkoutSessionId, userId],
  req
);
// Format: "checkout:sessionId:userId"
```

**Purchase Org Credits:**
```typescript
idempotencyKey: `org-session:${org_id}:${invoice.id}:${requestKey}`
// Format: "org-session:orgId:invoiceId:requestKey"
```

**Issues Identified:**
- ⚠️ Format is inconsistent (`:` vs `-` separator)
- ⚠️ No UUID suffix (potential collision risk)
- ⚠️ No database tracking of keys
- ⚠️ No operation type prefix

---

### **3. Current Webhook Idempotency**

#### **Pattern Used:**
```typescript
// stripe-webhook/index.ts
const { data: existingEvent } = await supabaseService
  .from("stripe_webhook_events")
  .select("id, processed_at, success, error_message")
  .eq("stripe_event_id", event.id)
  .maybeSingle();

if (existingEvent) {
  return { received: true, already_processed: true };
}
```

**Strengths:**
- ✅ Uses database table for tracking
- ✅ Checks before processing
- ✅ Records success/failure

**Weaknesses:**
- ⚠️ Only tracks webhooks, not API calls
- ⚠️ No tracking of checkout session creation idempotency

---

### **4. Current Checkout Session Creation**

#### **How It Works:**
1. Function generates idempotency key
2. Key passed to Stripe API
3. Stripe handles idempotency (24h window)
4. **No database tracking** of keys sent to Stripe

**What's Missing:**
- ❌ No record of which keys were sent
- ❌ No way to check if operation already completed
- ❌ No tracking of Stripe resource IDs returned

---

## 🎯 **What We're Proposing**

### **New Table: `public.stripe_idempotency_keys`**

**Why:**
- ✅ Centralized tracking of ALL Stripe operations (not just webhooks)
- ✅ Enforce uniqueness per operation type + operation ID
- ✅ Store Stripe resource IDs for idempotent retries
- ✅ Better observability and debugging

**How It Works:**
1. Before calling Stripe API:
   - Check if operation already completed via `check_stripe_idempotency()`
   - If found, return stored Stripe resource ID
2. After successful Stripe API call:
   - Record key + resource ID via `record_stripe_idempotency()`
3. On retry:
   - Check returns existing resource ID (idempotent)

---

## 📋 **Next Steps**

### **Step 1: Run Audit Queries** ✅
Run `AUDIT_CURRENT_IDEMPOTENCY.sql` in Supabase SQL Editor to see:
- What tables exist
- What columns exist
- What indexes/constraints exist
- Sample data patterns

### **Step 2: Decide on Approach**
Based on audit results, choose:
- **Option A:** Add new table (cleaner, doesn't affect existing)
- **Option B:** Enhance existing table (simpler long-term)

### **Step 3: Implement Chosen Approach**

---

**Please run the audit queries first, then we'll decide how to proceed!** 🔍

