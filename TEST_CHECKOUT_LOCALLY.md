# 🧪 How to Test Checkout Flow Locally

## The Problem

You're testing on `localhost:8080`, but Stripe webhooks can't reach localhost. That's why:
- ✅ Checkout session created
- ✅ Payment completes in Stripe
- ❌ Webhook never arrives
- ❌ No tickets created
- ❌ No email sent

---

## ✅ **Solution: Stripe CLI**

Use Stripe CLI to forward webhooks from Stripe to your localhost.

---

## 🚀 **Step-by-Step Setup** (10 minutes)

### Step 1: Install Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Or download from: https://stripe.com/docs/stripe-cli
```

### Step 2: Login to Stripe

```bash
stripe login
# This will open browser to authenticate
```

### Step 3: Forward Webhooks to Local Supabase

```bash
# Start forwarding webhooks
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook

# You'll see output like:
# > Ready! You are using Stripe API Version [2023-10-16]. 
# > Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxxxxx
```

**⚠️ IMPORTANT:** Copy the `whsec_xxxxx` secret!

### Step 4: Update Your Local Environment

The webhook secret from Stripe CLI is DIFFERENT from your production webhook secret.

**Option A: Update Supabase local secrets (Recommended)**

```bash
# In another terminal
cd /Users/rod/Desktop/yard_pass/liventix/liventix-upgrade/liventix-upgrade

# Create/update .env.local
echo "STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx" >> .env.local

# Restart Supabase functions to pick up new secret
supabase functions serve --no-verify-jwt
```

**Option B: Temporarily hardcode it (for testing)**

In `supabase/functions/stripe-webhook/index.ts`:

```typescript
// TEMPORARY - FOR LOCAL TESTING ONLY
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") 
  || "whsec_xxxxxxxxxxxxxxxxxxxxxxxx"; // Your CLI secret
```

### Step 5: Test the Complete Flow

**Terminal 1:** Stripe CLI forwarding
```bash
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
# Keep this running
```

**Terminal 2:** Your app
```bash
npm run dev
# Keep this running
```

**Terminal 3:** Supabase functions (if not already running)
```bash
supabase start
# Or if functions need restart:
supabase functions serve
```

**Browser:** 
1. Open `http://localhost:8080`
2. Click purchase
3. Complete payment with `4242 4242 4242 4242`
4. Watch Terminal 1 (Stripe CLI) - you'll see webhook events!

---

## 📊 **What You'll See**

### Terminal 1 (Stripe CLI):
```
2025-11-04 23:55:00   --> checkout.session.completed [evt_xxx]
2025-11-04 23:55:00   <-- [200] POST http://localhost:54321/functions/v1/stripe-webhook
2025-11-04 23:55:01   --> payment_intent.succeeded [evt_xxx]
2025-11-04 23:55:01   <-- [200] POST http://localhost:54321/functions/v1/stripe-webhook
```

### Supabase Edge Function Logs:
```
[STRIPE-WEBHOOK] Webhook received
[STRIPE-WEBHOOK] Order status updated to 'paid'
[PROCESS-PAYMENT] Tickets ensured
[PROCESS-PAYMENT] Purchase confirmation email sent
[STRIPE-WEBHOOK] Order already processed ← FIX WORKING!
```

### Your Email:
```
📧 1 email received (not 2!) ✅
```

---

## 🔍 **Troubleshooting**

### Issue: "Connection refused" in Stripe CLI

**Check:** Is Supabase running?
```bash
supabase status
# Should show: API URL: http://localhost:54321
```

### Issue: Webhook signature verification failed

**Fix:** Make sure the CLI secret matches your env var:
```bash
# The secret from:
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook

# Should be set in your environment
```

### Issue: Still no email

**Check:** Are all functions deployed locally?
```bash
# Check if functions are running
curl http://localhost:54321/functions/v1/stripe-webhook
# Should NOT return 404
```

### Issue: "Function not found"

**Fix:** Make sure Supabase is running:
```bash
supabase start
supabase functions serve
```

---

## 🎯 **Alternative: Test on Production**

If Stripe CLI is too complex, just test on production:

```bash
# 1. Deploy all functions
supabase functions deploy

# 2. Build and deploy frontend
npm run build
# Deploy to Vercel/Netlify/wherever

# 3. Test on production URL
# https://your-app.com
```

---

## 📋 **Verification Checklist**

After testing with Stripe CLI:

- [ ] Stripe CLI shows 2 webhook events (checkout.session.completed, payment_intent.succeeded)
- [ ] Both webhooks return 200 status
- [ ] Supabase logs show "Order already processed" for 2nd webhook
- [ ] Order status changes to 'paid'
- [ ] Tickets created (count matches quantity purchased)
- [ ] **1 email received** (not 2!)
- [ ] Email has PDF attachment with QR codes

---

## 🎉 **Expected Result**

With Stripe CLI running:

```
User clicks purchase
→ Checkout opens
→ User pays
→ Stripe CLI forwards webhook 1 → tickets created
→ Stripe CLI forwards webhook 2 → skipped (already processed) ✅
→ 1 email sent ✅
```

---

## 📝 **Commands Summary**

```bash
# Install (one time)
brew install stripe/stripe-cli/stripe

# Login (one time)
stripe login

# Every time you want to test:
# Terminal 1:
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook

# Terminal 2:
npm run dev

# Then test purchase on localhost
```

---

**TL;DR:** Use Stripe CLI to forward webhooks to localhost, OR test on production URL!





