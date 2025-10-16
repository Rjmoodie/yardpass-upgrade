# 🔧 Stripe Webhook 401 Fix

## Problem
Stripe webhook is getting 401 Unauthorized even though `verify_jwt = false` is set in config.toml

## Root Cause
The Edge Runtime config might not have been deployed properly, or Supabase requires the webhook to be called with CORS preflight.

## Solution

### Option 1: Redeploy with Config
```bash
npx supabase functions deploy stripe-webhook
```

### Option 2: Update Stripe Webhook URL to bypass auth
Instead of calling the function directly, we can use a different approach.

### Option 3: Check if STRIPE_WEBHOOK_SECRET is set
The webhook might be rejecting requests if the secret isn't configured in Supabase.

## Test the Fix

After deploying, test with Stripe CLI:
```bash
stripe trigger payment_intent.succeeded
```

Or manually in Stripe Dashboard → Webhooks → Send test webhook

