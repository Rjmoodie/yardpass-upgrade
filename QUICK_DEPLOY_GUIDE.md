# ⚡ QUICK DEPLOYMENT GUIDE - Fix Ticket Generation NOW

## 🎯 **The Issue**
Your Edge Functions are querying **VIEWS** instead of **TABLES**. Same issue as `checkout_sessions`.

---

## ✅ **What I Fixed (4 Functions)**

### 1. `ensure-tickets` ✅
- Stripe import: `14.23.0?target=deno` → `14.21.0`
- Schema: `tickets` → `ticketing.tickets`
- Schema: `orders` → `ticketing.orders`
- Schema: `order_items` → `ticketing.order_items`
- Schema: `ticket_tiers` → `ticketing.ticket_tiers`

### 2. `process-payment` ✅
- Schema: `tickets` → `ticketing.tickets`
- Schema: `orders` → `ticketing.orders` (2 places)
- Schema: `order_items` → `ticketing.order_items`

### 3. `resend-confirmation` ✅
- Schema: `tickets` → `ticketing.tickets`
- Schema: `orders` → `ticketing.orders`
- Schema: `order_items` → `ticketing.order_items`

### 4. `stripe-webhook` ✅
- Schema: `orders` → `ticketing.orders` (2 places)

---

## 🚀 **DEPLOY NOW (5 Minutes)**

### Via Supabase Dashboard:

**Step 1:** Open Functions Page
- Go to: https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/functions

**Step 2:** Deploy Each Function (do all 4)

1. Click **`ensure-tickets`**
   - Click "Deploy new version"
   - Wait for green checkmark (~30 seconds)

2. Click **`process-payment`**
   - Click "Deploy new version"
   - Wait for green checkmark

3. Click **`resend-confirmation`**
   - Click "Deploy new version"
   - Wait for green checkmark

4. Click **`stripe-webhook`**
   - Click "Deploy new version"
   - Wait for green checkmark

**Step 3:** Test Immediately

```bash
# Test ensure-tickets (should now work!)
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ensure-tickets' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "5cd581b8-9b00-4e96-b6f0-d6458e5db278"}'
```

**Expected:** `{"status":"issued","issued":1}`

---

## 🎟️ **Fix Your 3 Failed Orders**

After deploying, run these commands to fix all failed purchases:

### Order 1: `5cd581b8-9b00-4e96-b6f0-d6458e5db278` (most recent)
```bash
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ensure-tickets' -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" -H "Content-Type: application/json" -d '{"order_id": "5cd581b8-9b00-4e96-b6f0-d6458e5db278"}'

curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/resend-confirmation' -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" -H "Content-Type: application/json" -d '{"orderId": "5cd581b8-9b00-4e96-b6f0-d6458e5db278"}'
```

### Order 2: `ba1eff01-8955-4136-b4af-39161aaebda8`
```bash
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ensure-tickets' -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" -H "Content-Type: application/json" -d '{"order_id": "ba1eff01-8955-4136-b4af-39161aaebda8"}'

curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/resend-confirmation' -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" -H "Content-Type: application/json" -d '{"orderId": "ba1eff01-8955-4136-b4af-39161aaebda8"}'
```

### Order 3: `176315e6-8219-41b6-ad2f-e983b17792d0`
```bash
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ensure-tickets' -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" -H "Content-Type: application/json" -d '{"order_id": "176315e6-8219-41b6-ad2f-e983b17792d0"}'

curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/resend-confirmation' -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" -H "Content-Type: application/json" -d '{"orderId": "176315e6-8219-41b6-ad2f-e983b17792d0"}'
```

---

## ✅ **Verify Tickets Created**

```sql
SELECT 
  o.id as order_id,
  o.created_at::text,
  o.contact_email,
  (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.order_id = o.id) as tickets_created
FROM ticketing.orders o
WHERE o.id IN (
  '5cd581b8-9b00-4e96-b6f0-d6458e5db278',
  'ba1eff01-8955-4136-b4af-39161aaebda8',
  '176315e6-8219-41b6-ad2f-e983b17792d0'
);
```

All should show `tickets_created = 1`.

---

## 📧 **Email Note**

For emails to work, you also need `RESEND_API_KEY` environment variable set:

```bash
supabase secrets set RESEND_API_KEY=re_your_key_here
```

Or via Dashboard:
- Settings → Edge Functions → Secrets → Add `RESEND_API_KEY`

---

**⚡ Deploy the 4 functions NOW, then run the curl commands!** 🚀



