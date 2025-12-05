# 🚨 Ticket Accounting Reconciliation Report
**Event:** Liventix Official Event!  
**Event ID:** `28309929-28e7-4bda-af28-6e0b47485ce1`  
**Date:** December 4, 2025  
**Status:** ❌ CRITICAL DISCREPANCIES FOUND

---

## 📊 Data Snapshot

### **Ticket Tier Data:**
```json
{
  "tier_name": "General Admission",
  "price_usd": $50.00,
  "total_capacity": 100,
  "currently_reserved": 90,  // ❌ PROBLEM!
  "tickets_issued": 10,
  "available": 0,
  "percent_sold": "10%"
}
```

### **Orders Data:**
```json
{
  "total_orders": 35,
  "paid_orders": 11,
  "pending_orders": 24,  // ❌ PROBLEM!
  "total_revenue_usd": $682.34
}
```

---

## 🔴 Critical Issues Found

### **Issue #1: Massive Reserved Quantity (90 tickets)**

**Problem:** 90 tickets are marked as "reserved" but likely from expired holds.

**Expected Behavior:**
- Holds expire after 15 minutes
- Cleanup should free these tickets
- Reserved should be 0-5 typically

**Actual:** 90 reserved (90% of inventory stuck!)

**Impact:** Event shows as sold out when 90 tickets might actually be available

---

### **Issue #2: Issued vs Paid Mismatch**

**Problem:** 
- Issued Tickets: 10
- Paid Orders: 11
- **Mismatch: 1 extra paid order with no ticket**

**Expected:** issued_quantity ≥ paid_orders

**Actual:** issued_quantity (10) < paid_orders (11)

**Possible Causes:**
- Trigger failure when creating ticket
- Manual ticket deletion
- Race condition in checkout

---

### **Issue #3: Revenue Doesn't Match**

**Math Check:**
```
Total Revenue: $682.34
Ticket Price: $50.00

Expected Tickets: $682.34 ÷ $50.00 = 13.65 tickets

But issued_quantity = 10 tickets
Revenue for 10 tickets = $500.00

Missing Revenue: $682.34 - $500.00 = $182.34
Missing Tickets: ~3.6 tickets unaccounted for
```

**Theories:**
1. Some orders have fees included in total_cents
2. Processing fees added to revenue
3. Multi-tier orders (but only 1 tier shown)
4. Refunds not reflected

---

### **Issue #4: 24 Pending Orders**

**Problem:** 24 orders stuck in "pending" status

**Expected:** Pending orders should:
- Complete within 15 minutes, OR
- Expire and be canceled

**Actual:** 24 orders permanently pending (likely expired but not cleaned up)

**Impact:** 
- These are probably holding the 90 reserved tickets
- Preventing real customers from purchasing

---

## 🔍 Deep Dive Investigation

### **Query 1: Check Ticket Holds**
Run this to see expired holds:

```sql
-- Check active ticket holds for this event
SELECT 
  th.id,
  th.tier_id,
  th.quantity,
  th.created_at,
  th.expires_at,
  th.status,
  CASE 
    WHEN th.expires_at < NOW() THEN '❌ EXPIRED'
    ELSE '✅ ACTIVE'
  END as hold_status,
  EXTRACT(EPOCH FROM (NOW() - th.expires_at)) / 60 as minutes_expired
FROM ticketing.ticket_holds th
JOIN ticketing.ticket_tiers tt ON tt.id = th.tier_id
WHERE tt.event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
ORDER BY th.created_at DESC;
```

**Expected Result:** Find ~90 tickets in expired holds

---

### **Query 2: Check Pending Orders**
```sql
-- Check pending orders and their status
SELECT 
  o.id,
  o.user_id,
  o.status,
  o.created_at,
  o.total_cents / 100.0 as total_usd,
  EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60 as minutes_old,
  CASE 
    WHEN (NOW() - o.created_at) > INTERVAL '15 minutes' THEN '❌ EXPIRED'
    ELSE '✅ ACTIVE'
  END as order_status
FROM ticketing.orders o
WHERE o.event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
  AND o.status = 'pending'
ORDER BY o.created_at DESC
LIMIT 50;
```

**Expected Result:** Find 24 pending orders, most likely expired

---

### **Query 3: Cross-Reference Tickets to Orders**
```sql
-- Find paid orders that didn't create tickets
SELECT 
  o.id as order_id,
  o.user_id,
  o.status as order_status,
  o.total_cents / 100.0 as paid_amount,
  o.created_at,
  COUNT(t.id) as tickets_created,
  CASE 
    WHEN COUNT(t.id) = 0 THEN '❌ NO TICKETS'
    ELSE '✅ HAS TICKETS'
  END as ticket_status
FROM ticketing.orders o
LEFT JOIN ticketing.tickets t ON t.order_id = o.id
WHERE o.event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
  AND o.status = 'paid'
GROUP BY o.id, o.user_id, o.status, o.total_cents, o.created_at
HAVING COUNT(t.id) = 0;  -- Show only paid orders with no tickets
```

**Expected Result:** Find the 1 paid order that didn't create a ticket

---

## 🔧 Recommended Fixes

### **Fix #1: Clean Up Expired Holds**

**Run this to free the stuck 90 tickets:**

```sql
-- 1. Delete all expired ticket holds
DELETE FROM ticketing.ticket_holds
WHERE expires_at < NOW()
  AND tier_id IN (
    SELECT id FROM ticketing.ticket_tiers 
    WHERE event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
  );

-- 2. Recalculate reserved_quantity for all tiers
UPDATE ticketing.ticket_tiers
SET reserved_quantity = COALESCE(
  (
    SELECT SUM(th.quantity)
    FROM ticketing.ticket_holds th
    WHERE th.tier_id = ticket_tiers.id
      AND th.expires_at > NOW()
      AND th.status = 'active'
  ),
  0
)
WHERE event_id = '28309929-28e7-4bda-af28-6e0b47485ce1';

-- 3. Verify the fix
SELECT 
  name,
  quantity as total,
  reserved_quantity as reserved,
  issued_quantity as issued,
  (quantity - reserved_quantity - issued_quantity) as available
FROM ticketing.ticket_tiers
WHERE event_id = '28309929-28e7-4bda-af28-6e0b47485ce1';
```

**Expected After Fix:**
```
reserved_quantity: 0 (or very low, like 0-5)
available: ~90 tickets
```

---

### **Fix #2: Cancel Expired Pending Orders**

```sql
-- Cancel all pending orders older than 15 minutes
UPDATE ticketing.orders
SET status = 'expired',
    updated_at = NOW()
WHERE event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
  AND status = 'pending'
  AND created_at < NOW() - INTERVAL '15 minutes';

-- Verify
SELECT COUNT(*) as expired_orders
FROM ticketing.orders
WHERE event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
  AND status = 'expired';
```

---

### **Fix #3: Sync Issued Quantity (Safety Check)**

```sql
-- Recalculate issued_quantity from actual tickets table
UPDATE ticketing.ticket_tiers tt
SET issued_quantity = (
  SELECT COUNT(*)
  FROM ticketing.tickets t
  WHERE t.tier_id = tt.id
    AND t.status IN ('issued', 'transferred', 'redeemed')
)
WHERE tt.event_id = '28309929-28e7-4bda-af28-6e0b47485ce1';

-- Verify
SELECT 
  tt.name,
  tt.issued_quantity as column_value,
  COUNT(t.id) as actual_tickets
FROM ticketing.ticket_tiers tt
LEFT JOIN ticketing.tickets t ON t.tier_id = tt.id AND t.status IN ('issued', 'transferred', 'redeemed')
WHERE tt.event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
GROUP BY tt.id, tt.name, tt.issued_quantity;
```

---

## 📋 Reconciliation Summary

### **Expected State (After Cleanup):**

| Metric | Before | After (Expected) |
|--------|--------|------------------|
| **Total Capacity** | 100 | 100 |
| **Reserved** | 90 ❌ | 0-5 ✅ |
| **Issued** | 10 | 10-13 ✅ |
| **Available** | 0 ❌ | 85-90 ✅ |
| **Pending Orders** | 24 ❌ | 0 ✅ |

### **Root Causes:**

1. **Cleanup cron job not running** - Expired holds aren't being deleted
2. **Trigger issues** - Some paid orders didn't create tickets
3. **Order expiration not enforced** - Pending orders staying forever

---

## 🛠️ Long-Term Fixes

### **1. Enable Auto-Cleanup (Cron)**

```sql
-- Schedule cleanup every 5 minutes
SELECT cron.schedule(
  'cleanup-expired-ticket-holds',
  '*/5 * * * *',  -- Every 5 minutes
  $$SELECT public.cleanup_expired_ticket_holds()$$
);

-- Verify cron is running
SELECT * FROM cron.job;
```

### **2. Add Order Expiration Job**

```sql
-- Create function to expire old pending orders
CREATE OR REPLACE FUNCTION public.expire_pending_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Expire orders older than 15 minutes
  UPDATE ticketing.orders
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '15 minutes';
    
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$$;

-- Schedule it
SELECT cron.schedule(
  'expire-pending-orders',
  '*/5 * * * *',
  $$SELECT public.expire_pending_orders()$$
);
```

### **3. Fix Missing Ticket Creation**

Check why paid order didn't create ticket:

```sql
-- Find the problematic paid order
SELECT 
  o.id,
  o.user_id,
  o.created_at,
  o.total_cents / 100.0 as paid_amount,
  COUNT(t.id) as tickets_created
FROM ticketing.orders o
LEFT JOIN ticketing.tickets t ON t.order_id = o.id
WHERE o.event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
  AND o.status = 'paid'
GROUP BY o.id
HAVING COUNT(t.id) = 0;

-- Manually create the missing ticket (if needed)
-- Get order details first, then run ensure-tickets Edge Function
```

---

## 🎯 Immediate Action Plan

### **Step 1: Run Cleanup (Now)**
```sql
-- Run both cleanup functions
SELECT public.cleanup_expired_ticket_holds();
SELECT public.expire_pending_orders();
```

### **Step 2: Verify Results**
```sql
-- Check if tickets are now available
SELECT 
  name,
  quantity as total,
  reserved_quantity as reserved,
  issued_quantity as issued,
  (quantity - reserved_quantity - issued_quantity) as available,
  CASE 
    WHEN (quantity - reserved_quantity - issued_quantity) > 0 THEN '✅ AVAILABLE'
    ELSE '❌ SOLD OUT'
  END as status
FROM ticketing.ticket_tiers
WHERE event_id = '28309929-28e7-4bda-af28-6e0b47485ce1';
```

### **Step 3: Test Purchase Flow**
1. Refresh the ticket modal in the app
2. "General Admission" should now show available tickets
3. Try to purchase - should work

---

## 📈 Expected After Cleanup

### **Before:**
```
Total: 100
Reserved: 90 ❌ (stuck holds)
Issued: 10
Available: 0 ❌
Status: SOLD OUT
```

### **After:**
```
Total: 100
Reserved: 0 ✅
Issued: 10-13 ✅
Available: 87-90 ✅
Status: AVAILABLE
```

---

## 🔎 Additional Diagnostics

### **Check Hold Details:**
```sql
-- See all holds (expired and active)
SELECT 
  th.id,
  th.quantity,
  th.user_id,
  th.created_at,
  th.expires_at,
  EXTRACT(EPOCH FROM (NOW() - th.expires_at)) / 60 as minutes_expired,
  CASE 
    WHEN th.expires_at < NOW() THEN '❌ EXPIRED'
    ELSE '✅ ACTIVE'
  END as status
FROM ticketing.ticket_holds th
JOIN ticketing.ticket_tiers tt ON tt.id = th.tier_id
WHERE tt.event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
ORDER BY th.created_at DESC;
```

### **Check Revenue Reconciliation:**
```sql
-- Break down revenue by order
SELECT 
  o.id,
  o.status,
  o.total_cents / 100.0 as amount_usd,
  oi.quantity as tickets_in_order,
  oi.unit_price_cents / 100.0 as ticket_price,
  (oi.quantity * oi.unit_price_cents) / 100.0 as subtotal,
  o.total_cents / 100.0 - (oi.quantity * oi.unit_price_cents) / 100.0 as fees
FROM ticketing.orders o
JOIN ticketing.order_items oi ON oi.order_id = o.id
WHERE o.event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
  AND o.status = 'paid'
ORDER BY o.created_at DESC;
```

This will show if fees are included in total_cents (explaining the $682 vs $500 discrepancy).

---

## 🚀 Complete Fix Script

Run this entire script in Supabase SQL Editor:

```sql
-- ============================================================================
-- COMPLETE FIX FOR LIVENTIX OFFICIAL EVENT ACCOUNTING
-- ============================================================================

BEGIN;

-- 1. Delete all expired ticket holds
DELETE FROM ticketing.ticket_holds
WHERE expires_at < NOW()
  AND tier_id IN (
    SELECT id FROM ticketing.ticket_tiers 
    WHERE event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
  );

-- 2. Expire old pending orders
UPDATE ticketing.orders
SET status = 'expired',
    updated_at = NOW()
WHERE event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
  AND status = 'pending'
  AND created_at < NOW() - INTERVAL '15 minutes';

-- 3. Recalculate reserved_quantity
UPDATE ticketing.ticket_tiers
SET reserved_quantity = COALESCE(
  (
    SELECT SUM(th.quantity)
    FROM ticketing.ticket_holds th
    WHERE th.tier_id = ticket_tiers.id
      AND th.expires_at > NOW()
      AND th.status = 'active'
  ),
  0
)
WHERE event_id = '28309929-28e7-4bda-af28-6e0b47485ce1';

-- 4. Sync issued_quantity from actual tickets
UPDATE ticketing.ticket_tiers tt
SET issued_quantity = (
  SELECT COUNT(*)
  FROM ticketing.tickets t
  WHERE t.tier_id = tt.id
    AND t.status IN ('issued', 'transferred', 'redeemed')
)
WHERE tt.event_id = '28309929-28e7-4bda-af28-6e0b47485ce1';

-- 5. Verify the fix
SELECT 
  '✅ AFTER CLEANUP' as stage,
  name as tier_name,
  quantity as total,
  reserved_quantity as reserved,
  issued_quantity as issued,
  (quantity - reserved_quantity - issued_quantity) as available,
  CASE 
    WHEN (quantity - reserved_quantity - issued_quantity) > 0 THEN '✅ AVAILABLE'
    ELSE '❌ SOLD OUT'
  END as status
FROM ticketing.ticket_tiers
WHERE event_id = '28309929-28e7-4bda-af28-6e0b47485ce1';

COMMIT;
```

---

## ⚠️ Prevention Measures

### **1. Enable Cron Jobs**
```sql
-- Cleanup expired holds every 5 minutes
SELECT cron.schedule(
  'cleanup-ticket-holds',
  '*/5 * * * *',
  $$SELECT public.cleanup_expired_ticket_holds()$$
);

-- Expire pending orders every 5 minutes
SELECT cron.schedule(
  'expire-pending-orders', 
  '*/5 * * * *',
  $$
  UPDATE ticketing.orders
  SET status = 'expired'
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '15 minutes'
  $$
);
```

### **2. Add Monitoring**
```sql
-- Alert when reserved_quantity is suspiciously high
CREATE OR REPLACE FUNCTION public.check_stuck_reservations()
RETURNS TABLE(event_id UUID, tier_name TEXT, stuck_quantity INTEGER)
LANGUAGE sql
AS $$
  SELECT 
    tt.event_id,
    tt.name,
    tt.reserved_quantity
  FROM ticketing.ticket_tiers tt
  WHERE tt.reserved_quantity > (tt.quantity * 0.3)  -- > 30% reserved is suspicious
    AND tt.reserved_quantity > 10;
$$;
```

---

## 📊 Final Reconciliation Table

| Metric | Current (Broken) | After Fix (Expected) | Difference |
|--------|------------------|----------------------|------------|
| Total Capacity | 100 | 100 | - |
| Reserved | 90 ❌ | 0-5 ✅ | -85 to -90 |
| Issued | 10 | 10-13 | 0 to +3 |
| Available | 0 ❌ | 85-90 ✅ | +85 to +90 |
| Pending Orders | 24 ❌ | 0 ✅ | -24 |
| Paid Orders | 11 | 11 | - |
| Revenue | $682.34 | $682.34 | - |

---

## 🎯 Next Steps

1. **Run the Complete Fix Script** (from section above)
2. **Enable Cron Jobs** (if not already enabled)
3. **Verify tickets are available** (refresh UI)
4. **Check for missing ticket creation** (1 paid order)
5. **Test purchase flow** (end-to-end)

---

**Recommendation:** Run the fix script immediately to free up the 85-90 stuck tickets!

**Root Cause:** Cleanup jobs not running → holds expire but aren't deleted → reserved_quantity never decrements → tickets appear sold out

**Status:** 🔴 CRITICAL - Event showing sold out when ~90% of tickets are actually available

