-- ============================================================================
-- DATABASE STATE ANALYSIS - Understanding Current Database Structure
-- ============================================================================
-- Run these queries to understand what tables exist, their RLS status,
-- and which ones intentionally have less restriction
-- ============================================================================

-- ============================================================================
-- PART 1: Complete Table Inventory with RLS Status
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ ENABLED'
        ELSE '❌ DISABLED'
    END as rls_status,
    rowsecurity as rls_enabled,
    CASE 
        WHEN tablename LIKE '%audit%' OR tablename LIKE '%log%' THEN '📋 Audit/Log'
        WHEN tablename LIKE '%analytics%' OR tablename LIKE '%mv_%' THEN '📊 Analytics'
        WHEN tablename IN ('model_feature_weights', 'outbox', 'kv_store') THEN '🔧 System/Internal'
        WHEN tablename LIKE '%settings%' OR tablename = 'platform_settings' THEN '⚙️ Settings/Config'
        WHEN tablename LIKE '%cache%' OR tablename LIKE '%queue%' THEN '💾 Cache/Queue'
        WHEN tablename IN ('user_profiles', 'users', 'organizations') THEN '👥 Core User Data'
        WHEN tablename LIKE '%ticket%' OR tablename LIKE '%order%' OR tablename LIKE '%payment%' THEN '💰 Financial'
        WHEN tablename LIKE '%event%' THEN '🎉 Events'
        WHEN tablename LIKE '%post%' OR tablename LIKE '%comment%' THEN '💬 Social/Content'
        ELSE '📦 Other'
    END as table_category
FROM pg_tables 
WHERE schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics', 'payments', 'sponsorship')
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE '_prisma%'
ORDER BY 
    schemaname,
    CASE WHEN rowsecurity THEN 1 ELSE 0 END, -- Show disabled first
    table_category,
    tablename;

-- ============================================================================
-- PART 2: Tables That Should Be Service-Role Only (Internal/System Tables)
-- ============================================================================
-- These tables are intentionally restricted and don't need strict RLS

SELECT 
    schemaname || '.' || tablename as table_name,
    '🔧 System/Internal Table' as table_type,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled (Good)'
        ELSE '❌ RLS Disabled (Fix: Enable with deny-all policy)'
    END as status,
    CASE 
        WHEN tablename IN ('model_feature_weights', 'outbox') THEN 'ML/Message Queue - Should be service_role only'
        WHEN tablename LIKE '%cache%' OR tablename LIKE '%queue%' THEN 'Cache/Queue - Should be service_role only'
        WHEN tablename LIKE '%audit%' OR tablename LIKE '%log%' THEN 'Audit/Log - Should be service_role only'
        ELSE 'Review if this should be internal'
    END as notes
FROM pg_tables
WHERE schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
    AND (
        tablename IN ('model_feature_weights', 'outbox', 'kv_store')
        OR tablename LIKE '%cache%'
        OR tablename LIKE '%queue%'
        OR tablename LIKE '%audit%'
        OR tablename LIKE '%log%'
        OR tablename LIKE '%refresh%'
    )
ORDER BY schemaname, tablename;

-- ============================================================================
-- PART 3: Analytics/Materialized Views (Should Be Service-Role Only)
-- ============================================================================

SELECT 
    schemaname,
    viewname,
    '📊 Analytics View' as view_type,
    CASE 
        WHEN relkind = 'm' THEN 'Materialized View'
        ELSE 'View'
    END as view_kind,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_privileges tp
            WHERE tp.table_schema = pg_views.schemaname
            AND tp.table_name = pg_views.viewname
            AND tp.grantee IN ('anon', 'authenticated')
        ) THEN '⚠️ Exposed to API (Consider locking down)'
        ELSE '✅ Locked down (service_role only)'
    END as access_status
FROM pg_views
LEFT JOIN pg_class c ON c.relname = viewname
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = schemaname
WHERE schemaname IN ('public', 'analytics')
    AND (
        viewname LIKE '%analytics%'
        OR viewname LIKE '%mv_%'
        OR viewname LIKE '%trending%'
        OR viewname LIKE '%affinity%'
        OR viewname LIKE '%kpi%'
        OR viewname LIKE '%dashboard%'
    )
ORDER BY schemaname, viewname;

-- ============================================================================
-- PART 4: Public Read-Only Tables (Intentionally Less Restricted)
-- ============================================================================
-- These tables are meant to be read by anyone, don't need strict user filtering

SELECT 
    schemaname || '.' || tablename as table_name,
    '📖 Public Read-Only' as table_type,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled (May have public read policy)'
        ELSE '❌ RLS Disabled (Review: Should this be public?)'
    END as status,
    CASE 
        WHEN tablename = 'platform_settings' THEN 'Platform config - Anyone can read, only service_role writes'
        WHEN tablename LIKE '%settings%' THEN 'Settings - Review if public read is intentional'
        ELSE 'Review if public access is intentional'
    END as notes
FROM pg_tables
WHERE schemaname IN ('public', 'users')
    AND (
        tablename = 'platform_settings'
        OR tablename LIKE '%settings%'
        OR tablename LIKE '%config%'
        OR tablename LIKE '%taxonomy%'
        OR tablename LIKE '%lookup%'
    )
ORDER BY schemaname, tablename;

-- ============================================================================
-- PART 5: SECURITY DEFINER Views (Intentional Architecture)
-- ============================================================================
-- These views intentionally bypass RLS - documented in SECURITY_DEFINER_VIEWS_RATIONALE.md

SELECT
    schemaname,
    viewname,
    '🔐 SECURITY DEFINER' as view_type,
    CASE 
        WHEN viewname IN ('events', 'event_posts', 'event_comments', 'event_reactions') THEN '✅ Core Data (Intentional - RLS recursion fix)'
        WHEN viewname LIKE '%analytics%' OR viewname LIKE '%mv_%' THEN '✅ Analytics (Intentional - Global aggregation)'
        WHEN viewname LIKE '%ticket%' OR viewname LIKE '%order%' OR viewname LIKE '%payment%' THEN '⚠️ Financial (Review if should respect RLS)'
        WHEN viewname LIKE '%user%' AND viewname LIKE '%profile%' THEN '⚠️ User Data (Review if should respect RLS)'
        ELSE '⚠️ Review'
    END as security_assessment
FROM pg_views
WHERE schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing')
    AND EXISTS (
        SELECT 1 
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = viewname
        AND n.nspname = schemaname
        AND c.relkind = 'v'
        AND (
            -- Check if it's SECURITY DEFINER
            EXISTS (
                SELECT 1 FROM pg_options_to_table(c.reloptions)
                WHERE option_name = 'security_invoker' AND option_value = 'false'
            )
            OR EXISTS (
                SELECT 1 FROM pg_proc p
                WHERE p.proname = viewname
                AND p.prosecdef = true
            )
        )
    )
ORDER BY 
    CASE security_assessment 
        WHEN '✅ Core Data (Intentional - RLS recursion fix)' THEN 1
        WHEN '✅ Analytics (Intentional - Global aggregation)' THEN 2
        ELSE 3
    END,
    schemaname,
    viewname;

-- ============================================================================
-- PART 6: Policy Counts by Table Category
-- ============================================================================
-- Understanding which tables have policies and which don't

WITH table_categories AS (
    SELECT 
        t.schemaname || '.' || t.tablename as full_table_name,
        t.tablename,
        CASE 
            WHEN t.tablename LIKE '%audit%' OR t.tablename LIKE '%log%' THEN '📋 Audit/Log'
            WHEN t.tablename LIKE '%analytics%' THEN '📊 Analytics'
            WHEN t.tablename IN ('model_feature_weights', 'outbox') THEN '🔧 System/Internal'
            WHEN t.tablename = 'platform_settings' THEN '⚙️ Settings'
            WHEN t.tablename LIKE '%ticket%' OR t.tablename LIKE '%order%' THEN '💰 Financial'
            WHEN t.tablename LIKE '%event%' THEN '🎉 Events'
            WHEN t.tablename LIKE '%user%' OR t.tablename = 'organizations' THEN '👥 User Data'
            ELSE '📦 Other'
        END as category
    FROM pg_tables t
    WHERE t.schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
        AND t.tablename NOT LIKE 'pg_%'
        AND t.tablename NOT LIKE '_prisma%'
)
SELECT 
    tc.category,
    COUNT(DISTINCT tc.full_table_name) as table_count,
    COUNT(DISTINCT CASE WHEN t.rowsecurity THEN tc.full_table_name END) as tables_with_rls,
    COUNT(DISTINCT CASE WHEN NOT t.rowsecurity THEN tc.full_table_name END) as tables_without_rls,
    COUNT(DISTINCT p.policyname) as total_policies,
    COUNT(DISTINCT CASE WHEN p.cmd = 'SELECT' THEN p.policyname END) as select_policies,
    COUNT(DISTINCT CASE WHEN p.cmd = 'INSERT' THEN p.policyname END) as insert_policies,
    COUNT(DISTINCT CASE WHEN p.cmd = 'UPDATE' THEN p.policyname END) as update_policies,
    COUNT(DISTINCT CASE WHEN p.cmd = 'DELETE' THEN p.policyname END) as delete_policies
FROM table_categories tc
LEFT JOIN pg_tables t ON t.schemaname || '.' || t.tablename = tc.full_table_name
LEFT JOIN pg_policies p ON p.schemaname || '.' || p.tablename = tc.full_table_name
GROUP BY tc.category
ORDER BY 
    CASE tc.category
        WHEN '💰 Financial' THEN 1
        WHEN '👥 User Data' THEN 2
        WHEN '🎉 Events' THEN 3
        WHEN '💬 Social/Content' THEN 4
        WHEN '🔧 System/Internal' THEN 5
        WHEN '📊 Analytics' THEN 6
        ELSE 7
    END;

-- ============================================================================
-- PART 7: Tables with RLS But No Policies (Needs Attention)
-- ============================================================================

SELECT 
    t.schemaname || '.' || t.tablename as table_name,
    CASE 
        WHEN t.tablename IN ('model_feature_weights', 'outbox') THEN '🔧 System Table (Should have deny-all policy)'
        WHEN t.tablename LIKE '%audit%' OR t.tablename LIKE '%log%' THEN '📋 Audit/Log (Should be service_role only)'
        WHEN t.tablename LIKE '%analytics%' THEN '📊 Analytics (Should be service_role only)'
        WHEN t.tablename LIKE '%cache%' OR t.tablename LIKE '%queue%' THEN '💾 Cache/Queue (Should be service_role only)'
        ELSE '❓ Review (May need policies or is intentionally locked)'
    END as table_type,
    '❌ RLS Enabled but NO POLICIES' as issue
FROM pg_tables t
WHERE t.schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
    AND t.rowsecurity = true
    AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = t.schemaname
        AND p.tablename = t.tablename
    )
ORDER BY 
    CASE 
        WHEN t.tablename IN ('model_feature_weights', 'outbox') THEN 1
        WHEN t.tablename LIKE '%audit%' THEN 2
        WHEN t.tablename LIKE '%analytics%' THEN 3
        ELSE 4
    END,
    t.schemaname,
    t.tablename;

-- ============================================================================
-- PART 8: Summary - What Needs Review vs What's Intentional
-- ============================================================================

SELECT 
    'Tables needing strict RLS (User/Financial data)' as category,
    COUNT(*) as count
FROM pg_tables t
WHERE t.schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing')
    AND (
        t.tablename LIKE '%user%' OR t.tablename LIKE '%profile%'
        OR t.tablename LIKE '%ticket%' OR t.tablename LIKE '%order%'
        OR t.tablename LIKE '%payment%' OR t.tablename LIKE '%event%'
    )
    AND t.tablename NOT IN ('model_feature_weights', 'outbox')

UNION ALL

SELECT 
    'System/Internal tables (service_role only)' as category,
    COUNT(*) as count
FROM pg_tables t
WHERE t.schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
    AND (
        t.tablename IN ('model_feature_weights', 'outbox')
        OR t.tablename LIKE '%audit%' OR t.tablename LIKE '%log%'
        OR t.tablename LIKE '%cache%' OR t.tablename LIKE '%queue%'
    )

UNION ALL

SELECT 
    'Analytics views (service_role only)' as category,
    COUNT(*) as count
FROM pg_views v
WHERE v.schemaname IN ('public', 'analytics')
    AND (
        v.viewname LIKE '%analytics%' OR v.viewname LIKE '%mv_%'
        OR v.viewname LIKE '%trending%' OR v.viewname LIKE '%affinity%'
    )

UNION ALL

SELECT 
    'SECURITY DEFINER views (intentional architecture)' as category,
    COUNT(*) as count
FROM pg_views v
WHERE v.schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing')
    AND EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = v.viewname
        AND n.nspname = v.schemaname
    )

ORDER BY category;


