# 🔧 Ticket Accounting SRE Runbook

**Version:** 2.0 (Production-Hardened)  
**Last Updated:** December 4, 2025  
**Owner:** Platform Team  
**Severity:** P1 (Revenue Impact)

---

## 🎯 Purpose

This runbook provides step-by-step procedures for diagnosing and fixing ticket accounting issues in production.

---

## 📊 Common Symptoms

### **1. "Event shows SOLD OUT but sales are low"**
- **Symptom:** UI shows "SOLD OUT" but percent_sold is < 50%
- **Likely Cause:** Stuck reserved_quantity from expired holds
- **Jump to:** [Section 3: Cleanup Stuck Reservations](#3-cleanup-stuck-reservations)

### **2. "Customers can't buy tickets but dashboard shows availability"**
- **Symptom:** Dashboard shows available tickets, but checkout fails
- **Likely Cause:** Race condition or cache mismatch
- **Jump to:** [Section 4: Cache & Real-time Sync](#4-cache--real-time-sync)

### **3. "Revenue doesn't match ticket sales"**
- **Symptom:** total_revenue ÷ ticket_price ≠ tickets_sold
- **Likely Cause:** Fees included in total, or missing tickets
- **Jump to:** [Section 5: Revenue Reconciliation](#5-revenue-reconciliation)

---

## 🔍 Section 1: Initial Diagnosis

### **Step 1.1: Check Event Health**

```sql
-- Quick health check for specific event
SELECT * FROM ticketing.event_health
WHERE event_id = 'YOUR_EVENT_ID';
```

**Red Flags:**
- `health_score > 0` - Issues detected
- `suspicious_high_reserved_tiers > 0` - Stuck reservations
- `stale_pending_orders > 0` - Expired orders not cleaned up
- `paid_orders_missing_tickets > 0` - Critical issue

**If health_score = 0:** ✅ System is healthy, issue is elsewhere

**If health_score > 0:** ⚠️ Continue to Step 1.2

---

### **Step 1.2: Get Detailed Snapshot**

```sql
-- Full accounting snapshot for event
SELECT 
  tt.name as tier_name,
  tt.quantity as total_capacity,
  tt.reserved_quantity as reserved,
  tt.issued_quantity as issued,
  (tt.quantity - tt.reserved_quantity - tt.issued_quantity) as available,
  ROUND((tt.issued_quantity::numeric / NULLIF(tt.quantity, 0) * 100), 1) as percent_sold,
  tt.status as tier_status,
  -- Health indicators
  CASE 
    WHEN tt.reserved_quantity > tt.quantity * 0.3 THEN '🔴 HIGH_RESERVED'
    WHEN (tt.quantity - tt.reserved_quantity - tt.issued_quantity) < 0 THEN '🔴 NEGATIVE_AVAILABLE'
    WHEN (tt.quantity - tt.reserved_quantity - tt.issued_quantity) = 0 THEN '⚠️ SOLD_OUT'
    ELSE '✅ OK'
  END as health_status
FROM ticketing.ticket_tiers tt
WHERE tt.event_id = 'YOUR_EVENT_ID'
ORDER BY tt.price_cents ASC;
```

**Document findings in incident ticket.**

---

## 🚨 Section 2: Emergency Quick Fix

**ONLY use this if:**
- Event is actively selling
- Customers are complaining
- You need immediate relief

### **Step 2.1: Dry-Run First**

```sql
-- Preview what will be fixed (READ-ONLY)
SELECT * FROM public.reconcile_event_tickets(
  'YOUR_EVENT_ID'::uuid,
  true  -- DRY RUN
);
```

**Review output carefully:**
- Check `holds_affected` - how many holds will be expired
- Check `orders_affected` - how many orders will be canceled
- Check `tiers_updated` - which tiers will change

**If numbers look reasonable:** Proceed to Step 2.2  
**If numbers look suspicious:** STOP and escalate to senior engineer

---

### **Step 2.2: Execute Fix**

```sql
-- Execute actual changes
SELECT * FROM public.reconcile_event_tickets(
  'YOUR_EVENT_ID'::uuid,
  false  -- EXECUTE
);
```

**Monitor output:**
- All steps should show status: 'COMPLETED'
- Final state should show available > 0
- Note the step details for incident report

---

### **Step 2.3: Verify Fix**

```sql
-- Check if tickets are now available
SELECT 
  name,
  (quantity - reserved_quantity - issued_quantity) as available,
  CASE 
    WHEN (quantity - reserved_quantity - issued_quantity) > 0 THEN '✅ NOW AVAILABLE'
    ELSE '❌ STILL SOLD OUT'
  END as status
FROM ticketing.ticket_tiers
WHERE event_id = 'YOUR_EVENT_ID';
```

**If available > 0:** ✅ Success! Refresh app UI  
**If available = 0:** ❌ Deeper issue, escalate

---

## 🔧 Section 3: Cleanup Stuck Reservations

**Use when:** reserved_quantity is suspiciously high

### **Step 3.1: Investigate Holds**

```sql
-- Find expired holds that should be cleaned up
SELECT 
  th.id,
  th.quantity,
  th.created_at,
  th.expires_at,
  EXTRACT(EPOCH FROM (NOW() - th.expires_at)) / 60 as minutes_expired,
  th.status
FROM ticketing.ticket_holds th
JOIN ticketing.ticket_tiers tt ON tt.id = th.tier_id
WHERE tt.event_id = 'YOUR_EVENT_ID'
  AND th.expires_at < NOW()
  AND th.status = 'active'
ORDER BY th.created_at DESC
LIMIT 50;
```

**Expected:** Find holds that are hours/days old (should be < 15 minutes)

---

### **Step 3.2: Run Cleanup (Dry-Run)**

```sql
-- Preview cleanup
SELECT * FROM public.cleanup_expired_ticket_holds(
  'YOUR_EVENT_ID'::uuid,
  true  -- DRY RUN
);
```

---

### **Step 3.3: Execute Cleanup**

```sql
-- Execute cleanup
SELECT * FROM public.cleanup_expired_ticket_holds(
  'YOUR_EVENT_ID'::uuid,
  false  -- EXECUTE
);
```

---

### **Step 3.4: Verify**

```sql
-- Should show reserved_quantity = 0 or very low
SELECT name, reserved_quantity 
FROM ticketing.ticket_tiers
WHERE event_id = 'YOUR_EVENT_ID';
```

---

## 💰 Section 4: Revenue Reconciliation

**Use when:** Revenue doesn't match expected ticket sales

### **Step 4.1: Breakdown Revenue**

```sql
-- Detailed revenue breakdown per order
SELECT 
  o.id as order_id,
  o.status,
  o.total_cents / 100.0 as total_usd,
  o.created_at,
  -- Get order items
  jsonb_agg(
    jsonb_build_object(
      'tier_name', tt.name,
      'quantity', oi.quantity,
      'unit_price', oi.unit_price_cents / 100.0,
      'subtotal', (oi.quantity * oi.unit_price_cents) / 100.0
    )
  ) as items,
  -- Calculate expected subtotal
  SUM(oi.quantity * oi.unit_price_cents) / 100.0 as expected_subtotal,
  -- Calculate fees (difference)
  o.total_cents / 100.0 - SUM(oi.quantity * oi.unit_price_cents) / 100.0 as fees
FROM ticketing.orders o
JOIN ticketing.order_items oi ON oi.order_id = o.id
JOIN ticketing.ticket_tiers tt ON tt.id = oi.tier_id
WHERE o.event_id = 'YOUR_EVENT_ID'
  AND o.status = 'paid'
GROUP BY o.id, o.status, o.total_cents, o.created_at
ORDER BY o.created_at DESC;
```

**Verify:**
- `total_usd = expected_subtotal + fees`
- Fees are typically 3-5% of subtotal
- Large discrepancies indicate data issues

---

### **Step 4.2: Find Orphaned Payments**

```sql
-- Find paid orders that didn't create tickets
SELECT 
  o.id,
  o.user_id,
  o.total_cents / 100.0 as paid_amount,
  o.created_at,
  COUNT(t.id) as tickets_created,
  CASE 
    WHEN COUNT(t.id) = 0 THEN '❌ MISSING TICKETS'
    ELSE '✅ OK'
  END as ticket_status
FROM ticketing.orders o
LEFT JOIN ticketing.tickets t ON t.order_id = o.id
WHERE o.event_id = 'YOUR_EVENT_ID'
  AND o.status = 'paid'
GROUP BY o.id, o.user_id, o.total_cents, o.created_at
HAVING COUNT(t.id) = 0;
```

**If found:** Call `ensure-tickets` Edge Function or manually create tickets

---

## 🔄 Section 5: Prevention & Monitoring

### **Step 5.1: Verify Cron Jobs Are Running**

```sql
-- Check scheduled jobs
SELECT 
  jobid,
  schedule,
  command,
  active,
  jobname
FROM cron.job
WHERE jobname LIKE '%ticket%' 
   OR jobname LIKE '%pending%'
   OR jobname LIKE '%hold%';
```

**Expected:** See 2-3 jobs running every 5 minutes

**If missing:** Run the migration script to create them

---

### **Step 5.2: Check Recent Job Execution**

```sql
-- Check cron job history (if logging enabled)
SELECT 
  jobid,
  runid,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job 
  WHERE jobname LIKE '%ticket%' OR jobname LIKE '%pending%'
)
ORDER BY start_time DESC
LIMIT 20;
```

**Red flags:**
- Jobs failing repeatedly
- Jobs not running (no recent entries)
- Jobs taking > 5 seconds

---

### **Step 5.3: Set Up Alerts**

**PostHog/Monitoring:**
```sql
-- Create alerting view
CREATE OR REPLACE VIEW ticketing.alerts AS
SELECT 
  event_id,
  event_title,
  'HIGH_RESERVED' as alert_type,
  suspicious_high_reserved_tiers as affected_tiers,
  'P2' as priority
FROM ticketing.event_health
WHERE suspicious_high_reserved_tiers > 0

UNION ALL

SELECT 
  event_id,
  event_title,
  'PAID_WITHOUT_TICKETS' as alert_type,
  paid_orders_missing_tickets as affected_orders,
  'P1' as priority
FROM ticketing.event_health
WHERE paid_orders_missing_tickets > 0;
```

**Set up external monitoring to query this view every 5 minutes.**

---

## 📋 Section 6: Incident Response Template

### **When Receiving Ticket Accounting Alert:**

**1. Assess Severity:**
- P1 (Critical): Paid orders missing tickets
- P2 (High): Event showing sold out incorrectly
- P3 (Medium): High reserved quantity
- P4 (Low): Minor accounting drift

**2. Gather Data:**
```sql
-- Run this first
SELECT * FROM ticketing.event_health 
WHERE event_id = 'REPORTED_EVENT_ID';
```

**3. Execute Fix (if P1/P2):**
```sql
-- Dry-run first
SELECT * FROM public.reconcile_event_tickets('EVENT_ID', true);

-- Review output, then execute
SELECT * FROM public.reconcile_event_tickets('EVENT_ID', false);
```

**4. Document:**
- What was the health_score before?
- How many holds/orders were affected?
- What was the root cause?
- Was fix successful?

**5. Notify:**
- Alert event organizer if revenue-impacting
- Update status page if customer-facing
- Post-mortem if recurring issue

---

## 🛠️ Section 7: Advanced Diagnostics

### **Find Recently Modified Tiers:**
```sql
-- Show tiers that changed in last hour
SELECT 
  tt.name,
  tt.reserved_quantity,
  tt.issued_quantity,
  tt.updated_at,
  EXTRACT(EPOCH FROM (NOW() - tt.updated_at)) / 60 as minutes_since_update
FROM ticketing.ticket_tiers tt
WHERE tt.event_id = 'YOUR_EVENT_ID'
  AND tt.updated_at > NOW() - INTERVAL '1 hour'
ORDER BY tt.updated_at DESC;
```

### **Audit Trail - Who Made Changes:**
```sql
-- If you have audit logging enabled
SELECT 
  timestamp,
  user_id,
  action,
  table_name,
  record_id,
  old_values,
  new_values
FROM audit.logged_actions
WHERE table_name = 'ticket_tiers'
  AND record_id IN (
    SELECT id FROM ticketing.ticket_tiers 
    WHERE event_id = 'YOUR_EVENT_ID'
  )
ORDER BY timestamp DESC
LIMIT 50;
```

---

## ⚡ Section 8: Performance Considerations

### **Expected Query Performance:**

| Function | Expected Time | Max Acceptable | Index Used |
|----------|---------------|----------------|------------|
| cleanup_expired_ticket_holds | < 100ms | < 500ms | tier_id, status, expires_at |
| expire_pending_orders | < 100ms | < 500ms | event_id, status, created_at |
| reconcile_issued_quantity | < 200ms | < 1s | tier_id, status |
| event_health view | < 50ms | < 200ms | Multiple indexes |

**If queries exceed max acceptable:**
- Check EXPLAIN ANALYZE
- Verify indexes exist
- Consider partitioning if > 1M records

---

## 🔒 Section 9: Safety Checklist

Before running any repair script:

- [ ] Is this the correct event? (verify event_id)
- [ ] Did you run dry-run mode first?
- [ ] Did you review the dry-run output?
- [ ] Did you check recent job execution logs?
- [ ] Did you notify stakeholders?
- [ ] Do you have database backup/snapshot?
- [ ] Is it during low-traffic hours?

**Never run repair scripts during:**
- Active checkout sessions (check pending orders)
- Scheduled sales launches
- High-traffic periods

---

## 📈 Section 10: Post-Fix Verification

### **Checklist After Running Fix:**

```sql
-- 1. Check health score is 0
SELECT event_id, health_score 
FROM ticketing.event_health 
WHERE event_id = 'YOUR_EVENT_ID';
-- Expected: health_score = 0

-- 2. Verify availability looks correct
SELECT name, quantity, issued_quantity, 
       (quantity - reserved_quantity - issued_quantity) as available
FROM ticketing.ticket_tiers
WHERE event_id = 'YOUR_EVENT_ID';
-- Expected: available matches actual unsold tickets

-- 3. Check no active expired holds remain
SELECT COUNT(*) as should_be_zero
FROM ticketing.ticket_holds th
JOIN ticketing.ticket_tiers tt ON tt.id = th.tier_id
WHERE tt.event_id = 'YOUR_EVENT_ID'
  AND th.status = 'active'
  AND th.expires_at < NOW();
-- Expected: 0

-- 4. Verify UI shows correctly
-- Go to app → event page → click "Get Tickets"
-- Should show correct availability
```

---

## 📞 Section 11: Escalation Path

### **When to Escalate:**

**To Senior Engineer:**
- Fix script doesn't resolve issue
- health_score remains > 0 after fix
- Customers report double-charging

**To Database Team:**
- Constraints blocking legitimate operations
- Cron jobs failing repeatedly
- Performance degradation

**To Product:**
- Revenue reconciliation shows > $1000 discrepancy
- Multiple events affected
- Pattern suggests systemic issue

---

## 📚 Section 12: Reference

### **Key Functions:**

| Function | Purpose | Dry-Run? | Event-Specific? |
|----------|---------|----------|-----------------|
| `reconcile_event_tickets` | Master fix (all steps) | ✅ Yes | ✅ Yes |
| `cleanup_expired_ticket_holds` | Expire holds | ✅ Yes | Optional |
| `expire_pending_orders` | Expire orders | ✅ Yes | Optional |
| `reconcile_issued_quantity` | Sync issued count | ✅ Yes | Optional |

### **Key Views:**

| View | Purpose | Performance |
|------|---------|-------------|
| `ticketing.event_health` | Health monitoring | < 50ms |
| `ticketing.ticket_availability` | Real-time availability | < 20ms |
| `ticketing.alerts` | Active alerts | < 100ms |

### **Cron Jobs:**

| Job Name | Schedule | Function | Purpose |
|----------|----------|----------|---------|
| cleanup-expired-ticket-holds | */5 * * * * | cleanup_expired_ticket_holds | Free expired holds |
| expire-pending-orders | */5 * * * * | expire_pending_orders | Cancel old carts |
| daily-ticket-health-check | 0 9 * * * | Log health issues | Daily audit |

---

## 🎓 Section 13: Training Scenarios

### **Scenario 1: Event Shows Sold Out Incorrectly**

**Steps:**
1. Run health check
2. Identify reserved_quantity = 85 (high)
3. Run reconcile dry-run
4. Execute if safe
5. Verify availability restored
6. Check if cron jobs are running
7. Document in incident report

**Time:** 5-10 minutes

---

### **Scenario 2: Missing Tickets for Paid Order**

**Steps:**
1. Get order_id from customer support
2. Query order details
3. Check if tickets exist for order
4. Call `ensure-tickets` Edge Function
5. Verify tickets created
6. Notify customer

**Time:** 10-15 minutes

---

## 🔄 Section 14: Routine Maintenance

### **Weekly:**
- [ ] Review `ticketing.event_health` for all events
- [ ] Check cron job execution history
- [ ] Verify no events with health_score > 0

### **Monthly:**
- [ ] Archive expired holds older than 90 days
- [ ] Review index performance (EXPLAIN ANALYZE)
- [ ] Check database table sizes (VACUUM if needed)

### **Quarterly:**
- [ ] Audit revenue reconciliation across all events
- [ ] Review and update runbook
- [ ] Training session for new team members

---

**Document Version:** 2.0  
**Last Tested:** 2025-12-04  
**Status:** ✅ Production-Ready

