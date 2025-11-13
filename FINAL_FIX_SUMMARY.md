# 🚨 Critical Fix: Ticketing Schema Issue (Same as checkout_sessions)

## ❌ **Root Cause**

**IDENTICAL ISSUE TO checkout_sessions:**

All ticketing tables exist in TWO places:
- ✅ **Real tables** in `ticketing` schema (actual data)
- ❌ **Views** in `public` schema (read-only facades)

Edge functions were querying `.from("tickets")` which defaults to `public.tickets` (VIEW).

**Result:** 
- ✅ **Reads work** (views allow SELECT)
- ❌ **Inserts fail** (views don't support INSERT)
- ❌ **Updates might fail** (views don't support UPDATE by default)

---

## ✅ **Functions Fixed**

I've updated **4 Edge Functions** to use the real `ticketing.*` tables:

### 1. **ensure-tickets** ✅
- Changed: `orders` → `ticketing.orders`
- Changed: `tickets` → `ticketing.tickets`
- Changed: `order_items` → `ticketing.order_items`
- Changed: `ticket_tiers` → `ticketing.ticket_tiers`
- **Also fixed:** Stripe import from `14.23.0?target=deno` → `14.21.0`

### 2. **process-payment** ✅
- Changed: `orders` → `ticketing.orders` (2 places)
- Changed: `tickets` → `ticketing.tickets`
- Changed: `order_items` → `ticketing.order_items`

### 3. **resend-confirmation** ✅
- Changed: `orders` → `ticketing.orders`
- Changed: `tickets` → `ticketing.tickets`
- Changed: `order_items` → `ticketing.order_items`

### 4. **stripe-webhook** ✅
- Changed: `orders` → `ticketing.orders` (2 places)

---

## 🚀 **Deploy These 4 Functions**

**Manual Deployment via Dashboard (REQUIRED):**

1. Go to: https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/functions

2. Deploy each function:
   - Click **`ensure-tickets`** → "Deploy new version"
   - Click **`process-payment`** → "Deploy new version"
   - Click **`resend-confirmation`** → "Deploy new version"
   - Click **`stripe-webhook`** → "Deploy new version"

3. Wait for each deployment to complete (~30 seconds each)

---

## 🧪 **Test After Deployment**

### Test 1: Fix Most Recent Failed Order

```bash
# Generate tickets for order: 5cd581b8-9b00-4e96-b6f0-d6458e5db278
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ensure-tickets' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "5cd581b8-9b00-4e96-b6f0-d6458e5db278"}'
```

**Expected response:**
```json
{
  "status": "issued",
  "issued": 1
}
```

### Test 2: Send Confirmation Email

```bash
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/resend-confirmation' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "5cd581b8-9b00-4e96-b6f0-d6458e5db278"}'
```

**Expected response:**
```json
{
  "success": true,
  "messageId": "..."
}
```

### Test 3: Verify Tickets in Database

```sql
SELECT 
  t.id,
  t.status,
  substring(t.qr_code, 1, 20) as qr_preview,
  t.created_at::text
FROM ticketing.tickets t
WHERE t.order_id = '5cd581b8-9b00-4e96-b6f0-d6458e5db278';
```

Should return 1+ tickets.

### Test 4: Make New Purchase (End-to-End Test)

After deploying all 4 functions, make a brand new test purchase. It should:
1. ✅ Create order
2. ✅ Process payment
3. ✅ Generate tickets automatically
4. ✅ Send confirmation email
5. ✅ Tickets appear in app

---

## 📊 **Fix All Past Failed Orders**

After deployment, fix all orders that failed:

```sql
-- Get all failed orders from last 24 hours
SELECT 
  o.id as order_id,
  o.created_at::text,
  o.contact_email,
  (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.order_id = o.id) as tickets
FROM ticketing.orders o
WHERE o.status = 'paid'
  AND o.paid_at > now() - interval '24 hours'
  AND (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.order_id = o.id) = 0
ORDER BY o.created_at DESC;
```

For each order_id from results:

```bash
# Generate tickets
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ensure-tickets' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "ORDER_ID_HERE"}'

# Send email
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/resend-confirmation' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "ORDER_ID_HERE"}'
```

---

## 📝 **What Changed (Technical Details)**

### Before (Broken):
```typescript
// ensure-tickets/index.ts
await admin.from("tickets").insert(rows);  // ❌ Inserts into public.tickets VIEW

// process-payment/index.ts
await supabaseService.from("orders").update({ status: 'paid' });  // ❌ Updates public.orders VIEW

// stripe-webhook/index.ts
await supabaseService.from("orders").select("*");  // ⚠️ Reads from VIEW (works, but inconsistent)
```

### After (Fixed):
```typescript
// ensure-tickets/index.ts
await admin.from("ticketing.tickets").insert(rows);  // ✅ Inserts into ticketing.tickets TABLE

// process-payment/index.ts
await supabaseService.from("ticketing.orders").update({ status: 'paid' });  // ✅ Updates ticketing.orders TABLE

// stripe-webhook/index.ts
await supabaseService.from("ticketing.orders").select("*");  // ✅ Reads from TABLE
```

---

## 🎯 **Why This Happened**

Your database has:
1. **ticketing** schema (real tables) - Created by migrations
2. **public** schema (views) - Created for frontend convenience

Edge functions default to `public` schema when you write `.from("tickets")`.

The views work for **SELECT** but fail for **INSERT/UPDATE**, causing silent crashes in Edge Functions.

**Same pattern as:**
- `checkout_sessions` (fixed with RPC functions)
- Now `tickets`, `orders`, `order_items`, `ticket_tiers` (fixing with schema prefix)

---

## ✅ **Deployment Checklist**

- [ ] Deploy `ensure-tickets`
- [ ] Deploy `process-payment`
- [ ] Deploy `resend-confirmation`
- [ ] Deploy `stripe-webhook`
- [ ] Test with curl commands above
- [ ] Verify tickets appear in database
- [ ] Verify email is received
- [ ] Make new test purchase (end-to-end)
- [ ] Fix all past failed orders

---

**Deploy all 4 functions NOW via dashboard, then run the test curl commands!** 🚀


