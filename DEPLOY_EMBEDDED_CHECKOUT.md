# Deploy Embedded Checkout - Quick Guide 🚀

## ⚠️ **Current Issue**

The edge function is returning the **old format**:
```json
{
  "session_url": "https://checkout.stripe.com/...",  // Old (hosted)
  // Missing: "client_secret"  ❌
}
```

But the frontend expects the **new format**:
```json
{
  "session_url": "https://checkout.stripe.com/...",
  "client_secret": "cs_test_...",  // ✅ For embedded checkout
}
```

---

## ✅ **Solution: Deploy Edge Function**

### **Step 1: Deploy enhanced-checkout**
```bash
cd "C:\Users\Louis Cid\Yardpass 3.0\liventix-upgrade"
npx supabase functions deploy enhanced-checkout
```

### **Step 2: Verify Deployment**
Check Supabase Dashboard → Edge Functions → enhanced-checkout  
Should show: "Last deployed: just now"

### **Step 3: Test**
```bash
# Refresh browser completely
Ctrl + Shift + R

# Try purchasing tickets
# Should now see embedded checkout!
```

---

## 🔍 **What the Deployment Changes**

**Updated Code** (in `supabase/functions/enhanced-checkout/index.ts`):

```typescript
// Line 333: Enable embedded mode
ui_mode: "embedded",  // ← This makes Stripe return client_secret

// Line 339: Use return_url for embedded
return_url: `${siteUrl}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,

// Line 484: Return client_secret to frontend
return {
  session_url,
  client_secret: session.client_secret,  // ← NEW!
  checkout_session_id,
  expires_at,
  ...
};
```

---

## 📊 **Expected Result**

### **After Deployment:**

**Console log will show**:
```
🔍 Enhanced checkout response: {
  data: {
    session_id: "cs_test_...",
    session_url: "https://...",
    client_secret: "cs_test_..."  ✅ PRESENT!
  }
}
```

**UI will show**:
```
1. Select tickets
2. Click "Proceed to payment"
3. Timer appears at top: 🕐 29:45
4. Stripe form embeds (no redirect!)
5. Payment completes on Liventix
```

---

## 🐛 **Current Error Explained**

```
Response keys: session_id, session_url, order_id, checkout_session_id, expires_at, pricing, destination_account
```

**Missing**: `client_secret`

**Why**: The old (undeployed) edge function doesn't include it.

**Fix**: Deploy the updated function! ☝️

---

## ✅ **Deployment Commands (All At Once)**

```bash
# Navigate to project
cd "C:\Users\Louis Cid\Yardpass 3.0\liventix-upgrade"

# Deploy edge function
npx supabase functions deploy enhanced-checkout

# Deploy migrations (if not done)
npx supabase db execute --file supabase/migrations/20250131000004_ticket_accounting_fixes.sql

# Restart dev server
npm run dev
```

Then test purchasing - should work perfectly! 🎉

---

## 🎯 **Summary**

**Problem**: Edge function not deployed (old code running)  
**Solution**: Run `npx supabase functions deploy enhanced-checkout`  
**Result**: Will return `client_secret`, embedded checkout works!  

**Deploy now and test!** 🚀

