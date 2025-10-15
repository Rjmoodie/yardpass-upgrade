# Test Email Sending Directly

## Option 1: Test via Supabase Dashboard

Go to your Supabase Dashboard → Edge Functions → `send-purchase-confirmation` → Invoke

**Test Payload:**
```json
{
  "customerName": "User",
  "customerEmail": "roderickmoodie@yahoo.com",
  "eventTitle": "Test Event",
  "eventDate": "October 14, 2025",
  "eventLocation": "Test Venue, Test City",
  "ticketType": "General Admission",
  "quantity": 1,
  "totalAmount": 5000,
  "orderId": "90e3a1d7-7e55-4e44-bb27-6c4802f144be",
  "ticketIds": [],
  "eventId": "YOUR_EVENT_ID_HERE"
}
```

## Option 2: Test via cURL

```bash
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/send-purchase-confirmation' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "customerName": "User",
    "customerEmail": "roderickmoodie@yahoo.com",
    "eventTitle": "Test Event",
    "eventDate": "October 14, 2025",
    "eventLocation": "Test Venue",
    "ticketType": "General Admission",
    "quantity": 1,
    "totalAmount": 5000,
    "orderId": "90e3a1d7-7e55-4e44-bb27-6c4802f144be",
    "ticketIds": []
  }'
```

## Option 3: Check Supabase Edge Function Logs

**Check if `process-payment` was called:**
```bash
npx supabase functions logs process-payment --limit 50
```

**Check if `send-purchase-confirmation` was called:**
```bash
npx supabase functions logs send-purchase-confirmation --limit 50
```

**Check stripe-webhook:**
```bash
npx supabase functions logs stripe-webhook --limit 50
```

## Debugging Steps

### Step 1: Verify RESEND_API_KEY is set
```bash
# In Supabase Dashboard → Settings → Edge Functions → Secrets
# Check if RESEND_API_KEY exists
```

### Step 2: Check Stripe Webhook Events
1. Go to Stripe Dashboard → Developers → Webhooks
2. Find your webhook endpoint
3. Click on it to view recent events
4. Check if `checkout.session.completed` events are being sent
5. Check if they're succeeding or failing

### Step 3: Check if webhook is calling process-payment
The issue might be:
- Webhook is not being triggered by Stripe
- Webhook is failing before calling process-payment
- process-payment is being called but failing silently
- send-purchase-confirmation is not being invoked

### Step 4: Manual Email Send Test

If you want to manually send emails for existing orders, you can call the `process-payment` function directly:

```bash
# Using Supabase CLI
npx supabase functions invoke process-payment --body '{"sessionId":"YOUR_STRIPE_SESSION_ID"}'
```

Or via the Supabase Dashboard:
1. Go to Edge Functions → `process-payment` → Invoke
2. Use this payload:
```json
{
  "sessionId": "cs_test_YOUR_SESSION_ID"
}
```

## Common Issues

### Issue 1: RESEND_API_KEY Not Set
**Symptom:** `send-purchase-confirmation` fails silently
**Fix:** Set `RESEND_API_KEY` in Supabase Dashboard → Settings → Edge Functions → Secrets

### Issue 2: Stripe Webhook Not Configured
**Symptom:** No logs in `stripe-webhook` function
**Fix:** 
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/stripe-webhook`
3. Select events: `checkout.session.completed`, `checkout.session.expired`
4. Copy signing secret and set as `STRIPE_WEBHOOK_SECRET` in Supabase

### Issue 3: Order Already Marked as Paid
**Symptom:** Webhook skips processing (line 78-80 in stripe-webhook)
**Fix:** Order was already processed, need to manually trigger email

### Issue 4: Email Not Sent Due to Missing Data
**Symptom:** `send-purchase-confirmation` is called but fails
**Fix:** Check logs for specific error message

## Quick Test Script

Run this in the Supabase SQL Editor:

```sql
-- Get stripe_session_id for the most recent order
SELECT 
  id,
  stripe_session_id,
  status,
  contact_email
FROM orders
WHERE status = 'paid'
  AND contact_email = 'roderickmoodie@yahoo.com'
ORDER BY created_at DESC
LIMIT 1;
```

Then manually invoke `process-payment` with that `stripe_session_id`.


