-- Check if event_invites is a table or view in public schema

-- 1. Check for views
SELECT 
  '=== VIEWS ===' AS section,
  schemaname,
  viewname
FROM pg_views
WHERE viewname = 'event_invites';

-- 2. Check for tables
SELECT 
  '=== TABLES ===' AS section,
  schemaname,
  tablename
FROM pg_tables
WHERE tablename = 'event_invites';

-- 3. Check grants on events.event_invites
SELECT 
  '=== GRANTS ON events.event_invites ===' AS section,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'events'
  AND table_name = 'event_invites'
ORDER BY grantee, privilege_type;

-- 4. Check if RLS is enabled
SELECT 
  '=== RLS STATUS ===' AS section,
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'events'
  AND tablename = 'event_invites';

