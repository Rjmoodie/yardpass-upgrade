-- Check the actual stripe_session_id for your pending order
SELECT 
    id,
    stripe_session_id,
    checkout_session_id,
    status,
    created_at,
    total_cents / 100.0 as total_dollars
FROM orders 
WHERE id = '9faa6c6e-57f1-4824-b48f-62531a9be828';

-- Check all recent orders with their Stripe session IDs
SELECT 
    id,
    stripe_session_id,
    status,
    created_at,
    total_cents / 100.0 as total_dollars
FROM orders 
WHERE created_at > NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC;

