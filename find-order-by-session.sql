-- Find the order for this specific session ID
SELECT 
    id,
    stripe_session_id,
    status,
    created_at,
    total_cents / 100.0 as total_dollars
FROM orders 
WHERE stripe_session_id = 'cs_test_b1mXmc3s9jaaVclclHbeUzJPQtgdOkadfG7UxJah3i2JTax5DKu1QRAQQH';

-- Also check by checkout_session_id from the metadata
SELECT 
    id,
    stripe_session_id,
    checkout_session_id,
    status,
    created_at,
    total_cents / 100.0 as total_dollars
FROM orders 
WHERE checkout_session_id = '8fbd6f00-1517-4855-940e-91d13e6cd254';

-- Check all orders from the last hour
SELECT 
    id,
    stripe_session_id,
    checkout_session_id,
    status,
    created_at,
    total_cents / 100.0 as total_dollars
FROM orders 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

