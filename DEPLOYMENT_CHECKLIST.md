# 🚨 Critical Deployment Checklist - Fix Ticket Generation & Emails

**Problem:** Tickets not being generated and emails not being sent after purchase.

---

## ✅ Step 1: Deploy Fixed `ensure-tickets` Function

**What was fixed:** Changed Stripe import from `stripe@14.23.0?target=deno` to `stripe@14.21.0` to fix Deno runtime crash.

**Deploy command:**
```bash
cd /Users/rod/Desktop/yard_pass/liventix/liventix-upgrade/liventix-upgrade
supabase functions deploy ensure-tickets --no-verify-jwt
```

**Alternative:** Deploy via Supabase Dashboard:
1. Go to: https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/functions
2. Click `ensure-tickets`
3. Click "Deploy new version"

---

## ✅ Step 2: Set Environment Variables

### Required: `RESEND_API_KEY`

**Where:** Supabase Dashboard → Project Settings → Edge Functions → Secrets

**Get your key:**
1. Go to: https://resend.com/api-keys
2. Create a new API key (if you don't have one)
3. Copy the key (starts with `re_`)

**Add to Supabase:**
```bash
supabase secrets set RESEND_API_KEY=re_your_key_here
```

**Or via Dashboard:**
1. Go to: https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/settings/functions
2. Click "Add secret"
3. Name: `RESEND_API_KEY`
4. Value: Your Resend API key

### Verify Other Required Variables

Check these are set (should already be configured):
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `STRIPE_SECRET_KEY`

---

## ✅ Step 3: Verify Email Domain (Resend)

If using a custom domain for emails:

1. Go to: https://resend.com/domains
2. Add your domain (e.g., `liventix.tech`)
3. Add DNS records:
   - **SPF:** `v=spf1 include:amazonses.com ~all`
   - **DKIM:** (provided by Resend)
   - **DMARC:** `v=DMARC1; p=none;`
4. Wait for verification (usually 5-30 minutes)

**Default:** Emails will send from `hello@liventix.tech` (check Resend dashboard for approved domains)

---

## ✅ Step 4: Test the Fix

### A. Test New Purchase
1. Make a test purchase through the app
2. Check Supabase Logs for `process-payment` function:
   - Should see: `✅ Purchase confirmation email sent successfully`
   - Should NOT see: `Failed to ensure tickets`

### B. Check Database
Run this query in Supabase SQL Editor to verify tickets were created:

```sql
-- Check most recent order
WITH recent_order AS (
  SELECT 
    o.id as order_id,
    o.created_at,
    o.status,
    o.paid_at,
    o.user_id,
    o.contact_email,
    e.title as event_title
  FROM orders o
  LEFT JOIN events e ON e.id = o.event_id
  WHERE o.created_at > now() - interval '1 hour'
  ORDER BY o.created_at DESC
  LIMIT 1
)
SELECT 
  ro.order_id,
  ro.status as order_status,
  ro.event_title,
  ro.contact_email,
  (SELECT COUNT(*) FROM tickets t WHERE t.order_id = ro.order_id) as tickets_created,
  (SELECT json_agg(json_build_object(
    'id', t.id,
    'status', t.status,
    'qr_code', substring(t.qr_code, 1, 30)
  )) FROM tickets t WHERE t.order_id = ro.order_id LIMIT 3) as sample_tickets
FROM recent_order ro;
```

**Expected result:**
- `tickets_created` should be > 0
- `sample_tickets` should show ticket IDs and QR codes

---

## ✅ Step 5: Fix Past Failed Orders (Retroactive)

If you have orders that failed to generate tickets, run this to fix them:

```sql
-- Find orders that are paid but have no tickets
SELECT 
  o.id as order_id,
  o.created_at,
  o.status,
  o.user_id,
  o.contact_email,
  e.title as event_title,
  (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as items_ordered,
  (SELECT COUNT(*) FROM tickets t WHERE t.order_id = o.id) as tickets_issued
FROM orders o
LEFT JOIN events e ON e.id = o.event_id
WHERE o.status = 'paid'
  AND o.paid_at > now() - interval '24 hours'
  AND (SELECT COUNT(*) FROM tickets t WHERE t.order_id = o.id) = 0
ORDER BY o.created_at DESC;
```

For each order ID, call the `ensure-tickets` function manually:

**Via Supabase Dashboard → Database → Functions:**
```sql
SELECT * FROM public.ensure_tickets_manual('ORDER_ID_HERE');
```

**Or via API:**
```bash
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ensure-tickets' \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "ORDER_ID_HERE"}'
```

---

## ✅ Step 6: Resend Confirmation Emails

For orders that succeeded but didn't get emails, use the `resend-confirmation` function:

**Via API:**
```bash
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/resend-confirmation' \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "ORDER_ID_HERE"}'
```

**Or create a helper SQL function:**
```sql
CREATE OR REPLACE FUNCTION public.resend_order_confirmation(p_order_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  -- This would call the edge function via pg_net extension
  -- For now, use the API method above
  RETURN json_build_object('success', true, 'message', 'Use API to resend');
END;
$$;
```

---

## 📊 Monitoring Commands

### Check Edge Function Logs
```bash
# Watch logs in real-time
supabase functions logs ensure-tickets --tail

# Check process-payment logs
supabase functions logs process-payment --tail

# Check email sending logs
supabase functions logs send-purchase-confirmation --tail
```

### Check Recent Orders Status
```sql
SELECT 
  o.id,
  o.created_at,
  o.status,
  o.total_cents / 100.0 as total_usd,
  (SELECT COUNT(*) FROM tickets t WHERE t.order_id = o.id) as tickets,
  CASE 
    WHEN (SELECT COUNT(*) FROM tickets t WHERE t.order_id = o.id) > 0 THEN '✅ Has Tickets'
    WHEN o.status = 'paid' THEN '❌ MISSING TICKETS'
    ELSE '⏳ Pending'
  END as ticket_status
FROM orders o
WHERE o.created_at > now() - interval '24 hours'
ORDER BY o.created_at DESC
LIMIT 10;
```

---

## 🎯 Success Criteria

After completing all steps, verify:

- [ ] `ensure-tickets` function deploys without errors
- [ ] `RESEND_API_KEY` is set in Supabase secrets
- [ ] Test purchase creates tickets immediately
- [ ] Test purchase sends confirmation email
- [ ] Logs show: `✅ Purchase confirmation email sent successfully`
- [ ] Past failed orders have been fixed (tickets generated)
- [ ] Confirmation emails resent for past orders

---

## 🆘 Troubleshooting

### Issue: "RESEND_API_KEY not configured"
**Solution:** Set the environment variable (see Step 2)

### Issue: "Email domain not verified"
**Solution:** Verify domain in Resend dashboard (see Step 3)

### Issue: Tickets created but no QR codes
**Solution:** Check that `gen_qr_code()` function exists in database:
```sql
SELECT proname FROM pg_proc WHERE proname = 'gen_qr_code';
```

### Issue: "Failed to ensure tickets" still appearing
**Solution:** 
1. Verify you deployed the fixed function (check deployment timestamp)
2. Check Supabase logs for the actual error message
3. Verify database has `claim_order_ticketing` RPC function

---

## 📞 Need Help?

If issues persist after following this checklist:

1. **Check Supabase Logs:**
   - Dashboard → Logs → Edge Functions
   - Filter by function name

2. **Check Stripe Webhook Logs:**
   - Stripe Dashboard → Developers → Webhooks
   - Look for failed webhook deliveries

3. **Database Issues:**
   - Run the diagnostic queries above
   - Check for missing foreign keys or RLS policies

---

**Last Updated:** January 11, 2025  
**Status:** Fix deployed, awaiting verification
