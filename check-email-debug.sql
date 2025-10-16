-- Check the order details and email information
SELECT 
  o.id as order_id,
  o.status,
  o.contact_email,
  o.contact_name,
  o.user_id,
  o.stripe_session_id,
  o.total_cents,
  o.created_at,
  e.title as event_title,
  -- Try to get user email from auth
  au.email as auth_email
FROM orders o
LEFT JOIN events e ON e.id = o.event_id
LEFT JOIN auth.users au ON au.id = o.user_id
WHERE o.stripe_session_id = 'cs_test_b1Dnt17rNpN4XIQqtuR4tk37V7a2QrAQdY1lTgOo6HL8d9RBY0m16zusQh'
ORDER BY o.created_at DESC
LIMIT 1;
