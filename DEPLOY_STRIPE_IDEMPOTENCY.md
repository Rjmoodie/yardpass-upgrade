# 🚀 Deploy Stripe Idempotency Edge Functions

## ✅ Migration Status
**Deployed:** `20250128_stripe_idempotency_keys.sql` ✅

---

## 📋 Functions to Deploy

Two Edge Functions have been updated with idempotency checks:

1. **`enhanced-checkout`** ⚠️ **REQUIRES DEPLOYMENT**
   - Added idempotency check before Stripe API call
   - Records successful operations after API call

2. **`guest-checkout`** ⚠️ **REQUIRES DEPLOYMENT**
   - Added idempotency check before Stripe API call
   - Records successful operations after API call

---

## 🚀 Deployment Commands

### **Option 1: Deploy Both Functions (Recommended)**

```bash
npx supabase@latest functions deploy enhanced-checkout --no-verify-jwt
npx supabase@latest functions deploy guest-checkout --no-verify-jwt
```

### **Option 2: Deploy All Functions**

```bash
npx supabase@latest functions deploy --no-verify-jwt
```

---

## ✅ Verification After Deployment

1. **Test a checkout** → Should create record in `stripe_idempotency_keys`
2. **Check database:**
   ```sql
   SELECT * FROM public.stripe_idempotency_keys 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
3. **Retry same checkout** → Should return existing session (idempotent)

---

**Ready to deploy!** 🚀

