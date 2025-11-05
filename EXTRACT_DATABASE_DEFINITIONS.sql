-- ============================================================================
-- EXTRACT DATABASE DEFINITIONS FROM SUPABASE
-- ============================================================================
-- Run these queries in Supabase SQL Editor to get definitions
-- ============================================================================

-- ============================================================================
-- 1. GET ALL VIEWS AND THEIR DEFINITIONS
-- ============================================================================

-- All views in public schema with their SQL definitions
SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- Check if a view has SECURITY DEFINER
SELECT 
  schemaname,
  viewname,
  definition,
  CASE 
    WHEN definition LIKE '%SECURITY DEFINER%' THEN 'YES'
    ELSE 'NO'
  END as has_security_definer
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;


-- ============================================================================
-- 2. GET SPECIFIC VIEW DEFINITION (Replace 'view_name' with actual name)
-- ============================================================================

-- Get definition for a specific view
SELECT pg_get_viewdef('public.events', true);

-- Get definition for multiple views
SELECT 
  viewname,
  pg_get_viewdef('public.' || viewname, true) as definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('events', 'event_posts', 'tickets', 'orders', 'user_profiles')
ORDER BY viewname;


-- ============================================================================
-- 3. GET ALL TABLES AND THEIR COLUMNS
-- ============================================================================

-- List all tables in public schema
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Get columns for a specific table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'model_feature_weights'
ORDER BY ordinal_position;


-- ============================================================================
-- 4. GET ALL TABLES WITH RLS STATUS
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) 
   FROM pg_policies 
   WHERE schemaname = n.nspname 
     AND tablename = c.relname) as policy_count
FROM pg_tables pt
JOIN pg_class c ON c.relname = pt.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE pt.schemaname IN ('public', 'events', 'ticketing', 'users', 'organizations', 'payments')
ORDER BY pt.schemaname, pt.tablename;


-- ============================================================================
-- 5. GET ALL RLS POLICIES
-- ============================================================================

-- All policies on public tables
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Policies for a specific table
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'events'
ORDER BY policyname;


-- ============================================================================
-- 6. GET ALL FUNCTIONS AND THEIR DEFINITIONS
-- ============================================================================

-- All functions in public schema
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  l.lanname as language,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END as security,
  CASE WHEN p.proisstrict THEN 'STRICT' ELSE 'NOT STRICT' END as strict_mode,
  p.provolatile as volatility
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'  -- Functions only (not aggregates)
ORDER BY p.proname;

-- Get source code for a specific function
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'get_home_feed_ranked'
  AND pronamespace = 'public'::regnamespace;


-- ============================================================================
-- 7. GET ALL TRIGGERS
-- ============================================================================

-- All triggers on tables
SELECT 
  trigger_schema,
  trigger_name,
  event_object_table as table_name,
  action_timing,
  event_manipulation as event,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema IN ('public', 'events', 'ticketing', 'users', 'organizations')
ORDER BY event_object_table, trigger_name;


-- ============================================================================
-- 8. GENERATE CREATE STATEMENTS FOR VIEWS
-- ============================================================================

-- Get the complete CREATE OR REPLACE VIEW statement
SELECT 
  'CREATE OR REPLACE VIEW ' || schemaname || '.' || viewname || ' AS ' || definition || ';' as create_statement
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'events';  -- Replace with any view name

-- Generate CREATE statements for all SECURITY DEFINER views
SELECT 
  viewname,
  'CREATE OR REPLACE VIEW public.' || viewname || 
  E'\nWITH (security_barrier = false)\nAS\n' || 
  definition || ';' as create_statement
FROM pg_views
WHERE schemaname = 'public'
  AND definition LIKE '%SECURITY DEFINER%'
ORDER BY viewname;


-- ============================================================================
-- 9. CHECK VIEW DEPENDENCIES
-- ============================================================================

-- See what tables/views a specific view depends on
SELECT DISTINCT
  dependent_ns.nspname as dependent_schema,
  dependent_view.relname as dependent_view,
  source_ns.nspname as source_schema,
  source_table.relname as source_table
FROM pg_depend 
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid 
JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid 
JOIN pg_class as source_table ON pg_depend.refobjid = source_table.oid 
JOIN pg_namespace dependent_ns ON dependent_ns.oid = dependent_view.relnamespace
JOIN pg_namespace source_ns ON source_ns.oid = source_table.relnamespace
WHERE dependent_ns.nspname = 'public'
  AND dependent_view.relname = 'events'  -- Replace with view name
  AND source_ns.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY source_schema, source_table;


-- ============================================================================
-- 10. EXPORT ALL SCHEMA AS DDL
-- ============================================================================

-- Get ALL view definitions at once
SELECT 
  viewname,
  E'\n-- =====================================\n' ||
  '-- VIEW: ' || viewname || E'\n' ||
  E'-- =====================================\n' ||
  'CREATE OR REPLACE VIEW public.' || viewname || E' AS\n' ||
  definition || E';\n'
  as ddl
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;


-- ============================================================================
-- 11. GET TABLE SIZES (Find Large Tables)
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname IN ('public', 'events', 'ticketing', 'users', 'organizations', 'payments')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;


-- ============================================================================
-- 12. GET ALL INDEXES
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;


-- ============================================================================
-- USAGE TIPS:
-- ============================================================================
-- 
-- TO GET A SPECIFIC VIEW DEFINITION:
-- SELECT pg_get_viewdef('public.events', true);
--
-- TO SEARCH FOR VIEWS USING A SPECIFIC TABLE:
-- Use query #9 above
--
-- TO EXPORT ALL VIEWS TO FILE:
-- Use query #10, copy results to a .sql file
--
-- TO CHECK IF A VIEW IS USED IN FUNCTIONS:
-- SELECT prosrc FROM pg_proc WHERE prosrc LIKE '%view_name%';
--
-- ============================================================================





