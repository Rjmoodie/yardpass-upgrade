-- ============================================================================
-- RLS SECURITY AUDIT - Enhanced Comprehensive Inventory
-- ============================================================================
-- Run this in Supabase SQL Editor to get a complete overview
-- Version: 2.0 Enhanced with deny-by-default checks
-- ============================================================================

-- ============================================================================
-- PART 1: List All Tables with RLS Status
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ ENABLED'
        ELSE '❌ DISABLED - SECURITY RISK!'
    END as rls_status,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE '_prisma%'
ORDER BY 
    CASE WHEN rowsecurity THEN 1 ELSE 0 END, -- Show disabled first
    schemaname,
    tablename;

-- ============================================================================
-- PART 2: Count Policies per Table
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    COUNT(*) as policy_count,
    string_agg(DISTINCT cmd::text, ', ' ORDER BY cmd::text) as commands_covered
FROM pg_policies
WHERE schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
GROUP BY schemaname, tablename
ORDER BY schemaname, tablename;

-- ============================================================================
-- PART 3: Find Tables with RLS Enabled but NO Policies (CRITICAL!)
-- ============================================================================

SELECT 
    t.schemaname || '.' || t.tablename as table_name,
    '❌ RLS ENABLED BUT NO POLICIES - BLOCKS ALL ACCESS!' as issue,
    'CRITICAL' as severity
FROM pg_tables t
WHERE t.schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
    AND t.rowsecurity = true
    AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = t.schemaname
        AND p.tablename = t.tablename
    )
ORDER BY t.schemaname, t.tablename;

-- ============================================================================
-- PART 4: Find Critical Tables with RLS DISABLED (CRITICAL!)
-- ============================================================================

SELECT 
    schemaname || '.' || tablename as table_name,
    '❌ RLS DISABLED - SECURITY RISK!' as issue,
    'CRITICAL' as severity
FROM pg_tables
WHERE schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
    AND rowsecurity = false
    AND tablename IN (
        'events', 'event_posts', 'tickets', 'orders', 
        'user_profiles', 'organizations', 'org_memberships',
        'event_comments', 'saved_events', 'follows'
    )
ORDER BY schemaname, tablename;

-- ============================================================================
-- PART 5: Detailed Policy Review for Critical Tables
-- ============================================================================

-- Review policies for events table
SELECT 
    'events' as table_name,
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check
FROM pg_policies
WHERE schemaname IN ('public', 'events')
    AND tablename = 'events'
ORDER BY cmd, policyname;

-- Review policies for event_posts table
SELECT 
    'event_posts' as table_name,
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check
FROM pg_policies
WHERE schemaname IN ('public', 'events')
    AND tablename = 'event_posts'
ORDER BY cmd, policyname;

-- Review policies for tickets table
SELECT 
    'tickets' as table_name,
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check
FROM pg_policies
WHERE schemaname IN ('public', 'ticketing')
    AND tablename = 'tickets'
ORDER BY cmd, policyname;

-- Review policies for orders table
SELECT 
    'orders' as table_name,
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check
FROM pg_policies
WHERE schemaname IN ('public', 'ticketing')
    AND tablename = 'orders'
ORDER BY cmd, policyname;

-- Review policies for user_profiles table
SELECT 
    'user_profiles' as table_name,
    policyname,
    cmd as command,
    roles,
    qual as using_expression,
    with_check
FROM pg_policies
WHERE schemaname = 'users'
    AND tablename = 'user_profiles'
ORDER BY cmd, policyname;

-- ============================================================================
-- PART 6: Find Potentially Overly Permissive Policies (ENHANCED)
-- ============================================================================

-- Enhanced check: Find dangerous policies with detailed context
SELECT 
    schemaname || '.' || tablename as table_name,
    policyname,
    cmd as command,
    roles,
    CASE 
        WHEN roles = '{public}' OR roles = '{anon}' THEN '❌ PUBLIC/ANON ACCESS'
        WHEN qual IS NULL OR qual = 'true' OR regexp_replace(qual, '\s+', '', 'g') = '' THEN '❌ ALLOWS ALL'
        WHEN cmd = 'SELECT' 
            AND tablename IN ('events', 'event_posts', 'tickets', 'orders', 'user_profiles')
            AND NOT (qual LIKE '%auth.uid()%' OR qual LIKE '%user_id%' OR qual LIKE '%org_id%' OR qual LIKE '%is_public%') 
        THEN '⚠️ NO TENANT FILTER'
        ELSE '⚠️ Review expression'
    END as concern,
    qual as policy_expression
FROM pg_policies
WHERE schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
    AND (
        qual IS NULL 
        OR qual = 'true' 
        OR regexp_replace(qual, '\s+', '', 'g') = ''
        OR (roles = '{public}' AND tablename IN ('events', 'event_posts', 'tickets', 'orders', 'user_profiles'))
        OR (cmd = 'SELECT' AND tablename IN ('events', 'event_posts', 'tickets', 'orders', 'user_profiles') 
            AND NOT (qual LIKE '%auth.uid()%' OR qual LIKE '%user_id%' OR qual LIKE '%org_id%' OR qual LIKE '%is_public%'))
    )
ORDER BY 
    CASE WHEN concern LIKE '❌%' THEN 1 ELSE 2 END,
    tablename, 
    policyname;

-- ============================================================================
-- PART 7: Check for Missing Command Policies (ENHANCED)
-- ============================================================================

-- Show which commands have policies per table
SELECT 
    schemaname,
    tablename,
    array_agg(DISTINCT cmd ORDER BY cmd) AS commands_with_policies,
    CASE 
        WHEN NOT (array_agg(DISTINCT cmd) @> ARRAY['SELECT']) THEN 'Missing SELECT'
        WHEN NOT (array_agg(DISTINCT cmd) @> ARRAY['INSERT']) THEN 'Missing INSERT'
        WHEN NOT (array_agg(DISTINCT cmd) @> ARRAY['UPDATE']) THEN 'Missing UPDATE'
        WHEN NOT (array_agg(DISTINCT cmd) @> ARRAY['DELETE']) THEN 'Missing DELETE'
        ELSE 'All commands covered'
    END as coverage_status
FROM pg_policies
WHERE schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
    AND tablename IN (
        'events', 'event_posts', 'tickets', 'orders', 
        'user_profiles', 'organizations', 'org_memberships'
    )
GROUP BY schemaname, tablename
ORDER BY schemaname, tablename;

-- Detailed: Which commands are missing per critical table
SELECT 
    t.schemaname || '.' || t.tablename as table_name,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = t.schemaname AND p.tablename = t.tablename AND p.cmd = 'SELECT') THEN '❌ Missing SELECT'
        WHEN NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = t.schemaname AND p.tablename = t.tablename AND p.cmd = 'INSERT') THEN '⚠️ Missing INSERT'
        WHEN NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = t.schemaname AND p.tablename = t.tablename AND p.cmd = 'UPDATE') THEN '⚠️ Missing UPDATE'
        WHEN NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = t.schemaname AND p.tablename = t.tablename AND p.cmd = 'DELETE') THEN '⚠️ Missing DELETE'
        ELSE '✅ All commands covered'
    END as missing_commands
FROM pg_tables t
WHERE t.schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
    AND t.rowsecurity = true
    AND t.tablename IN (
        'events', 'event_posts', 'tickets', 'orders', 
        'user_profiles', 'organizations', 'org_memberships'
    )
ORDER BY t.schemaname, t.tablename;

-- ============================================================================
-- PART 8: Check Default Grants (Deny-by-Default Verification)
-- ============================================================================

-- Check if critical tables have been REVOKEd from public
SELECT 
    grantee,
    table_schema,
    table_name,
    string_agg(DISTINCT privilege_type, ', ' ORDER BY privilege_type) as privileges
FROM information_schema.table_privileges
WHERE table_schema IN ('public', 'users', 'events', 'organizations', 'ticketing')
    AND table_name IN ('events', 'event_posts', 'tickets', 'orders', 'user_profiles', 'organizations')
    AND grantee IN ('public', 'anon', 'authenticated')
GROUP BY grantee, table_schema, table_name
ORDER BY table_name, grantee;

-- ============================================================================
-- PART 9: Audit Views (Potential RLS Bypasses)
-- ============================================================================

-- List all views that might expose data
SELECT 
    schemaname,
    viewname,
    CASE 
        WHEN definition LIKE '%JOIN%' THEN '⚠️ Contains JOINs - verify RLS'
        ELSE 'Review'
    END as concern
FROM pg_views
WHERE schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
    AND viewname NOT LIKE 'pg_%'
ORDER BY schemaname, viewname;

-- ============================================================================
-- PART 10: Audit SECURITY DEFINER Functions (RLS Bypasses)
-- ============================================================================

-- Functions that bypass RLS entirely
SELECT
    n.nspname AS schemaname,
    p.proname AS function_name,
    p.prosecdef AS is_security_definer,
    CASE 
        WHEN p.prosecdef THEN '⚠️ BYPASSES RLS - Document reason!'
        ELSE 'OK'
    END as security_note
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
    AND p.prosecdef = true
ORDER BY n.nspname, p.proname;

-- ============================================================================
-- PART 11: Tables That Are Intentionally Less Restricted (OK)
-- ============================================================================
-- Reference: SECURITY_DEFINER_VIEWS_RATIONALE.md, DATABASE_CLEANUP_COMPLETE.md

-- System tables that should deny-all (not user-scoped)
SELECT 
    'System/Internal Tables' as category,
    schemaname || '.' || tablename as table_name,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled (Should have deny-all policy)'
        ELSE '❌ RLS Disabled (Enable with deny-all)'
    END as expected_status
FROM pg_tables
WHERE schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
    AND (
        tablename IN ('model_feature_weights', 'outbox')
        OR tablename LIKE '%cache%'
        OR tablename LIKE '%queue%'
        OR tablename LIKE '%refresh%'
    )

UNION ALL

-- Public read-only tables
SELECT 
    'Public Read-Only Tables' as category,
    schemaname || '.' || tablename as table_name,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled (May have public SELECT policy - OK)'
        ELSE '⚠️ RLS Disabled (Review if intentional)'
    END as expected_status
FROM pg_tables
WHERE schemaname IN ('public', 'users')
    AND tablename = 'platform_settings'

ORDER BY category, table_name;

-- ============================================================================
-- PART 12: Summary Report
-- ============================================================================

SELECT 
    'SUMMARY' as report_section,
    COUNT(DISTINCT t.schemaname || '.' || t.tablename) as total_tables,
    COUNT(DISTINCT CASE WHEN t.rowsecurity THEN t.schemaname || '.' || t.tablename END) as tables_with_rls,
    COUNT(DISTINCT CASE WHEN NOT t.rowsecurity THEN t.schemaname || '.' || t.tablename END) as tables_without_rls,
    COUNT(DISTINCT p.schemaname || '.' || p.tablename || '.' || p.policyname) as total_policies
FROM pg_tables t
LEFT JOIN pg_policies p ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
    AND t.tablename NOT LIKE 'pg_%';

