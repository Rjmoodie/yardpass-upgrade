-- Diagnostic Script: Check Follows Schema
-- Purpose: Verify the actual structure before applying safety migration

-- ============================================================================
-- 1. CHECK IF FOLLOWS IS A TABLE OR VIEW
-- ============================================================================

\echo '=== 1. CHECKING FOLLOWS TABLE/VIEW ==='

-- Check in users schema (actual table)
SELECT 
  schemaname,
  tablename,
  'TABLE' as object_type
FROM pg_tables
WHERE tablename = 'follows'
UNION ALL
SELECT 
  schemaname,
  viewname as tablename,
  'VIEW' as object_type
FROM pg_views
WHERE viewname = 'follows'
ORDER BY object_type, schemaname;

-- ============================================================================
-- 2. CHECK CURRENT COLUMNS IN USERS.FOLLOWS
-- ============================================================================

\echo ''
\echo '=== 2. CURRENT COLUMNS IN users.follows ==='

SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'users'
  AND table_name = 'follows'
ORDER BY ordinal_position;

-- ============================================================================
-- 3. CHECK IF STATUS COLUMN EXISTS
-- ============================================================================

\echo ''
\echo '=== 3. CHECKING STATUS COLUMN ==='

SELECT 
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'users'
      AND table_name = 'follows'
      AND column_name = 'status'
  ) as status_column_exists;

-- ============================================================================
-- 4. CHECK EXISTING RLS POLICIES ON USERS.FOLLOWS
-- ============================================================================

\echo ''
\echo '=== 4. EXISTING RLS POLICIES ON users.follows ==='

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'users'
  AND tablename = 'follows'
ORDER BY policyname;

-- ============================================================================
-- 5. CHECK IF BLOCKS TABLE ALREADY EXISTS
-- ============================================================================

\echo ''
\echo '=== 5. CHECKING IF BLOCKS TABLE EXISTS ==='

SELECT 
  EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'blocks'
  ) as blocks_table_exists;

-- ============================================================================
-- 6. CHECK IF IS_PRIVATE COLUMN EXISTS IN USER_PROFILES
-- ============================================================================

\echo ''
\echo '=== 6. CHECKING IS_PRIVATE COLUMN ==='

SELECT 
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'users'
      AND table_name = 'user_profiles'
      AND column_name = 'is_private'
  ) as is_private_column_exists;

-- ============================================================================
-- 7. CHECK IF HELPER FUNCTIONS EXIST
-- ============================================================================

\echo ''
\echo '=== 7. CHECKING HELPER FUNCTIONS ==='

SELECT 
  routine_schema,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'is_user_blocked',
  'users_have_block',
  'is_user_private',
  'set_follow_status_on_insert',
  'cleanup_follows_on_block'
)
ORDER BY routine_name;

-- ============================================================================
-- 8. CHECK EXISTING INDEXES ON USERS.FOLLOWS
-- ============================================================================

\echo ''
\echo '=== 8. EXISTING INDEXES ON users.follows ==='

SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'users'
  AND tablename = 'follows'
ORDER BY indexname;

-- ============================================================================
-- 9. CHECK PUBLIC.FOLLOWS VIEW DEFINITION
-- ============================================================================

\echo ''
\echo '=== 9. PUBLIC.FOLLOWS VIEW DEFINITION ==='

SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'follows';

-- ============================================================================
-- 10. SUMMARY
-- ============================================================================

\echo ''
\echo '=== 10. MIGRATION READINESS SUMMARY ==='

SELECT 
  'Table Location' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'users' AND tablename = 'follows')
    THEN '✅ users.follows (TABLE)'
    ELSE '❌ TABLE NOT FOUND'
  END as status
UNION ALL
SELECT 
  'Public View',
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'follows')
    THEN '✅ public.follows (VIEW)'
    ELSE '❌ VIEW NOT FOUND'
  END
UNION ALL
SELECT 
  'Status Column',
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'users' AND table_name = 'follows' AND column_name = 'status')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END
UNION ALL
SELECT 
  'Blocks Table',
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'blocks')
    THEN '⚠️ ALREADY EXISTS'
    ELSE '✅ READY TO CREATE'
  END
UNION ALL
SELECT 
  'is_private Column',
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'users' AND table_name = 'user_profiles' AND column_name = 'is_private')
    THEN '⚠️ ALREADY EXISTS'
    ELSE '✅ READY TO CREATE'
  END;

\echo ''
\echo '=== DIAGNOSTIC COMPLETE ==='
\echo 'Review the output above before applying migration.'
\echo ''


