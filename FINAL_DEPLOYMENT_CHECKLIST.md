# 🚀 Final Deployment Checklist

## Functions That Need to Be Deployed:

### 1. stripe-webhook ⚠️ CRITICAL
**Why:** Fixed `constructEventAsync` + better error logging
```bash
npx supabase functions deploy stripe-webhook
```

### 2. guest-checkout ✅ ALREADY DEPLOYED
**Why:** Fixed `reserve_tickets_batch` parameters + removed `application_fee_amount`

### 3. enhanced-checkout ✅ READY
**Why:** Fixed `reserve_tickets_batch` parameters
```bash
npx supabase functions deploy enhanced-checkout
```

---

## After Deployment:

### Test with Stripe Dashboard:
1. Go to Stripe Dashboard → Webhooks
2. Find your webhook
3. Click "Send test webhook"
4. Select `checkout.session.completed`
5. **Edit the test data** to use a real session ID from your database

OR (Better):

### Test with Real Purchase:
1. Start fresh purchase in your app
2. Complete payment
3. Watch Supabase logs for:
   - `[STRIPE-WEBHOOK] Order found`
   - `[PROCESS-PAYMENT] Order found`
   - `[PROCESS-PAYMENT] Tickets created`

---

## Expected Flow:

```
User completes payment in Stripe
    ↓
Stripe sends webhook → stripe-webhook function
    ↓
stripe-webhook finds order by stripe_session_id
    ↓
stripe-webhook calls process-payment
    ↓
process-payment marks order as paid
    ↓
process-payment creates tickets with QR codes
    ↓
process-payment sends confirmation email
    ↓
User sees tickets in their wallet
```

---

## Current Status:

- ✅ Orders being created with correct stripe_session_id
- ✅ Webhook receiving events (200 OK)
- ⚠️ Webhook finding orders (needs deployment + testing)
- ⏳ Tickets creation (pending webhook success)

**Deploy stripe-webhook now and test!**

