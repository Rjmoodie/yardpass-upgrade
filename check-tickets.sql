-- Check recent orders with user and event names
SELECT 
    o.id,
    o.stripe_session_id,
    o.status,
    o.paid_at,
    o.total_cents,
    o.currency,
    o.created_at,
    up.display_name as customer_name,
    au.email as customer_email,
    e.title as event_title
FROM orders o
LEFT JOIN user_profiles up ON o.user_id = up.user_id
LEFT JOIN auth.users au ON o.user_id = au.id
LEFT JOIN events e ON o.event_id = e.id
ORDER BY o.created_at DESC 
LIMIT 10;

-- Check tickets for recent orders with names
SELECT 
    t.id as ticket_id,
    t.order_id,
    t.status as ticket_status,
    t.qr_code,
    o.status as order_status,
    o.stripe_session_id,
    o.created_at,
    up.display_name as customer_name,
    au.email as customer_email,
    e.title as event_title
FROM tickets t
JOIN orders o ON t.order_id = o.id
LEFT JOIN user_profiles up ON o.user_id = up.user_id
LEFT JOIN auth.users au ON o.user_id = au.id
LEFT JOIN events e ON o.event_id = e.id
ORDER BY o.created_at DESC
LIMIT 10;

-- Check ticket count for paid orders with names
SELECT 
    o.id as order_id,
    o.status as order_status,
    o.stripe_session_id,
    o.paid_at,
    up.display_name as customer_name,
    au.email as customer_email,
    e.title as event_title,
    COUNT(t.id) as ticket_count
FROM orders o
LEFT JOIN tickets t ON t.order_id = o.id
LEFT JOIN user_profiles up ON o.user_id = up.user_id
LEFT JOIN auth.users au ON o.user_id = au.id
LEFT JOIN events e ON o.event_id = e.id
WHERE o.status = 'paid'
GROUP BY o.id, o.status, o.stripe_session_id, o.paid_at, up.display_name, au.email, e.title
ORDER BY o.paid_at DESC
LIMIT 10;
