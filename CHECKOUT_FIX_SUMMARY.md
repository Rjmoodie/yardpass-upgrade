# 🛒 Checkout 500 Error - Fix Summary

**Date:** November 11, 2025  
**Issue:** `enhanced-checkout` Edge Function returning 500 error  
**Root Cause:** Missing `cart_snapshot` column in `checkout_sessions` table  
**Status:** ✅ **Migration Created - Ready to Apply**

---

## 🚨 **The Error**

```
POST .../enhanced-checkout 500 (Internal Server Error)

[enhanced-checkout] error: PGRST204
Could not find the 'cart_snapshot' column of 'checkout_sessions' 
in the schema cache
```

---

## 🔍 **What Happened**

### **Successful Flow (Until the Bug):**
1. ✅ User clicked "Buy Ticket"
2. ✅ Event found in database
3. ✅ Tickets reserved (hold created)
4. ✅ Stripe checkout session created
5. ❌ **FAILED:** Saving checkout session to database

### **The Problem:**
```typescript
// Edge Function tries to save:
cart_snapshot: {
  items: [{ tier_id, quantity, unit_price_cents, tier_name }]
}

// But database says:
❌ Column 'cart_snapshot' not found!
```

**Why:**
- Column exists in `complete_database.sql` (master schema)
- Column might be missing from actual database
- PostgREST schema cache is outdated

---

## ✅ **The Fix**

### **Migration Created:**
```
supabase/migrations/20251111000005_fix_checkout_sessions_schema.sql
```

**What it does:**
1. ✅ Ensures `cart_snapshot JSONB` column exists
2. ✅ Sends `NOTIFY pgrst, 'reload schema'` to refresh cache
3. ✅ Verifies column exists after migration

---

## 🚀 **How to Apply**

### **Run this command:**
```bash
supabase db push
```

**Expected output:**
```
✅ Added cart_snapshot column to ticketing.checkout_sessions
✅ PostgREST schema cache notified to reload
✅ CHECKOUT SESSIONS SCHEMA FIX COMPLETE

⚡ Enhanced checkout should now work!
```

---

## 🧪 **Testing After Fix**

### **1. Apply Migration**
```bash
supabase db push
```

### **2. Restart Edge Functions (Important!)**
```bash
# Stop and restart Supabase services
supabase stop
supabase start
```

**Why restart?**
- Edge Functions cache schema
- Need fresh connection to see new column

### **3. Test Checkout Flow**

**In browser:**
1. Navigate to an event
2. Click "Get Tickets"
3. Select a ticket tier
4. Click "Continue to Checkout"
5. **Should open Stripe Checkout (not 500 error!)**

**Expected console logs:**
```
✅ Calling enhanced-checkout (authenticated)...
✅ Checkout response: { data: { client_secret: "present" } }
✅ Setting session data
✅ Checkout session ready
```

**Before fix:**
```
❌ startCheckout error: Edge Function returned a non-2xx status code
```

---

## 📊 **What Was Working**

Even with the error, these parts worked:
- ✅ Ticket reservation (30-minute hold)
- ✅ Stripe session creation
- ✅ Organizer lookup
- ✅ Pricing calculation

**Only the checkout session record save failed.**

---

## 🔒 **Why cart_snapshot Matters**

**Purpose:** Audit trail for what user tried to buy

**Data stored:**
```json
{
  "items": [
    {
      "tier_id": "uuid",
      "quantity": 2,
      "unit_price_cents": 2500,
      "tier_name": "General Admission"
    }
  ]
}
```

**Used for:**
- Order history
- Support inquiries
- Abandoned cart analysis
- Refund processing

---

## 🎯 **Impact**

**Before Fix:**
- ❌ **All authenticated checkouts fail** (500 error)
- ⚠️ Guest checkouts might work (different function)
- ❌ No tickets can be purchased by logged-in users

**After Fix:**
- ✅ Authenticated checkouts work
- ✅ Guest checkouts work
- ✅ All ticket purchases work
- ✅ Full audit trail saved

---

## 📁 **Files Involved**

**Edge Function:**
- `supabase/functions/enhanced-checkout/index.ts` (line 435)
  - Calls `upsertCheckoutSession()`

**Shared Utility:**
- `supabase/functions/_shared/checkout-session.ts` (line 99)
  - Tries to insert `cart_snapshot`

**Database Schema:**
- `complete_database.sql` (line 10704)
  - Defines `cart_snapshot JSONB` column

**Migration:**
- `supabase/migrations/20251111000005_fix_checkout_sessions_schema.sql`
  - ✅ **NEW - Fixes the issue**

---

## 🔄 **Next Steps**

1. **Apply migration:**
   ```bash
   supabase db push
   ```

2. **Restart Supabase:**
   ```bash
   supabase stop
   supabase start
   ```

3. **Test ticket purchase:**
   - Buy a ticket as logged-in user
   - Should work without 500 error

4. **Verify in database:**
   ```sql
   SELECT id, cart_snapshot 
   FROM ticketing.checkout_sessions 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

---

## ✅ **Expected Results**

**After applying migration:**
- ✅ Column exists
- ✅ PostgREST cache refreshed
- ✅ Checkout function works
- ✅ Users can buy tickets

**Console should show:**
- ✅ No more 500 errors
- ✅ Successful checkout creation
- ✅ Stripe embedded checkout loads

---

**Apply the migration to fix ticket purchases!** 🎫🚀


