-- Process pending orders and create tickets
-- First, update the pending orders to paid status
UPDATE orders 
SET status = 'paid', paid_at = now() 
WHERE status = 'pending' AND stripe_session_id IS NOT NULL;

-- Create tickets for the processed orders
-- Get order items and create corresponding tickets
INSERT INTO tickets (event_id, tier_id, order_id, owner_user_id, qr_code, status)
SELECT 
  o.event_id,
  oi.tier_id,
  o.id,
  o.user_id,
  'ticket_' || o.id || '_' || oi.tier_id || '_' || extract(epoch from now()) || '_' || generate_random_uuid(),
  'issued'
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status = 'paid' 
  AND o.stripe_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tickets t WHERE t.order_id = o.id
  );

-- Repeat for each quantity of items
INSERT INTO tickets (event_id, tier_id, order_id, owner_user_id, qr_code, status)
SELECT 
  o.event_id,
  oi.tier_id,
  o.id,
  o.user_id,
  'ticket_' || o.id || '_' || oi.tier_id || '_' || extract(epoch from now()) || '_2_' || generate_random_uuid(),
  'issued'
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status = 'paid' 
  AND o.stripe_session_id IS NOT NULL
  AND oi.quantity > 1
  AND NOT EXISTS (
    SELECT 1 FROM tickets t WHERE t.order_id = o.id AND t.qr_code LIKE '%_2_%'
  );