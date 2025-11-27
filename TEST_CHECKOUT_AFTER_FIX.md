# 🧪 Test Checkout After Idempotency Fix

## ✅ Fix Deployed
The `check_stripe_idempotency` function has been fixed and deployed.

## 🧪 Testing Steps

### **1. Test Normal Checkout:**
- Go to an event page
- Click "Get Tickets"
- Complete checkout flow
- **Expected:** Checkout should work without 500 error

### **2. Check Function Logs:**
- Go to Supabase Dashboard → Edge Functions → `enhanced-checkout` → Logs
- Look for:
  - `[enhanced-checkout] Idempotency check failed (continuing):` (should NOT appear)
  - `[enhanced-checkout] Creating Stripe checkout session...`
  - `[enhanced-checkout] Stripe session created:`

### **3. Verify Database Record:**
```sql
-- Check if idempotency record was created
SELECT 
  operation_type,
  operation_id,
  stripe_resource_id,
  created_at
FROM public.stripe_idempotency_keys 
ORDER BY created_at DESC 
LIMIT 5;
```

### **4. Test Idempotent Retry (Optional):**
- Try to create the same checkout again with the same `checkoutSessionId`
- **Expected:** Should return existing session (idempotent)

---

## 🐛 If Issues Persist

### **Check Edge Function Logs:**
1. Supabase Dashboard → Edge Functions → `enhanced-checkout`
2. Click "Logs" tab
3. Look for error messages

### **Common Issues:**
- **If function not found:** Verify migration ran successfully
- **If permission denied:** Check GRANT statement in migration
- **If wrong return type:** Verify function signature matches code

---

**Ready to test!** 🚀

