# 🎫 Complete Checkout Flow - All Edge Functions

## Overview

The ticket purchase flow involves **5 Edge Functions** working together. Here's the complete sequence:

---

## 📊 **The Complete Flow**

```
┌──────────────────────────────────────────────────────────────┐
│ 1. USER CLICKS "PROCEED TO PAYMENT"                          │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. FRONTEND → enhanced-checkout Edge Function                │
│                                                               │
│    Input:                                                     │
│    - eventId                                                  │
│    - ticketSelections: [{ tierId, quantity, faceValue }]     │
│    - userId (optional)                                        │
│                                                               │
│    Actions:                                                   │
│    ✅ Validate event exists                                  │
│    ✅ Reserve tickets (create holds)                         │
│    ✅ Create order record (status: 'pending')                │
│    ✅ Create checkout_session record                         │
│    ✅ Create Stripe Checkout Session                         │
│                                                               │
│    Output:                                                    │
│    - client_secret (for Stripe Embedded Checkout)            │
│    - checkout_session_id                                     │
│    - expires_at                                              │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. USER COMPLETES PAYMENT IN STRIPE                          │
│                                                               │
│    - Fills in card: 4242 4242 4242 4242                      │
│    - Clicks "Pay" button                                     │
│    - Stripe processes payment                                │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. STRIPE → stripe-webhook Edge Function                     │
│                                                               │
│    Stripe sends TWO webhook events:                          │
│    📨 checkout.session.completed                            │
│    📨 payment_intent.succeeded                              │
│                                                               │
│    Actions (for EACH webhook):                               │
│    ✅ Verify webhook signature                              │
│    ✅ Find order by stripe_session_id                        │
│    🔒 ATOMIC: Update order status to 'paid' (only if pending)│
│    ✅ If update succeeds → Continue                          │
│    ❌ If update fails → Skip (another webhook already did it)│
│    ✅ Call process-payment function                          │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. stripe-webhook → process-payment Edge Function            │
│                                                               │
│    Input:                                                     │
│    - sessionId (Stripe session ID)                           │
│                                                               │
│    Actions:                                                   │
│    ✅ Find order by stripe_session_id                        │
│    ✅ Call ensure-tickets function                           │
│    ✅ Get user email from auth.users                         │
│    ✅ Call send-purchase-confirmation function               │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. process-payment → ensure-tickets Edge Function            │
│                                                               │
│    Input:                                                     │
│    - orderId                                                  │
│                                                               │
│    Actions:                                                   │
│    ✅ Check if tickets already created (idempotency)         │
│    ✅ Convert holds to tickets                               │
│    ✅ Update inventory counts                                │
│    ✅ Set order status to 'paid'                             │
│                                                               │
│    Output:                                                    │
│    - issued: count of tickets created                        │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 7. process-payment → send-purchase-confirmation Edge Function│
│                                                               │
│    Input:                                                     │
│    - customerName, customerEmail                             │
│    - eventTitle, eventDate, eventLocation                    │
│    - ticketIds (array)                                       │
│    - orderId                                                  │
│    - quantity, totalAmount                                   │
│                                                               │
│    Actions:                                                   │
│    ✅ Fetch tickets from database                            │
│    ✅ Generate QR codes for each ticket                      │
│    ✅ Create PDF with tickets + QR codes                     │
│    ✅ Generate HTML email                                    │
│    ✅ Send via Resend API with PDF attachment                │
│                                                               │
│    Output:                                                    │
│    - Resend email ID                                         │
└──────────────────────────────────────────────────────────────┘
                          ↓
                    📧 EMAIL SENT!
```

---

## 🚨 **Why You're Not Getting Emails on Localhost**

### The Problem:

```
YOU (localhost)              STRIPE                 YOUR SERVER
     │                         │                         │
     │  1. Create checkout     │                         │
     ├────────────────────────>│                         │
     │                         │                         │
     │  2. Complete payment    │                         │
     ├────────────────────────>│                         │
     │                         │                         │
     │                         │  3. Send webhook        │
     │                         ├────────────────────────>│
     │                         │    ❌ Can't reach      │
     │                         │       localhost!        │
     │                         │                         │
     │  4. NO EMAIL ❌        │                         │
```

**Stripe webhooks go to PRODUCTION URL**, not localhost!

---

## 🔧 **Solutions**

### Option 1: Test on Production (Easiest)

```bash
# Make sure all functions are deployed
supabase functions deploy stripe-webhook
supabase functions deploy process-payment
supabase functions deploy send-purchase-confirmation
supabase functions deploy ensure-tickets
supabase functions deploy enhanced-checkout

# Then test on production URL (not localhost)
```

### Option 2: Use Stripe CLI to Forward Webhooks

```bash
# Terminal 1: Forward webhooks to LOCAL Supabase
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook

# It will output a webhook secret like:
# > Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx

# Copy that secret and set it in Supabase:
# Dashboard → Settings → Edge Functions → Secrets
# Key: STRIPE_WEBHOOK_SECRET
# Value: whsec_xxxxxxxxxxxxx

# Terminal 2: Run your local dev server
npm run dev

# Now make a purchase on localhost
# Stripe CLI will forward the webhook
```

---

## 📋 **All Checkout Edge Functions**

### Required Functions (must be deployed):

| Function | Purpose | Called By |
|----------|---------|-----------|
| **enhanced-checkout** | Create Stripe session + reserve tickets | Frontend |
| **stripe-webhook** | Receive Stripe events | Stripe servers |
| **process-payment** | Create tickets + send email | stripe-webhook |
| **ensure-tickets** | Convert holds to tickets | process-payment |
| **send-purchase-confirmation** | Generate PDF + send email | process-payment |

### Optional Functions:

| Function | Purpose |
|----------|---------|
| **checkout-session-status** | Check session status |
| **get-order-status** | Get order details |
| **resend-confirmation** | Manually resend email |

---

## 🎯 **Deploy All Checkout Functions**

```bash
cd /Users/rod/Desktop/yard_pass/yardpass/yardpass-upgrade/yardpass-upgrade

# Deploy all checkout-related functions
supabase functions deploy enhanced-checkout
supabase functions deploy stripe-webhook
supabase functions deploy process-payment
supabase functions deploy ensure-tickets
supabase functions deploy send-purchase-confirmation

# Or deploy all at once
supabase functions deploy
```

---

## ✅ **How to Verify Everything Works**

### Step 1: Check Stripe Webhook Configuration

1. Go to: **Stripe Dashboard → Developers → Webhooks**
2. Verify you have an endpoint for:
   ```
   https://your-project.supabase.co/functions/v1/stripe-webhook
   ```
3. Events should include:
   - `checkout.session.completed`
   - `payment_intent.succeeded`

### Step 2: Test Full Flow on Production

1. Visit your production URL (not localhost)
2. Make a test purchase
3. Complete payment with test card: `4242 4242 4242 4242`
4. Check your email for **1 confirmation** (not 2!)

### Step 3: Check Logs

After purchase, check Supabase Edge Function logs:

**Expected logs (in order):**

```
[enhanced-checkout] Stripe session created
[STRIPE-WEBHOOK] Webhook received (checkout.session.completed)
[STRIPE-WEBHOOK] Order status updated to 'paid'
[PROCESS-PAYMENT] Tickets ensured
[PROCESS-PAYMENT] Purchase confirmation email sent
[STRIPE-WEBHOOK] Webhook received (payment_intent.succeeded)
[STRIPE-WEBHOOK] Order already processed ← FIX WORKING!
```

---

## 🐛 **Current Status of Your Orders**

```sql
Order 1 (7fecbfee): status=paid, tickets=2, emails=2 ❌ (old bug)
Order 2 (0a293c22): status=pending, tickets=0, emails=0 ❌ (payment not completed)
Order 3 (3bda5a52): status=pending, tickets=0, emails=0 ❌ (payment not completed)
```

**Orders 2 & 3 are abandoned** - checkout opened but payment never completed.

---

## 📝 **Quick Deployment Commands**

```bash
# Deploy the fix
cd /Users/rod/Desktop/yard_pass/yardpass/yardpass-upgrade/yardpass-upgrade

supabase functions deploy stripe-webhook
supabase functions deploy process-payment  
supabase functions deploy ensure-tickets
supabase functions deploy send-purchase-confirmation
supabase functions deploy enhanced-checkout
```

---

## 🎯 **Testing Checklist**

- [ ] All 5 functions deployed to production
- [ ] Stripe webhook configured with production URL
- [ ] Test purchase on **production** URL (not localhost)
- [ ] Complete payment with test card
- [ ] Receive **1 email** (not 2!)
- [ ] Check Supabase logs show "Order already processed" for second webhook

---

**Bottom Line:** You need to either:
1. **Test on production** (deploy + test on production URL), OR
2. **Set up Stripe CLI** to forward webhooks to localhost

The fix is correct, but webhooks can't reach localhost without Stripe CLI!





