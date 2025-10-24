-- Manual Email Trigger for Recent Orders
-- Use this to manually send confirmation emails for orders that didn't receive them

-- Get the most recent order details for manual email testing
SELECT 
  o.id as order_id,
  o.stripe_session_id,
  o.user_id,
  o.event_id,
  o.contact_email,
  o.contact_name,
  o.total_cents,
  e.title as event_title,
  e.start_at as event_start,
  e.venue,
  e.city,
  (SELECT json_agg(t.id) FROM tickets t WHERE t.order_id = o.id) as ticket_ids,
  (SELECT COUNT(*) FROM tickets t WHERE t.order_id = o.id) as ticket_count,
  (SELECT tt.name FROM order_items oi 
   JOIN ticket_tiers tt ON oi.tier_id = tt.id 
   WHERE oi.order_id = o.id LIMIT 1) as ticket_type
FROM orders o
LEFT JOIN events e ON o.event_id = e.id
WHERE o.id = '90e3a1d7-7e55-4e44-bb27-6c4802f144be' -- Most recent order
LIMIT 1;

-- Check if tickets exist for this order
SELECT 
  id,
  order_id,
  qr_code,
  created_at
FROM tickets
WHERE order_id = '90e3a1d7-7e55-4e44-bb27-6c4802f144be'
ORDER BY created_at DESC;




