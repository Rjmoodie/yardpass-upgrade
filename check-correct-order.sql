-- Check the order that was actually processed
SELECT 
  o.id as order_id,
  o.status,
  o.contact_email,
  o.contact_name,
  o.user_id,
  o.stripe_session_id,
  o.total_cents,
  o.created_at,
  o.paid_at,
  e.title as event_title,
  au.email as auth_email
FROM orders o
LEFT JOIN events e ON e.id = o.event_id
LEFT JOIN auth.users au ON au.id = o.user_id
WHERE o.id = 'a5132a06-5287-409c-8a48-92c8ec34029e';

-- Also check if there are tickets for this order
SELECT 
  t.id as ticket_id,
  t.order_id,
  t.qr_code,
  t.created_at,
  tt.name as tier_name
FROM tickets t
LEFT JOIN ticket_tiers tt ON tt.id = t.tier_id
WHERE t.order_id = 'a5132a06-5287-409c-8a48-92c8ec34029e';
