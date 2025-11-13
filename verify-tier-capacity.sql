-- ============================================================================
-- VERIFY TIER CAPACITY: General Admission - Ultimate Soccer Tailgate
-- ============================================================================

-- 1. Find the exact tier and check its accounting
SELECT 
  tt.id as tier_id,
  e.title as event_title,
  tt.name as tier_name,
  tt.price_cents / 100.0 as price_usd,
  tt.quantity as total_capacity,
  tt.quantity_sold as quantity_sold_column,
  (tt.quantity - tt.quantity_sold) as available_from_column,
  -- Actual tickets issued
  (SELECT COUNT(*) 
   FROM ticketing.tickets t 
   WHERE t.tier_id = tt.id) as actual_tickets_issued,
  -- Tickets from paid orders
  (SELECT COALESCE(SUM(oi.quantity), 0)
   FROM ticketing.order_items oi
   JOIN ticketing.orders o ON o.id = oi.order_id
   WHERE oi.tier_id = tt.id 
     AND o.status = 'paid') as tickets_from_paid_orders,
  -- Tickets from pending/held orders
  (SELECT COALESCE(SUM(oi.quantity), 0)
   FROM ticketing.order_items oi
   JOIN ticketing.orders o ON o.id = oi.order_id
   WHERE oi.tier_id = tt.id 
     AND o.status IN ('pending', 'reserved')) as tickets_on_hold,
  -- Calculate what should actually be available
  (tt.quantity - 
   (SELECT COALESCE(SUM(oi.quantity), 0)
    FROM ticketing.order_items oi
    JOIN ticketing.orders o ON o.id = oi.order_id
    WHERE oi.tier_id = tt.id 
      AND o.status IN ('paid', 'reserved', 'pending'))
  ) as true_available,
  -- Status check
  CASE 
    WHEN tt.quantity_sold = (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.tier_id = tt.id) THEN '✅ MATCH'
    ELSE '❌ MISMATCH'
  END as accounting_status
FROM ticketing.ticket_tiers tt
JOIN events.events e ON e.id = tt.event_id
WHERE e.title = 'Ultimate Soccer Tailgate Experience'
  AND tt.name = 'General Admission'
  AND tt.price_cents = 25000;

-- 2. Check if quantity_sold is being updated by triggers
SELECT 
  e.title,
  tt.name,
  tt.quantity as capacity,
  tt.quantity_sold,
  tt.quantity - tt.quantity_sold as available_shown,
  (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.tier_id = tt.id) as actual_sold,
  tt.quantity - (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.tier_id = tt.id) as should_show_available,
  CASE 
    WHEN tt.quantity_sold = (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.tier_id = tt.id) 
    THEN '✅ quantity_sold is accurate'
    ELSE '❌ quantity_sold needs update: ' || 
         ((SELECT COUNT(*) FROM ticketing.tickets t WHERE t.tier_id = tt.id) - tt.quantity_sold)::text || 
         ' tickets off'
  END as status
FROM ticketing.ticket_tiers tt
JOIN events.events e ON e.id = tt.event_id
WHERE e.title = 'Ultimate Soccer Tailgate Experience';

-- 3. Check for any triggers that should be updating quantity_sold
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'tickets'
  AND event_object_schema = 'ticketing'
  AND (trigger_name LIKE '%quantity%' OR trigger_name LIKE '%sold%' OR trigger_name LIKE '%capacity%')
ORDER BY trigger_name;

-- 4. Detailed order breakdown for this tier
SELECT 
  o.id as order_id,
  o.status,
  o.created_at::text as order_time,
  oi.quantity as tickets_ordered,
  (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.order_id = o.id AND t.tier_id = oi.tier_id) as tickets_issued,
  o.total_cents / 100.0 as paid_usd
FROM ticketing.order_items oi
JOIN ticketing.orders o ON o.id = oi.order_id
JOIN ticketing.ticket_tiers tt ON tt.id = oi.tier_id
JOIN events.events e ON e.id = tt.event_id
WHERE e.title = 'Ultimate Soccer Tailgate Experience'
  AND tt.name = 'General Admission'
ORDER BY o.created_at DESC
LIMIT 20;

-- 5. Summary for all tiers of this event
SELECT 
  tt.name as tier_name,
  tt.price_cents / 100.0 as price_usd,
  tt.quantity as capacity,
  tt.quantity_sold as quantity_sold_column,
  (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.tier_id = tt.id) as actual_tickets_issued,
  tt.quantity - tt.quantity_sold as available_shown_to_users,
  tt.quantity - (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.tier_id = tt.id) as truly_available,
  CASE 
    WHEN (tt.quantity - tt.quantity_sold) = (tt.quantity - (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.tier_id = tt.id))
    THEN '✅ CORRECT'
    ELSE '❌ WRONG by ' || 
         ((tt.quantity - tt.quantity_sold) - (tt.quantity - (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.tier_id = tt.id)))::text ||
         ' tickets'
  END as availability_accuracy
FROM ticketing.ticket_tiers tt
JOIN events.events e ON e.id = tt.event_id
WHERE e.title = 'Ultimate Soccer Tailgate Experience'
ORDER BY tt.price_cents;


