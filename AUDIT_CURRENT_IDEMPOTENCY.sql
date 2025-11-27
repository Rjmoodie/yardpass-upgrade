-- ============================================================
-- AUDIT: Current Idempotency Implementation in Supabase
-- ============================================================
-- Run these queries in Supabase SQL Editor to see what exists
-- ============================================================

-- ============================================================
-- 1. CHECK EXISTING IDEMPOTENCY TABLES
-- ============================================================

-- Check for general idempotency_keys table
SELECT 
    table_name,
    table_schema,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'idempotency_keys' 
     AND table_schema = 'public') as column_count
FROM information_schema.tables
WHERE table_name = 'idempotency_keys'
    AND table_schema = 'public';

-- Check columns in idempotency_keys table (if exists)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'idempotency_keys'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================
-- 2. CHECK STRIPE WEBHOOK TRACKING
-- ============================================================

-- Check for stripe_webhook_events table
SELECT 
    table_name,
    table_schema
FROM information_schema.tables
WHERE table_name LIKE '%webhook%'
    AND table_schema = 'public';

-- Check columns in stripe_webhook_events table (if exists)
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'stripe_webhook_events'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================
-- 3. CHECK EXISTING IDEMPOTENCY CONSTRAINTS/INDEXES
-- ============================================================

-- Check for unique constraints on idempotency keys
SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
    AND (kcu.column_name LIKE '%idempotency%' 
         OR kcu.column_name LIKE '%idempotent%')
ORDER BY tc.table_name, kcu.column_name;

-- Check for indexes on idempotency columns
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexdef LIKE '%idempotency%'
    OR indexdef LIKE '%idempotent%'
ORDER BY tablename;

-- ============================================================
-- 4. CHECK EVENT CREATION IDEMPOTENCY
-- ============================================================

-- Check if events.events has idempotency_key column
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'events'
    AND table_schema = 'events'
    AND column_name LIKE '%idempotency%';

-- ============================================================
-- 5. CHECK WALLET TRANSACTION IDEMPOTENCY
-- ============================================================

-- Check org_wallet_transactions for idempotency_key
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'org_wallet_transactions'
    AND (table_schema = 'organizations' OR table_schema = 'public')
    AND column_name LIKE '%idempotency%';

-- ============================================================
-- 6. CHECK EXISTING IDEMPOTENCY FUNCTIONS
-- ============================================================

-- Check for idempotency-related functions
SELECT
    routine_schema,
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_name LIKE '%idempotency%'
    OR routine_name LIKE '%idempotent%'
ORDER BY routine_name;

-- ============================================================
-- 7. SAMPLE DATA (if tables exist)
-- ============================================================

-- Sample from idempotency_keys (if exists)
-- SELECT * FROM public.idempotency_keys ORDER BY created_at DESC LIMIT 10;

-- Sample from stripe_webhook_events (if exists)
-- SELECT 
--     stripe_event_id,
--     event_type,
--     success,
--     processed_at,
--     created_at
-- FROM public.stripe_webhook_events 
-- ORDER BY created_at DESC 
-- LIMIT 10;

-- ============================================================
-- 8. CHECK WHAT WE'RE PROPOSING TO ADD
-- ============================================================

-- Check if stripe_idempotency_keys table already exists
SELECT 
    table_name,
    table_schema
FROM information_schema.tables
WHERE table_name = 'stripe_idempotency_keys'
    AND table_schema = 'public';

-- ============================================================
-- SUMMARY QUERY: All idempotency-related objects
-- ============================================================

SELECT 
    'TABLE' as object_type,
    table_schema || '.' || table_name as object_name,
    'Table with idempotency support' as description
FROM information_schema.tables
WHERE (table_name LIKE '%idempotency%' 
       OR table_name LIKE '%webhook%'
       OR table_name = 'events')
    AND table_schema IN ('public', 'events', 'organizations')
UNION ALL
SELECT 
    'COLUMN' as object_type,
    table_schema || '.' || table_name || '.' || column_name as object_name,
    'Column for idempotency tracking' as description
FROM information_schema.columns
WHERE column_name LIKE '%idempotency%'
    OR column_name LIKE '%idempotent%'
UNION ALL
SELECT 
    'FUNCTION' as object_type,
    routine_schema || '.' || routine_name as object_name,
    'Function for idempotency checks' as description
FROM information_schema.routines
WHERE routine_name LIKE '%idempotency%'
    OR routine_name LIKE '%idempotent%'
ORDER BY object_type, object_name;

