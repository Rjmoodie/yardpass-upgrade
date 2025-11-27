-- ============================================================================
-- VERIFY ANALYTICS ACCESS PATTERN
-- ============================================================================
-- Understanding how analytics tables are actually accessed
-- ============================================================================

-- ============================================================================
-- PART 1: Check if partitioned tables inherit from parent
-- ============================================================================

SELECT 
    c.relname as partition_name,
    pg_get_expr(c.relpartbound, c.oid) as partition_bound,
    p.relname as parent_table,
    p.relkind as parent_kind,
    CASE 
        WHEN p.relkind = 'p' THEN '✅ Parent is partitioned table'
        ELSE '❌ Parent is not partitioned'
    END as parent_status
FROM pg_class c
JOIN pg_inherits i ON i.inhrelid = c.oid
JOIN pg_class p ON p.oid = i.inhparent
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'analytics'
    AND (
        c.relname LIKE 'analytics_events_%'
        OR c.relname LIKE 'event_impressions_p%'
        OR c.relname LIKE 'ticket_analytics_p%'
    )
ORDER BY p.relname, c.relname;

-- ============================================================================
-- PART 2: Check if parent tables have RLS enabled
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled (partitions inherit this)'
        ELSE '❌ RLS Disabled (partitions also disabled)'
    END as status,
    relkind as table_type
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
WHERE t.schemaname = 'analytics'
    AND t.tablename IN (
        'analytics_events',  -- Parent table
        'event_impressions_p',  -- Parent table
        'ticket_analytics_p'  -- Parent table
    )
ORDER BY tablename;

-- ============================================================================
-- PART 3: Check how analytics tables are accessed in codebase
-- ============================================================================
-- This helps understand if partitioned tables are queried directly
-- or only through RPC functions

-- Check if any RPC functions query partitioned tables directly
SELECT 
    p.proname as function_name,
    n.nspname as schema_name,
    CASE 
        WHEN p.prosecdef THEN '✅ SECURITY DEFINER (bypasses RLS)'
        ELSE '⚠️ SECURITY INVOKER (respects RLS)'
    END as security_mode,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'analytics')
    AND (
        p.proname LIKE '%analytics%'
        OR p.proname LIKE '%funnel%'
        OR p.proname LIKE '%audience%'
    )
    AND p.prosecdef = true  -- SECURITY DEFINER functions
ORDER BY n.nspname, p.proname;

-- ============================================================================
-- PART 4: Check if partitioned tables are separate or part of parent
-- ============================================================================

SELECT 
    'Parent Table' as table_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) 
     FROM pg_inherits i
     JOIN pg_class c ON c.oid = i.inhrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE i.inhparent = (SELECT oid FROM pg_class WHERE relname = pg_tables.tablename)
     AND n.nspname = pg_tables.schemaname
    ) as partition_count
FROM pg_tables
WHERE schemaname = 'analytics'
    AND tablename IN ('analytics_events', 'event_impressions_p', 'ticket_analytics_p')
    AND rowsecurity IS NOT NULL

UNION ALL

SELECT 
    'Partition' as table_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    0 as partition_count
FROM pg_tables
WHERE schemaname = 'analytics'
    AND (
        tablename LIKE 'analytics_events_%'
        OR tablename LIKE 'event_impressions_p_%'
        OR tablename LIKE 'ticket_analytics_p_%'
    )
    AND tablename NOT IN ('analytics_events', 'event_impressions_p', 'ticket_analytics_p')
ORDER BY table_type, schemaname, tablename;

-- ============================================================================
-- PART 5: Summary - Analytics Access Pattern
-- ============================================================================

SELECT 
    'Access Pattern Analysis' as analysis_type,
    'If partitioned tables inherit RLS from parent, they are secure' as insight_1,
    'If RPC functions are SECURITY DEFINER, they bypass RLS anyway' as insight_2,
    'If clients query partitioned tables directly, they need RLS' as insight_3,
    'Check: Are partitioned tables accessed directly or only via RPC?' as recommendation;


