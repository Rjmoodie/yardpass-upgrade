# 🎯 Stripe Idempotency Implementation Plan (Post-Audit)

## ✅ **Audit Results Summary**

### **What Exists:**
1. ✅ `public.idempotency_keys` - General API idempotency
2. ✅ `public.stripe_webhook_events` - Webhook processing tracking
3. ✅ Event creation idempotency (events.events.idempotency_key)
4. ✅ Wallet transaction idempotency

### **What's Missing:**
- ❌ No tracking of Stripe API idempotency keys (checkout sessions, payouts, etc.)
- ❌ No way to check if operation already completed before calling Stripe
- ❌ No stored Stripe resource IDs for idempotent retries

---

## 📋 **Implementation Strategy**

### **Phase 1: Database Layer** ✅ Ready
- Migration: `20250128_stripe_idempotency_keys.sql`
- Creates table, functions, indexes
- Non-invasive (new table only)

### **Phase 2: Key Generation Enhancement** ✅ Ready
- Updated `generateIdempotencyKey()` function
- Format: `operation_type:stable_id:UUID`
- Backwards compatible (legacy function still works)

### **Phase 3: Integration** 🔄 Next Steps

#### **3.1: Update Enhanced Checkout** (Partially Done)
- ✅ Updated key generation format
- ⏳ Add idempotency check before Stripe call
- ⏳ Record idempotency after successful call

#### **3.2: Update Guest Checkout** (Partially Done)
- ✅ Updated key generation format
- ⏳ Add idempotency check before Stripe call
- ⏳ Record idempotency after successful call

#### **3.3: Optional - Other Operations**
- Payout creation
- Refund creation
- Other Stripe operations

---

## 🔧 **Integration Pattern**

### **Before Stripe API Call:**
```typescript
// Check if operation already completed
const { data: existing } = await supabaseService
  .rpc('check_stripe_idempotency', {
    p_operation_type: 'checkout:create',
    p_operation_id: checkoutSessionId
  });

if (existing?.is_completed && existing?.stripe_resource_id) {
  // Already completed, return existing resource
  return { session_id: existing.stripe_resource_id };
}
```

### **After Stripe API Call:**
```typescript
// Record successful operation
await supabaseService.rpc('record_stripe_idempotency', {
  p_operation_type: 'checkout:create',
  p_operation_id: checkoutSessionId,
  p_stripe_idempotency_key: idempotencyKey,
  p_stripe_resource_id: session.id, // Returned from Stripe
  p_user_id: userId,
  p_metadata: { event_id: eventId }
});
```

---

## 🎯 **Decision Point**

### **Option A: Full Integration** (Recommended)
- ✅ Add idempotency checks to checkout flows
- ✅ Record all Stripe API operations
- ✅ Better reliability and observability

### **Option B: Database Only**
- ✅ Just create the table
- ⏳ Use it manually when needed
- ⏳ No automatic integration

### **Option C: Minimal**
- ✅ Just create the table
- ✅ Update key generation format
- ⏳ Skip integration (use existing patterns)

---

## 📊 **Recommended Approach**

**Option A: Full Integration** because:
1. ✅ Database table already created
2. ✅ Helper functions already created
3. ✅ Key generation already updated
4. ✅ Just need to add 2 RPC calls per checkout flow
5. ✅ Provides maximum protection against duplicates

---

**Which approach would you prefer?** 

**Or should we:**
- Deploy the migration first?
- Test the new table?
- Then integrate gradually?

