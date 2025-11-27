# 🔍 Stripe Idempotency Audit - Results Analysis

## ✅ **What Currently Exists**

### **1. General Idempotency Table** ✅
**Table:** `public.idempotency_keys`
```
Columns:
  - key (text, PRIMARY KEY)
  - user_id (uuid, NOT NULL)
  - response (jsonb, NOT NULL)
  - created_at (timestamptz, default now())
```

**Purpose:** General API idempotency (stores response JSON for replay)
**Used by:** `posts-create`, `internal-spend`, `purchase-credits` functions
**Pattern:** Stores full response JSON for idempotent replay

---

### **2. Stripe Webhook Tracking** ✅
**Table:** `public.stripe_webhook_events`
```
Columns:
  - id (uuid)
  - stripe_event_id (text, NOT NULL) ← Idempotency key
  - event_type (text)
  - checkout_session_id (text)
  - order_id (uuid)
  - processed_at (timestamptz)
  - success (boolean)
  - error_message (text)
  - payload_snapshot (jsonb)
  - correlation_id (uuid)
  - created_at (timestamptz)
```

**Purpose:** Tracks processed Stripe webhook events
**Idempotency:** Uses `stripe_event_id` as unique identifier
**Pattern:** Check before processing, record success/failure

---

### **3. Event Creation Idempotency** ✅
**Table:** `events.events`
**Column:** `idempotency_key` (text, unique index)
**Function:** `get_event_by_idempotency_key(p_idempotency_key TEXT)`
**Pattern:** Unique constraint prevents duplicate events

---

### **4. Wallet Transaction Idempotency** ✅
**Table:** `payments.wallet_transactions`
**Column:** `idempotency_key` (text, unique index)
**Pattern:** Unique index prevents duplicate transactions

---

## ❌ **What's Missing**

### **Stripe API Call Idempotency Tracking**
- ❌ No table tracking idempotency keys sent to Stripe API
- ❌ No way to check if checkout session creation already completed
- ❌ No way to retrieve Stripe resource ID for idempotent retries
- ❌ No operation type + operation ID uniqueness enforcement

**Current Flow (Incomplete):**
```
1. Generate idempotency key
2. Send to Stripe API
3. ❌ No database record
4. On retry → ❌ Can't check if already completed
```

---

## 🎯 **Proposed Solution**

### **New Table: `public.stripe_idempotency_keys`**

**Why it's needed:**
- ✅ Tracks Stripe API operations (not just webhooks)
- ✅ Enforces uniqueness per operation type + operation ID
- ✅ Stores Stripe resource IDs for idempotent retries
- ✅ Complements existing `stripe_webhook_events` table

**How it differs from existing:**
- `idempotency_keys`: General API responses (JSON replay)
- `stripe_webhook_events`: Webhook event processing
- `stripe_idempotency_keys`: **Stripe API call tracking** (NEW)

**They work together:**
- `stripe_idempotency_keys` tracks what we SEND to Stripe
- `stripe_webhook_events` tracks what we RECEIVE from Stripe

---

## ✅ **Recommendation: Additive Approach**

Since `stripe_idempotency_keys` doesn't exist yet, we can safely add it:

1. ✅ **Create new table** (`stripe_idempotency_keys`)
2. ✅ **Keep existing tables** (no breaking changes)
3. ✅ **Update key generation** to include UUID
4. ✅ **Gradually integrate** into checkout flows

**Benefits:**
- Non-invasive (doesn't affect existing code)
- Can roll out incrementally
- Better observability
- Enforces uniqueness at database level

---

## 📋 **Implementation Plan**

### **Step 1: Create Table** ✅ (Already done)
- Migration file: `20250128_stripe_idempotency_keys.sql`

### **Step 2: Update Key Generation**
- Enhanced `generateIdempotencyKey()` function ✅ (Already done)
- Format: `operation_type:stable_id:UUID`

### **Step 3: Integrate into Checkout Flows**
- Update `enhanced-checkout` ✅ (Already started)
- Update `guest-checkout` ✅ (Already started)
- Update other Stripe operations (optional)

### **Step 4: Add Idempotency Checking**
- Check before Stripe API call
- Record after successful call
- Use stored resource ID on retry

---

## 🚀 **Ready to Proceed**

The audit confirms:
- ✅ No conflicts with existing tables
- ✅ New table is complementary (not redundant)
- ✅ Can be added safely

**Next:** Should we proceed with the implementation, or modify the plan based on your preferences?

