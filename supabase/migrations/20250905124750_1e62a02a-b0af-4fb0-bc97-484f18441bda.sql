-- Process pending orders and create tickets
-- First, update the pending orders to paid status
UPDATE orders 
SET status = 'paid', paid_at = now() 
WHERE status = 'pending' AND stripe_session_id IS NOT NULL;

-- Create tickets for each order item
WITH order_tickets AS (
  SELECT 
    o.event_id,
    oi.tier_id,
    o.id as order_id,
    o.user_id as owner_user_id,
    oi.quantity,
    generate_series(1, oi.quantity) as ticket_num
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status = 'paid' 
    AND o.stripe_session_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM tickets t WHERE t.order_id = o.id
    )
)
INSERT INTO tickets (event_id, tier_id, order_id, owner_user_id, qr_code, status)
SELECT 
  event_id,
  tier_id,
  order_id,
  owner_user_id,
  'ticket_' || order_id || '_' || tier_id || '_' || extract(epoch from now()) || '_' || ticket_num,
  'issued'
FROM order_tickets;