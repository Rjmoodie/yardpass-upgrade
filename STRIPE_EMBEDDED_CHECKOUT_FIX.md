# 🛠️ Stripe Embedded Checkout - Complete Fix Guide

## 🔍 **What We Found**

Your system was working with the old Stripe checkout, but **Stripe Embedded Checkout** uses a different webhook flow:

### **Old Flow (Hosted Checkout):**
```
User completes checkout
  ↓
checkout.session.completed webhook fired
  ↓
Webhook finds order by stripe_session_id
  ↓
Processes payment & sends email ✅
```

### **New Flow (Embedded Checkout):**
```
User completes checkout in embedded form
  ↓
payment_intent.succeeded webhook fired (DIFFERENT EVENT!)
  ↓
Webhook needs to find order by checkout_session_id (not stripe_session_id)
  ↓
Processes payment & sends email ✅
```

---

## ✅ **What I Fixed in the Code**

### **1. Updated `stripe-webhook/index.ts`**

**Changes:**
- ✅ Now handles BOTH `checkout.session.completed` AND `payment_intent.succeeded`
- ✅ For embedded checkout, extracts `checkout_session_id` from payment intent metadata
- ✅ Queries orders table by the correct field (`checkout_session_id` for embedded)
- ✅ Better error logging with helpful hints
- ✅ Shows webhook secret prefix for debugging

**Key Code Change:**
```typescript
if (event.type === "payment_intent.succeeded") {
  const paymentIntent = event.data.object;
  const checkoutSessionId = paymentIntent.metadata?.checkout_session_id;
  
  // Query by checkout_session_id field (not stripe_session_id)
  const order = await supabase
    .from("orders")
    .eq("checkout_session_id", checkoutSessionId)
    .single();
}
```

---

## 🚀 **Deployment Steps**

### **Step 1: Deploy Updated Webhook**

```bash
cd /Users/rod/Desktop/yard_pass/liventix/liventix-upgrade/liventix-upgrade

# Login to Supabase (if not already logged in)
supabase login

# Deploy the updated webhook function
supabase functions deploy stripe-webhook
```

### **Step 2: Configure Stripe Webhook Secret**

1. **Get the signing secret:**
   - Go to: https://dashboard.stripe.com/test/webhooks
   - Find your webhook endpoint
   - Click "Reveal" next to "Signing secret"
   - Copy the entire secret (starts with `whsec_`)

2. **Add to Supabase:**
   - Go to: Supabase Dashboard > Settings > Edge Functions > Secrets
   - Add/Update: `STRIPE_WEBHOOK_SECRET`
   - Paste the `whsec_...` value
   - Click **Save**

### **Step 3: Update Stripe Webhook Events**

Make sure your webhook listens to BOTH events:

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click on your webhook endpoint
3. Click "Add events"
4. Select these events:
   - ✅ `checkout.session.completed`
   - ✅ `payment_intent.succeeded` ← **ADD THIS!**
5. Click "Add events"

---

## 🧪 **Testing After Fix**

### **Test 1: Make a New Purchase**

1. Go to your event page
2. Click "Get Tickets"
3. Complete the embedded checkout form
4. Submit payment with test card: `4242 4242 4242 4242`

### **Test 2: Check Logs**

After purchase, check Supabase logs for:

**✅ Success Flow:**
```
[STRIPE-WEBHOOK] ✅ Event verified successfully
[STRIPE-WEBHOOK] Processing payment_intent.succeeded
[STRIPE-WEBHOOK] Querying order - field: checkout_session_id
[STRIPE-WEBHOOK] Order found - orderId: xxx
[STRIPE-WEBHOOK] Calling process-payment function
[PROCESS-PAYMENT] ✅ Purchase confirmation email sent successfully
```

**❌ If Still Failing:**
```
[STRIPE-WEBHOOK] ❌ Webhook signature verification failed
  → Check: STRIPE_WEBHOOK_SECRET is correct
  → Verify: Secret matches the one in Stripe Dashboard
```

### **Test 3: Check Your Email**

You should receive an email with:
- ✅ Purchase confirmation
- ✅ Event details
- ✅ Ticket QR code
- ✅ PDF attachment

---

## 🔧 **Manual Processing for Failed Orders**

If you have orders that failed before the fix, manually process them:

```sql
-- 1. Find your recent order
SELECT 
  id,
  stripe_session_id,
  checkout_session_id,
  status,
  contact_email
FROM orders
WHERE event_id = 'd98755ff-6996-4b8e-85b1-25e9323dd2ee'
ORDER BY created_at DESC
LIMIT 5;
```

Then call process-payment via Supabase Dashboard:

**Edge Functions > process-payment > Invoke**
```json
{
  "sessionId": "cs_test_YOUR_STRIPE_SESSION_ID"
}
```

Or use the resend-confirmation function:

**Edge Functions > resend-confirmation > Invoke**
```json
{
  "orderId": "YOUR_ORDER_UUID"
}
```

---

## 📋 **Complete Checklist**

- [ ] Deploy updated `stripe-webhook` function
- [ ] Add `STRIPE_WEBHOOK_SECRET` to Supabase secrets
- [ ] Add `payment_intent.succeeded` event to Stripe webhook
- [ ] Test with a new purchase
- [ ] Verify email received
- [ ] Manually process any failed orders (optional)

---

## 🐛 **Troubleshooting**

### Issue: "Webhook signature verification failed"
**Solution:** The webhook secret doesn't match
- Get secret from: https://dashboard.stripe.com/test/webhooks
- Update in: Supabase Dashboard > Edge Functions > Secrets
- Make sure you copied the FULL secret (starts with `whsec_`)

### Issue: "Order not found for checkout_session_id"
**Solution:** The payment intent metadata might be missing
- Check: Stripe Dashboard > Payments > Find your payment intent
- Verify: metadata has `checkout_session_id` field
- If missing: The enhanced-checkout function might not have set it

### Issue: Email still not sending
**Solution:** Check if `RESEND_API_KEY` is configured
- Supabase Dashboard > Edge Functions > Secrets
- Add: `RESEND_API_KEY` (get from https://resend.com)

---

## 📊 **What Changed with Embedded Checkout**

| Aspect | Old (Hosted) | New (Embedded) |
|--------|--------------|----------------|
| **Webhook Event** | `checkout.session.completed` | `payment_intent.succeeded` |
| **Order Lookup** | By `stripe_session_id` | By `checkout_session_id` |
| **Session ID Source** | `session.id` | `payment_intent.metadata.checkout_session_id` |
| **UI** | Redirect to Stripe | Embedded in your app |

The code now handles **both** flows seamlessly! 🎉

