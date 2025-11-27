# 🔧 Fix: Enhanced-Checkout 500 Error

## 🐛 Problem
`enhanced-checkout` Edge Function is returning a 500 error when calling `check_stripe_idempotency`.

**Error:** `POST .../enhanced-checkout 500 (Internal Server Error)`

## 🔍 Root Cause
The `check_stripe_idempotency` function returns a `TABLE`, which means it returns an array. However:
1. The Edge Function code expects a single object
2. The function has a bug: `IF NOT FOUND` doesn't work with `RETURN QUERY`

## ✅ Solution
Created a fix migration that changes the function to return `JSONB` instead of `TABLE`:
- **File:** `supabase/migrations/20250128_fix_stripe_idempotency_function.sql`
- **Change:** Returns a single JSONB object instead of a TABLE (array)

## 🚀 Deployment Steps

1. **Deploy the fix migration:**
   ```sql
   -- Run in Supabase SQL Editor:
   -- Copy contents of: supabase/migrations/20250128_fix_stripe_idempotency_function.sql
   ```

2. **Verify the function works:**
   ```sql
   SELECT public.check_stripe_idempotency('checkout:create', 'test-id');
   -- Should return: {"is_completed": false, ...}
   ```

3. **Test checkout again** - should work now!

---

**Status:** Ready to deploy fix migration ✅

