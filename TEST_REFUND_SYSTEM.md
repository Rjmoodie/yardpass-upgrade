# 🧪 Testing Automated Refund System

**Quick guide to verify refunds work end-to-end**

---

## 🔍 **Pre-Test Verification**

Run this SQL to verify the migration worked:

```sql
-- Check tables exist
SELECT 
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='ticketing' AND table_name='refund_log') as refund_log_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='ticketing' AND table_name='refund_policies') as refund_policies_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tickets' AND column_name='refunded_at') as tickets_refunded_at_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='refunded_at') as orders_refunded_at_exists;

-- Check functions exist
SELECT 
  proname,
  '✅' as status
FROM pg_proc
WHERE proname IN ('process_ticket_refund', 'check_refund_eligibility')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'ticketing')
ORDER BY proname;
```

**Expected:** All should return `true` or `✅`

---

## 🧪 **Test 1: Webhook Path (Automatic Refund)**

### **Setup:**
1. Find a test order that's paid (NOT redeemed):

```sql
SELECT 
  o.id,
  e.title as event,
  o.contact_email,
  o.total_cents / 100.0 as amount_usd,
  o.stripe_payment_intent_id
FROM ticketing.orders o
JOIN events.events e ON e.id = o.event_id
WHERE o.status = 'paid'
  AND o.stripe_payment_intent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ticketing.tickets t 
    WHERE t.order_id = o.id AND t.status = 'redeemed'
  )
ORDER BY o.created_at DESC
LIMIT 5;
```

### **Test Steps:**

1. **Go to Stripe Dashboard** → Payments → Find the payment intent
2. **Click "Refund"** → Process full refund
3. **Watch Supabase Logs:**
   - Go to Edge Functions → stripe-webhook → Logs
   - Should see: "🔄 Refund event received"
   - Should see: "✅ Refund processed successfully"
   - Should see: "✅ Refund confirmation email sent"

4. **Verify in Database:**

```sql
-- Check refund was logged
SELECT 
  rl.*,
  o.status as order_status,
  o.refunded_at as order_refunded_at
FROM ticketing.refund_log rl
JOIN ticketing.orders o ON o.id = rl.order_id
ORDER BY rl.processed_at DESC
LIMIT 1;

-- Check tickets marked as refunded
SELECT 
  id,
  order_id,
  status,
  refunded_at
FROM ticketing.tickets
WHERE order_id = 'YOUR_ORDER_ID_HERE'
ORDER BY created_at;

-- Check inventory released
SELECT 
  tt.name as tier,
  tt.issued_quantity,
  (SELECT COUNT(*) FROM ticketing.tickets t 
   WHERE t.tier_id = tt.id 
   AND t.status IN ('issued', 'transferred')) as actual_issued
FROM ticketing.ticket_tiers tt
WHERE tt.id IN (
  SELECT DISTINCT tier_id FROM ticketing.tickets 
  WHERE order_id = 'YOUR_ORDER_ID_HERE'
);
```

5. **Check Email:** Verify refund confirmation email arrived

**Expected Results:**
- ✅ Refund log entry created
- ✅ Tickets status = 'refunded'
- ✅ Order status = 'refunded'
- ✅ issued_quantity decreased by number of tickets
- ✅ Email sent to customer

---

## 🧪 **Test 2: Manual API Path (Organizer/Admin Initiated)**

### **Setup:**
1. Get an auth token (login as event organizer or admin)
2. Find an order for one of your events:

```sql
SELECT 
  o.id,
  e.title,
  e.created_by,
  o.total_cents / 100.0 as amount_usd
FROM ticketing.orders o
JOIN events.events e ON e.id = o.event_id
WHERE o.status = 'paid'
  AND e.created_by = 'YOUR_USER_ID_HERE'
  AND NOT EXISTS (
    SELECT 1 FROM ticketing.tickets t 
    WHERE t.order_id = o.id AND t.status = 'redeemed'
  )
LIMIT 3;
```

### **Test Steps:**

1. **Call process-refund API:**

```bash
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/process-refund' \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "YOUR_ORDER_ID_HERE",
    "reason": "Customer requested refund - test"
  }'
```

2. **Expected Response:**

```json
{
  "status": "success",
  "refund": {
    "id": "re_xxxxx",
    "amount": 250.00,
    "status": "succeeded"
  },
  "database": {
    "tickets_refunded": 1,
    "inventory_released": [{"tier_id": "...", "tickets_released": 1}]
  },
  "message": "Refund initiated successfully. Confirmation email will be sent shortly."
}
```

3. **Verify in Stripe Dashboard:**
   - Payment should show "Refunded"
   - Refund ID should match response

4. **Verify in Database:**
   - Same queries as Test 1

5. **Check Email:** Customer receives refund confirmation

---

## 🧪 **Test 3: Idempotency (Prevent Duplicates)**

### **Test Steps:**

1. **Process a refund via Stripe Dashboard**
2. **Wait for webhook to complete** (check logs)
3. **Try to call process-refund API for same order:**

```bash
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/process-refund' \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "ALREADY_REFUNDED_ORDER_ID"}'
```

**Expected Response:**
```json
{
  "status": "not_eligible",
  "reason": "Already refunded",
  "details": {
    "eligible": false,
    "refunded_at": "2025-11-11T..."
  }
}
```

**Verify:**
- ✅ Only ONE entry in refund_log
- ✅ Inventory only decremented ONCE
- ✅ Only ONE email sent

---

## 🧪 **Test 4: Business Rules**

### **Test 4A: Redeemed Ticket (Should Fail)**

1. Mark a ticket as redeemed:
```sql
UPDATE ticketing.tickets
SET status = 'redeemed', redeemed_at = now()
WHERE order_id = 'TEST_ORDER_ID'
LIMIT 1;
```

2. Try to refund in Stripe Dashboard

**Expected:**
```
status: "no_refundable_tickets"
message: "No refundable tickets found (all redeemed or already refunded)"
```

### **Test 4B: Refund Window (Should Fail for Non-Admins)**

1. Create an event starting in 12 hours
2. Purchase a ticket
3. Try to refund as organizer (not admin)

**Expected:**
```
status: "error"
message: "Refunds not allowed within 24 hours of event start"
```

4. Try again as platform admin

**Expected:** ✅ Should succeed (admins can override)

---

## 🧪 **Test 5: Authorization (Should Fail)**

### **Test as Unauthorized User:**

1. Get auth token for user who doesn't own the event
2. Try to refund someone else's order:

```bash
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/process-refund' \
  -H "Authorization: Bearer UNAUTHORIZED_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "SOMEONE_ELSES_ORDER"}'
```

**Expected Response:**
```json
{
  "status": "error",
  "error": "Not authorized to refund this order. Only event organizers and platform admins can process refunds."
}
```

**HTTP Status:** 403 Forbidden

---

## ✅ **Success Criteria**

After all tests, verify:

- ✅ Webhook refunds work automatically
- ✅ Manual API refunds work with auth
- ✅ Idempotency prevents duplicates (single refund_log entry)
- ✅ Inventory correctly released (issued_quantity accurate)
- ✅ Emails sent (one per refund)
- ✅ Business rules enforced (24h window, no redeemed tickets)
- ✅ Authorization enforced (only organizers/admins)
- ✅ Audit log complete (all refunds tracked)

---

## 📊 **Monitoring Queries**

### **Refund Activity Dashboard:**

```sql
-- Refunds in last 7 days
SELECT 
  DATE(processed_at) as date,
  refund_type,
  COUNT(*) as refund_count,
  SUM(refund_amount_cents) / 100.0 as total_refunded_usd,
  SUM(tickets_refunded) as total_tickets
FROM ticketing.refund_log
WHERE processed_at > now() - interval '7 days'
GROUP BY DATE(processed_at), refund_type
ORDER BY date DESC, refund_type;

-- Refund rate by event
SELECT 
  e.title,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'paid') as total_orders,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'refunded') as refunded_orders,
  ROUND(
    100.0 * COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'refunded') / 
    NULLIF(COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'paid'), 0),
    2
  ) as refund_rate_pct
FROM ticketing.orders o
JOIN events.events e ON e.id = o.event_id
WHERE o.status IN ('paid', 'refunded')
GROUP BY e.id, e.title
HAVING COUNT(DISTINCT o.id) > 0
ORDER BY refund_rate_pct DESC NULLS LAST;

-- Recent refunds with details
SELECT 
  rl.processed_at::text,
  e.title as event,
  rl.refund_type,
  rl.tickets_refunded,
  rl.refund_amount_cents / 100.0 as amount_usd,
  rl.reason,
  up.display_name as initiated_by
FROM ticketing.refund_log rl
LEFT JOIN ticketing.orders o ON o.id = rl.order_id
LEFT JOIN events.events e ON e.id = o.event_id
LEFT JOIN users.user_profiles up ON up.user_id = rl.initiated_by
ORDER BY rl.processed_at DESC
LIMIT 20;
```

---

## 🎯 **Troubleshooting**

### **Issue: Refund not processing**

Check:
1. Stripe webhook is configured with correct URL
2. STRIPE_WEBHOOK_SECRET is set correctly
3. Webhook logs show no signature errors
4. Order has valid stripe_payment_intent_id

### **Issue: Email not sending**

Check:
1. RESEND_API_KEY is set
2. Email domain verified in Resend
3. Check send-refund-confirmation logs for errors

### **Issue: Inventory not releasing**

Check:
1. Refund log shows tickets_refunded > 0
2. Verify inventory_released in refund_log.metadata
3. Check ticket_tiers.issued_quantity manually

---

**Ready to test!** Follow the steps above to verify your automated refund system works perfectly. 🎉


