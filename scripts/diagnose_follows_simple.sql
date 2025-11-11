-- Simple Diagnostic: Check Follows Schema (SQL-only, no psql commands)

-- 1. Check if follows is a table or view
SELECT '=== FOLLOWS LOCATION ===' as info;
SELECT 
  schemaname,
  tablename as name,
  'TABLE' as type
FROM pg_tables
WHERE tablename = 'follows'
UNION ALL
SELECT 
  schemaname,
  viewname as name,
  'VIEW' as type
FROM pg_views
WHERE viewname = 'follows'
ORDER BY type, schemaname;

-- 2. Check current columns in users.follows
SELECT '=== COLUMNS IN users.follows ===' as info;
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'users'
  AND table_name = 'follows'
ORDER BY ordinal_position;

-- 3. Check if blocks table exists
SELECT '=== BLOCKS TABLE STATUS ===' as info;
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'blocks')
    THEN 'EXISTS - Migration already applied or partial'
    ELSE 'NOT EXISTS - Ready to create'
  END as blocks_status;

-- 4. Check if is_private column exists
SELECT '=== IS_PRIVATE COLUMN STATUS ===' as info;
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'users' 
      AND table_name = 'user_profiles' 
      AND column_name = 'is_private'
    )
    THEN 'EXISTS - Migration already applied or partial'
    ELSE 'NOT EXISTS - Ready to create'
  END as is_private_status;

-- 5. Check existing RLS policies on users.follows
SELECT '=== RLS POLICIES ON users.follows ===' as info;
SELECT 
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'users'
  AND tablename = 'follows'
ORDER BY policyname;


