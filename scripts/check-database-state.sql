-- ============================================================================
-- Database State Diagnostic Script
-- ============================================================================
-- Run this in Supabase SQL Editor to check current state
-- ============================================================================

-- ============================================================================
-- 1. Check if is_platform_admin() function exists
-- ============================================================================

SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname LIKE '%platform_admin%'
ORDER BY schema, function_name;

-- Expected: Should show if is_platform_admin() exists and its definition

-- ============================================================================
-- 2. Check if is_event_manager() function exists
-- ============================================================================

SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname LIKE '%event_manager%'
ORDER BY schema, function_name;

-- Expected: Should show is_event_manager(uuid) function

-- ============================================================================
-- 3. Check all auth/role related functions
-- ============================================================================

SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security_mode
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN (
  'is_platform_admin',
  'is_event_manager',
  'is_event_individual_owner',
  'is_event_org_editor',
  'is_org_role',
  'get_current_user_org_role',
  'accept_role_invite',
  'update_user_role',
  'handle_new_user',
  'grant_event_role_admin'
)
ORDER BY schema, function_name;

-- ============================================================================
-- 4. Check RLS policies on role_invites
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'HAS USING'
    ELSE 'NO USING'
  END as has_using,
  CASE 
    WHEN with_check IS NOT NULL THEN 'HAS WITH CHECK'
    ELSE 'NO WITH CHECK'
  END as has_with_check
FROM pg_policies
WHERE schemaname IN ('events', 'public')
  AND tablename IN ('role_invites', 'event_roles')
ORDER BY schemaname, tablename, policyname;

-- ============================================================================
-- 5. Check grants on role_invites (anon access?)
-- ============================================================================

SELECT 
  table_schema,
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges 
WHERE table_schema IN ('public', 'events')
  AND table_name IN ('role_invites', 'event_roles')
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- Expected: Should NOT see anon with SELECT on role_invites

-- ============================================================================
-- 6. Check if audit_log table exists
-- ============================================================================

SELECT 
  table_schema,
  table_name,
  CASE 
    WHEN table_type = 'BASE TABLE' THEN 'Table'
    WHEN table_type = 'VIEW' THEN 'View'
  END as type
FROM information_schema.tables
WHERE table_name = 'audit_log'
ORDER BY table_schema;

-- ============================================================================
-- 7. Check indexes on role_invites
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname IN ('events', 'public')
  AND tablename IN ('role_invites', 'event_roles')
ORDER BY tablename, indexname;

-- ============================================================================
-- 8. Check recent migrations applied
-- ============================================================================

SELECT 
  version,
  name
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 20;

-- Note: executed_at column may not exist in all Supabase versions

-- ============================================================================
-- 9. Check if users.user_profiles table exists
-- ============================================================================

SELECT 
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'users'
  AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- ============================================================================
-- 10. Check triggers on auth.users
-- ============================================================================

SELECT 
  trigger_schema,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND trigger_schema = 'auth'
ORDER BY trigger_name;

-- Expected: Should show on_auth_user_created trigger if migration was applied

-- ============================================================================
-- Summary Query
-- ============================================================================

SELECT 
  'Functions' as category,
  COUNT(*)::text as count
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN (
  'is_platform_admin',
  'is_event_manager',
  'accept_role_invite',
  'update_user_role',
  'handle_new_user'
)

UNION ALL

SELECT 
  'RLS Policies (role_invites)' as category,
  COUNT(*)::text
FROM pg_policies
WHERE tablename = 'role_invites'

UNION ALL

SELECT 
  'Tables (audit_log)' as category,
  COUNT(*)::text
FROM information_schema.tables
WHERE table_name = 'audit_log'

UNION ALL

SELECT 
  'Triggers (on_auth_user_created)' as category,
  COUNT(*)::text
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

