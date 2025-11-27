# 🚀 Deploy Stripe Idempotency Edge Functions

## ✅ Migration Status
- ✅ **Migration Deployed:** `20250128_stripe_idempotency_keys.sql`

## 📋 Functions to Deploy

### **1. enhanced-checkout** ⚠️ REQUIRES DEPLOYMENT
- **Changes:** Added idempotency check before Stripe API call + recording after success
- **File:** `supabase/functions/enhanced-checkout/index.ts`

### **2. guest-checkout** ⚠️ REQUIRES DEPLOYMENT
- **Changes:** Added idempotency check before Stripe API call + recording after success
- **File:** `supabase/functions/guest-checkout/index.ts`

---

## 🚀 Deployment Commands

### **Option 1: Deploy Both Functions (Recommended)**

```bash
# Deploy enhanced-checkout
npx supabase@latest functions deploy enhanced-checkout --no-verify-jwt

# Deploy guest-checkout
npx supabase@latest functions deploy guest-checkout --no-verify-jwt
```

### **Option 2: Deploy All Functions**

```bash
# Deploy all Edge Functions (includes updated ones)
npx supabase@latest functions deploy --no-verify-jwt
```

---

## ✅ Verification

After deployment, test a checkout:

1. **Create a checkout** → Should create record in `stripe_idempotency_keys`
2. **Retry same checkout** → Should return existing session (idempotent)
3. **Check database:**
   ```sql
   SELECT * FROM public.stripe_idempotency_keys 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

---

**Ready to deploy!** 🚀

