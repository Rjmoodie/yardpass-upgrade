# 🚨 URGENT: Fix Checkout 500 Error

**Current Status:** Checkout is BROKEN (500 error)  
**Cause:** PostgREST schema cache doesn't see `cart_snapshot` column  
**Fix Time:** 2-3 minutes

---

## ⚡ **IMMEDIATE FIX (Run These Commands)**

### **Option 1: Full Restart (Recommended)**

```bash
# Navigate to project
cd /Users/rod/Desktop/yard_pass/liventix/liventix-upgrade/liventix-upgrade

# Stop Supabase (refreshes cache)
supabase stop

# Start Supabase
supabase start

# Redeploy checkout functions
supabase functions deploy enhanced-checkout --no-verify-jwt
supabase functions deploy guest-checkout --no-verify-jwt
```

**Time:** 2-3 minutes

---

### **Option 2: Temporary Workaround (Fastest)**

If you can't restart right now, **remove cart_snapshot temporarily**:

Open: `supabase/functions/_shared/checkout-session.ts`

**Change line 99 from:**
```typescript
cart_snapshot: payload.cartSnapshot ?? null, // ✅ Column exists, safe to include
```

**To:**
```typescript
// cart_snapshot: payload.cartSnapshot ?? null, // Temporarily disabled due to cache
```

**Then redeploy:**
```bash
supabase functions deploy enhanced-checkout --no-verify-jwt
supabase functions deploy guest-checkout --no-verify-jwt
```

**This will make checkout work immediately** (but without cart audit trail).

---

## 🔍 **Why This Happened**

**Database says:**
```
✅ cart_snapshot column EXISTS (you just verified it!)
```

**PostgREST says:**
```
❌ PGRST204: Column not found in schema cache
```

**Problem:**
- PostgREST caches table schemas
- Your migration added the column
- Cache hasn't refreshed yet
- Edge Functions get schema from PostgREST → see stale cache

**Solution:**
- Restart Supabase → cache refreshes
- Redeploy functions → see new schema

---

## 🧪 **How to Test After Fix**

1. **Refresh browser** (`Cmd + Shift + R`)
2. Go to an event with tickets
3. Click "Get Tickets"
4. Select a ticket tier
5. Click "Continue to Checkout"

**Expected:**
```
✅ Tickets reserved successfully
✅ Stripe session created
✅ Checkout session ready
✅ Stripe Checkout loads (embedded)
```

**Before fix:**
```
❌ Edge Function returned a non-2xx status code
```

---

## 📊 **Current Flow (What's Working/Broken)**

**✅ Working:**
1. Event lookup
2. Ticket reservation (30-min hold)
3. Stripe session creation
4. Order creation

**❌ Broken (line causing 500):**
5. Checkout session save → **PGRST204 error**
6. Edge Function crashes
7. User sees 500 error

**After fix:**
- ✅ All 6 steps work
- ✅ Checkout completes
- ✅ User can buy tickets

---

## 🎯 **QUICK ACTION PLAN**

**Choose one:**

### **A. Full Fix (3 minutes, permanent)**
```bash
supabase stop
supabase start
supabase functions deploy enhanced-checkout --no-verify-jwt
supabase functions deploy guest-checkout --no-verify-jwt
```

### **B. Temporary Fix (30 seconds, works now)**
Comment out line 99 in `checkout-session.ts`:
```typescript
// cart_snapshot: payload.cartSnapshot ?? null,
```
Then deploy:
```bash
supabase functions deploy enhanced-checkout --no-verify-jwt
supabase functions deploy guest-checkout --no-verify-jwt
```

---

## 💡 **Recommendation**

**Do Option A (full fix)** - it's only 3 minutes and solves it permanently.

**Why:**
- ✅ Proper solution
- ✅ Full audit trail (cart_snapshot saved)
- ✅ No technical debt

---

**Run the commands to fix checkout NOW!** 🚀


