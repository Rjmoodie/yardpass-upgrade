# 🔍 Ticket Accounting Audit

Run these queries to verify ticket counts match revenue and orders.

---

## Query 1: System Overview

```sql
SELECT 
  (SELECT COUNT(*) FROM ticketing.orders WHERE status = 'paid') as paid_orders,
  (SELECT COUNT(*) FROM ticketing.tickets) as total_tickets_issued,
  (SELECT COUNT(*) FROM ticketing.tickets WHERE created_at > now() - interval '24 hours') as tickets_last_24h,
  (SELECT SUM(total_cents) FROM ticketing.orders WHERE status = 'paid') / 100.0 as total_revenue_usd;
```

---

## Query 2: Order-Level Reconciliation

```sql
-- Check if every paid order has the correct number of tickets
WITH order_check AS (
  SELECT 
    o.id,
    o.created_at,
    o.total_cents / 100.0 as paid_usd,
    (SELECT SUM(quantity) FROM ticketing.order_items oi WHERE oi.order_id = o.id) as should_have,
    (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.order_id = o.id) as actually_has
  FROM ticketing.orders o
  WHERE o.status = 'paid'
)
SELECT 
  CASE 
    WHEN should_have = actually_has THEN '✅ MATCH'
    WHEN should_have > actually_has THEN '❌ MISSING'
    WHEN should_have < actually_has THEN '⚠️ EXTRA'
  END as status,
  COUNT(*) as order_count,
  SUM(should_have) as total_expected,
  SUM(actually_has) as total_actual,
  SUM(paid_usd) as revenue_usd
FROM order_check
GROUP BY 
  CASE 
    WHEN should_have = actually_has THEN '✅ MATCH'
    WHEN should_have > actually_has THEN '❌ MISSING'
    WHEN should_have < actually_has THEN '⚠️ EXTRA'
  END;
```

**Expected:**
```
✅ MATCH | 100% of orders | Expected = Actual
```

---

## Query 3: By Event/Organizer

```sql
-- Revenue and ticket accounting by event
SELECT 
  e.title as event_title,
  up.display_name as organizer,
  (SELECT COUNT(*) FROM ticketing.orders o WHERE o.event_id = e.id AND o.status = 'paid') as paid_orders,
  (SELECT SUM(o.total_cents) FROM ticketing.orders o WHERE o.event_id = e.id AND o.status = 'paid') / 100.0 as revenue_usd,
  (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.event_id = e.id) as tickets_issued,
  (SELECT SUM(oi.quantity) 
   FROM ticketing.order_items oi 
   JOIN ticketing.orders o ON o.id = oi.order_id
   WHERE oi.tier_id IN (SELECT id FROM ticketing.ticket_tiers WHERE event_id = e.id)
     AND o.status = 'paid'
  ) as expected_from_orders,
  CASE 
    WHEN (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.event_id = e.id) = 
         (SELECT COALESCE(SUM(oi.quantity), 0)
          FROM ticketing.order_items oi 
          JOIN ticketing.orders o ON o.id = oi.order_id
          WHERE oi.tier_id IN (SELECT id FROM ticketing.ticket_tiers WHERE event_id = e.id)
            AND o.status = 'paid'
         ) THEN '✅'
    ELSE '❌'
  END as accounting_status
FROM events.events e
LEFT JOIN users.user_profiles up ON up.user_id = e.created_by
WHERE EXISTS (SELECT 1 FROM ticketing.orders o WHERE o.event_id = e.id AND o.status = 'paid')
ORDER BY revenue_usd DESC NULLS LAST;
```

---

## Query 4: Tier-Level Capacity Check

```sql
-- Verify each tier's quantity_sold matches actual tickets
SELECT 
  e.title as event_title,
  tt.name as tier_name,
  tt.price_cents / 100.0 as price_usd,
  tt.quantity as capacity,
  tt.quantity_sold as quantity_sold_column,
  (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.tier_id = tt.id) as actual_tickets,
  CASE 
    WHEN tt.quantity_sold = (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.tier_id = tt.id) THEN '✅'
    ELSE '❌ MISMATCH'
  END as status,
  (tt.price_cents / 100.0) * (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.tier_id = tt.id) as actual_revenue_usd
FROM ticketing.ticket_tiers tt
JOIN events.events e ON e.id = tt.event_id
WHERE EXISTS (SELECT 1 FROM ticketing.tickets t WHERE t.tier_id = tt.id)
ORDER BY 
  CASE WHEN tt.quantity_sold = (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.tier_id = tt.id) THEN 1 ELSE 0 END,
  actual_revenue_usd DESC;
```

---

## Query 5: Find Any Orphaned or Problematic Data

```sql
-- Check for data integrity issues
SELECT 
  '❌ Orders with no items' as issue,
  COUNT(*) as count
FROM ticketing.orders o
WHERE o.status = 'paid'
  AND NOT EXISTS (SELECT 1 FROM ticketing.order_items oi WHERE oi.order_id = o.id)

UNION ALL

SELECT 
  '❌ Tickets with invalid tier' as issue,
  COUNT(*) as count
FROM ticketing.tickets t
WHERE NOT EXISTS (SELECT 1 FROM ticketing.ticket_tiers tt WHERE tt.id = t.tier_id)

UNION ALL

SELECT 
  '❌ Tickets with invalid order' as issue,
  COUNT(*) as count
FROM ticketing.tickets t
WHERE NOT EXISTS (SELECT 1 FROM ticketing.orders o WHERE o.id = t.order_id)

UNION ALL

SELECT 
  '❌ Tickets with invalid event' as issue,
  COUNT(*) as count
FROM ticketing.tickets t
WHERE NOT EXISTS (SELECT 1 FROM events.events e WHERE e.id = t.event_id)

UNION ALL

SELECT 
  '✅ All data valid' as issue,
  CASE WHEN (
    SELECT COUNT(*) FROM (
      SELECT COUNT(*) FROM ticketing.orders o WHERE o.status = 'paid' AND NOT EXISTS (SELECT 1 FROM ticketing.order_items oi WHERE oi.order_id = o.id)
      UNION ALL
      SELECT COUNT(*) FROM ticketing.tickets t WHERE NOT EXISTS (SELECT 1 FROM ticketing.ticket_tiers tt WHERE tt.id = t.tier_id)
      UNION ALL
      SELECT COUNT(*) FROM ticketing.tickets t WHERE NOT EXISTS (SELECT 1 FROM ticketing.orders o WHERE o.id = t.order_id)
      UNION ALL
      SELECT COUNT(*) FROM ticketing.tickets t WHERE NOT EXISTS (SELECT 1 FROM events.events e WHERE e.id = t.event_id)
    ) issues
  ) = 0 THEN 1 ELSE 0 END as count;

-- 6. Revenue Reconciliation
SELECT 
  'Revenue from orders.total_cents' as source,
  SUM(total_cents) / 100.0 as revenue_usd
FROM ticketing.orders
WHERE status = 'paid'

UNION ALL

SELECT 
  'Revenue from order_items.total_price_cents' as source,
  SUM(total_price_cents) / 100.0 as revenue_usd
FROM ticketing.order_items oi
JOIN ticketing.orders o ON o.id = oi.order_id
WHERE o.status = 'paid'

UNION ALL

SELECT 
  'Revenue from tickets * tier prices' as source,
  SUM(tt.price_cents) / 100.0 as revenue_usd
FROM ticketing.tickets t
JOIN ticketing.ticket_tiers tt ON tt.id = t.tier_id
JOIN ticketing.orders o ON o.id = t.order_id
WHERE o.status = 'paid';
```

**All 3 revenue sources should match!**

---

## Expected Results

### Query 1: Should show
- Total tickets issued
- Total revenue
- Recent activity

### Query 2: Should show
- ✅ MATCH for 100% of orders
- No ❌ MISSING TICKETS rows

### Query 3: Should return
- **0 rows** (no mismatches)

### Query 4: Should show
- ✅ for all tiers (quantity_sold = actual_tickets)

### Query 5: Should show
- ✅ All data valid = 1
- All other counts = 0

### Query 6: Should show
- All 3 revenue sources match exactly

---

## If You Find Mismatches

Paste the results and I'll help you:
1. Identify which orders/events have issues
2. Fix any missing tickets
3. Update quantity_sold counters
4. Reconcile revenue



