-- Debug Email System - Check recent orders and email triggers

-- 1. Check recent orders and their status
SELECT 
  o.id,
  o.status,
  o.stripe_session_id,
  o.contact_email,
  o.contact_name,
  o.user_id,
  o.event_id,
  o.paid_at,
  o.created_at,
  e.title as event_title,
  (SELECT COUNT(*) FROM tickets WHERE order_id = o.id) as tickets_count
FROM orders o
LEFT JOIN events e ON o.event_id = e.id
WHERE o.created_at > NOW() - INTERVAL '24 hours'
ORDER BY o.created_at DESC
LIMIT 10;

-- 2. Check if tickets were created for recent orders
SELECT 
  t.id as ticket_id,
  t.order_id,
  t.created_at as ticket_created_at,
  o.status as order_status,
  o.contact_email,
  o.paid_at,
  o.created_at as order_created_at
FROM tickets t
JOIN orders o ON t.order_id = o.id
WHERE t.created_at > NOW() - INTERVAL '24 hours'
ORDER BY t.created_at DESC
LIMIT 10;

-- 3. Check user emails for recent orders
SELECT 
  o.id as order_id,
  o.user_id,
  o.contact_email as order_contact_email,
  au.email as auth_email,
  up.display_name,
  o.status,
  o.paid_at
FROM orders o
LEFT JOIN auth.users au ON o.user_id = au.id
LEFT JOIN user_profiles up ON o.user_id = up.user_id
WHERE o.created_at > NOW() - INTERVAL '24 hours'
ORDER BY o.created_at DESC
LIMIT 10;

-- 4. Check if there are any pending orders that need processing
SELECT 
  id,
  status,
  stripe_session_id,
  contact_email,
  created_at,
  paid_at
FROM orders
WHERE status = 'pending'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 5. Check for orders that are paid but have no tickets
SELECT 
  o.id,
  o.status,
  o.stripe_session_id,
  o.contact_email,
  o.paid_at,
  o.created_at,
  (SELECT COUNT(*) FROM tickets WHERE order_id = o.id) as tickets_count
FROM orders o
WHERE o.status = 'paid'
  AND o.created_at > NOW() - INTERVAL '24 hours'
  AND (SELECT COUNT(*) FROM tickets WHERE order_id = o.id) = 0
ORDER BY o.created_at DESC;




