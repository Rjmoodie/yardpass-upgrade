# 🔍 Two `checkout_sessions` Tables - Which is Correct?

**Discovery:** You have **TWO** tables named `checkout_sessions` in different schemas!

---

## 📊 **Table Comparison**

### **Table 1: `public.checkout_sessions` (12 columns)**

**Columns:**
```
id, user_id, session_id, event_id, started_at, completed_at,
total_cents, total_quantity, stripe_session_id, hour_bucket,
tier_ids, created_at
```

**Purpose:** Analytics / Session Tracking
- Tracks checkout session **metrics**
- Aggregated data (total_cents, total_quantity)
- Time bucketing (hour_bucket)
- Looks like it's for **analytics dashboards**

**Missing:**
- ❌ `order_id` (no link to orders table)
- ❌ `contact_snapshot` (no customer info)
- ❌ `pricing_snapshot` (no pricing breakdown)
- ❌ `verification_state` (no fraud checks)
- ❌ `hold_ids` (no ticket holds)
- ❌ `expires_at` (no expiration tracking)
- ❌ `status` (no state machine)

**Use case:** "How many checkout sessions happened today?"

---

### **Table 2: `ticketing.checkout_sessions` (15 columns)**

**Columns:**
```
id, order_id, user_id, event_id, status, hold_ids,
pricing_snapshot, contact_snapshot, verification_state,
express_methods, cart_snapshot, stripe_session_id,
expires_at, created_at, updated_at
```

**Purpose:** Operational / Checkout Flow
- Tracks each **individual checkout attempt**
- Links to `orders` table (order_id)
- Links to ticket holds (hold_ids)
- Stores customer info (contact_snapshot)
- Tracks pricing breakdown (pricing_snapshot)
- Tracks status (pending, completed, abandoned)
- Expiration tracking (expires_at)

**Use case:** "Show me this specific checkout session's details"

---

## 🎯 **Which One Should Edge Functions Use?**

### **Your Code Expects:**
```typescript
await supabase.from('checkout_sessions').upsert({
  order_id,          // ❌ Not in public table!
  hold_ids,          // ❌ Not in public table!
  contact_snapshot,  // ❌ Not in public table!
  pricing_snapshot,  // ❌ Not in public table!
  verification_state,// ❌ Not in public table!
  express_methods,   // ❌ Not in public table!
  cart_snapshot,     // ❌ Not in public table!
  expires_at,        // ❌ Not in public table!
  status,            // ❌ Not in public table!
  // ...
});
```

**Verdict:** Your code needs `ticketing.checkout_sessions` (not `public.checkout_sessions`)

---

## 🚨 **Why "Wrong" Table?**

**It's not that `public.checkout_sessions` is "bad"** - it's just:
- ✅ Different purpose (analytics vs. operational)
- ❌ Missing fields your code needs
- ❌ Different schema (incompatible)

**It's like:**
- `public.checkout_sessions` = Summary report table
- `ticketing.checkout_sessions` = Detailed transaction table

**Your Edge Functions need the detailed one!**

---

## ✅ **THE FIX**

### **Option 1: Use RPC (My Recommended Fix)**

Already created migration with RPC function that targets `ticketing.checkout_sessions`:

```sql
-- This RPC explicitly uses ticketing schema
CREATE FUNCTION public.upsert_checkout_session(...)
SET search_path = ticketing, public  -- ✅ Uses ticketing first!
AS $$
BEGIN
  INSERT INTO ticketing.checkout_sessions (...) VALUES (...);
END;
$$;
```

**Run:**
```bash
supabase db push  # Apply RPC migration
supabase functions deploy enhanced-checkout --no-verify-jwt
supabase functions deploy guest-checkout --no-verify-jwt
```

---

### **Option 2: Specify Schema in Code**

Change Edge Functions to explicitly use `ticketing` schema:

```typescript
// Before (defaults to public):
await supabase.from('checkout_sessions').upsert(...)

// After (uses ticketing):
await supabase.schema('ticketing').from('checkout_sessions').upsert(...)
```

**But this won't work because:**
- ❌ `ticketing` schema not exposed to PostgREST
- ❌ Would need to expose entire schema (security risk)

---

### **Option 3: Create View in Public Schema**

Create `public.checkout_sessions` view → `ticketing.checkout_sessions`:

```sql
DROP TABLE public.checkout_sessions;  -- Delete old analytics table
CREATE VIEW public.checkout_sessions AS 
SELECT * FROM ticketing.checkout_sessions;
```

**Issues:**
- ⚠️ Loses old analytics data
- ⚠️ Views need INSTEAD OF triggers for INSERT/UPDATE
- ⚠️ More complexity

---

## 🎯 **My Strong Recommendation: Option 1 (RPC)**

**Why:**
- ✅ Works immediately (no schema exposure)
- ✅ Keeps both tables (don't lose analytics data)
- ✅ Explicitly targets correct schema
- ✅ No PostgREST cache issues
- ✅ Clean separation

---

## 📋 **What to Do Right Now**

**Run these 3 commands:**

```bash
# 1. Apply RPC migration
supabase db push

# 2. Deploy enhanced-checkout (uses RPC)
supabase functions deploy enhanced-checkout --no-verify-jwt

# 3. Deploy guest-checkout (uses RPC)
supabase functions deploy guest-checkout --no-verify-jwt
```

**Time:** 2 minutes  
**Result:** Checkout works!

---

## 📊 **Summary**

| Table | Schema | Columns | Purpose | Correct for Checkout? |
|-------|--------|---------|---------|----------------------|
| `checkout_sessions` | `public` | 12 | Analytics | ❌ No (missing fields) |
| `checkout_sessions` | `ticketing` | 15 | Operations | ✅ Yes (has all fields) |

**Your code needs the `ticketing` one. RPC function fixes this!** 🎯

---

**Ready to apply the fix?** 🚀

