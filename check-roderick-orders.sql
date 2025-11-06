-- Check orders for roderickmoodie@yahoo.com
SELECT 
  o.id as order_id,
  o.user_id,
  o.event_id,
  o.status,
  o.total_cents,
  o.created_at,
  o.stripe_session_id,
  o.contact_email,
  e.title as event_title
FROM orders o
LEFT JOIN events e ON e.id = o.event_id
WHERE o.user_id = '441507ca-b625-4cb6-bdf6-0236f3e48de9'
   OR o.contact_email = 'roderickmoodie@yahoo.com'
ORDER BY o.created_at DESC
LIMIT 5;

-- Check tickets for this user
SELECT 
  t.id as ticket_id,
  t.order_id,
  t.buyer_id,
  t.status,
  t.tier_name,
  t.created_at,
  e.title as event_title
FROM tickets t
LEFT JOIN events e ON e.id = t.event_id
WHERE t.buyer_id = '441507ca-b625-4cb6-bdf6-0236f3e48de9'
   OR t.buyer_email = 'roderickmoodie@yahoo.com'
ORDER BY t.created_at DESC
LIMIT 5;

-- Check recent guest-checkout sessions
SELECT 
  id,
  user_id,
  event_id,
  status,
  stripe_session_id,
  created_at,
  expires_at
FROM checkout_sessions
WHERE user_id = '441507ca-b625-4cb6-bdf6-0236f3e48de9'
ORDER BY created_at DESC
LIMIT 5;

