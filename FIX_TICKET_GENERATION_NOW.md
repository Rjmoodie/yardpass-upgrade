# 🚨 URGENT: Fix Ticket Generation & Emails

## 🎯 **The Problem (Root Cause)**

**SAME ISSUE AS `checkout_sessions` - VIEW vs TABLE:**

Your database has:
- ✅ **Real tables** in `ticketing` schema (`ticketing.tickets`, `ticketing.orders`, etc.)
- ❌ **Views** in `public` schema (`public.tickets`, `public.orders`, etc.)

Edge functions were using `.from("tickets")` which defaults to `public.tickets` (VIEW).

**Result:**
- ✅ Reads work (SELECT from views is fine)
- ❌ **Inserts FAIL** (can't INSERT into views) ← **THIS IS WHY TICKETS AREN'T CREATED**
- ❌ **Updates FAIL** (can't UPDATE views) ← **THIS IS WHY ORDERS DON'T UPDATE**

---

## ✅ **What I Fixed (4 Edge Functions)**

### 1. `ensure-tickets`
- ✅ Fixed Stripe import: `14.23.0?target=deno` → `14.21.0`
- ✅ Changed: `tickets` → `ticketing.tickets`
- ✅ Changed: `orders` → `ticketing.orders`
- ✅ Changed: `order_items` → `ticketing.order_items`
- ✅ Changed: `ticket_tiers` → `ticketing.ticket_tiers`

### 2. `process-payment`
- ✅ Changed: `orders` → `ticketing.orders` (2 places)
- ✅ Changed: `tickets` → `ticketing.tickets`
- ✅ Changed: `order_items` → `ticketing.order_items`

### 3. `resend-confirmation`
- ✅ Changed: `orders` → `ticketing.orders`
- ✅ Changed: `tickets` → `ticketing.tickets`
- ✅ Changed: `order_items` → `ticketing.order_items`

### 4. `stripe-webhook`
- ✅ Changed: `orders` → `ticketing.orders` (2 places)

---

## 🚀 **DEPLOYMENT (DO THIS NOW - 5 MINUTES)**

### Step 1: Open Supabase Dashboard
https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/functions

### Step 2: Deploy Each Function

For **EACH** of these 4 functions:
1. Click the function name
2. Click "Deploy new version" button
3. Wait for green checkmark (~30 seconds)
4. Move to next function

**Functions to deploy:**
- ✅ `ensure-tickets`
- ✅ `process-payment`  
- ✅ `resend-confirmation`
- ✅ `stripe-webhook`

---

## 🧪 **IMMEDIATE TEST (Right After Deployment)**

### Test 1: Generate Tickets for Failed Order

```bash
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ensure-tickets' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "5cd581b8-9b00-4e96-b6f0-d6458e5db278"}'
```

**EXPECTED SUCCESS:**
```json
{"status":"issued","issued":1}
```

**If you see this, tickets are created!** ✅

---

### Test 2: Send Confirmation Email

```bash
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/resend-confirmation' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "5cd581b8-9b00-4e96-b6f0-d6458e5db278"}'
```

**EXPECTED SUCCESS:**
```json
{"success":true,"messageId":"..."}
```

**If you see this, email sent!** ✅

---

### Test 3: Verify in Database

Run in Supabase SQL Editor:

```sql
SELECT 
  t.id,
  t.status,
  substring(t.qr_code, 1, 30) as qr_code_preview,
  t.created_at::text
FROM ticketing.tickets t
WHERE t.order_id = '5cd581b8-9b00-4e96-b6f0-d6458e5db278';
```

**Should return 1 ticket with a QR code.** ✅

---

## 🎟️ **Fix Other 2 Failed Orders**

After Test 1 & 2 succeed, run these for the other orders:

### Order: ba1eff01-8955-4136-b4af-39161aaebda8
```bash
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ensure-tickets' -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" -H "Content-Type: application/json" -d '{"order_id": "ba1eff01-8955-4136-b4af-39161aaebda8"}'

curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/resend-confirmation' -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" -H "Content-Type: application/json" -d '{"orderId": "ba1eff01-8955-4136-b4af-39161aaebda8"}'
```

### Order: 176315e6-8219-41b6-ad2f-e983b17792d0
```bash
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ensure-tickets' -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" -H "Content-Type: application/json" -d '{"order_id": "176315e6-8219-41b6-ad2f-e983b17792d0"}'

curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/resend-confirmation' -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" -H "Content-Type: application/json" -d '{"orderId": "176315e6-8219-41b6-ad2f-e983b17792d0"}'
```

---

## ✅ **Success Criteria**

After deploying and running commands:

- [ ] `ensure-tickets` curl returns `{"status":"issued","issued":1}`
- [ ] `resend-confirmation` curl returns `{"success":true}`
- [ ] Database shows 3 tickets created (1 per order)
- [ ] User receives 3 confirmation emails
- [ ] Tickets appear in app under "My Tickets"
- [ ] New test purchase works end-to-end (no manual intervention)

---

## 📊 **Check All Failed Orders (Last 24 Hours)**

```sql
SELECT 
  o.id,
  o.created_at::text,
  o.contact_email,
  (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.order_id = o.id) as tickets
FROM ticketing.orders o
WHERE o.status = 'paid'
  AND o.paid_at > now() - interval '24 hours'
  AND (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.order_id = o.id) = 0
ORDER BY o.created_at DESC;
```

If more orders appear, repeat the curl commands for each `order_id`.

---

## 📧 **Email Setup (If Not Working)**

Emails require `RESEND_API_KEY` environment variable.

**Check if set:**
```bash
supabase secrets list
```

**If missing:**
1. Get key from: https://resend.com/api-keys
2. Set via CLI: `supabase secrets set RESEND_API_KEY=re_your_key`
3. Or via Dashboard: Settings → Edge Functions → Secrets

---

## 🔄 **Why This Keeps Happening**

Your database has **dual structure**:
- `ticketing` schema = actual data storage (tables)
- `public` schema = read-only views (for frontend convenience)

**Frontend should use:** `public.tickets` (view) ✅  
**Edge Functions should use:** `ticketing.tickets` (table) ✅

We need to be **explicit** in Edge Functions: `.from("ticketing.tickets")` not `.from("tickets")`.

---

## 🎯 **Action Plan (Right Now)**

1. **Deploy 4 functions** (via dashboard - 5 minutes)
2. **Run Test 1** (ensure-tickets curl - 10 seconds)
3. **If success** → Run Test 2 (resend-confirmation - 10 seconds)
4. **If success** → Fix other 2 orders (1 minute)
5. **Verify in database** (SQL query - 10 seconds)
6. **Make new test purchase** (end-to-end verification - 2 minutes)

**Total time: ~10 minutes to fully resolve** 🚀

---

**Deploy now and paste the curl results!**



