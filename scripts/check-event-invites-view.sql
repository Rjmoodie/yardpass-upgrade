-- Check public.event_invites view definition and permissions

-- 1. View definition
SELECT 
  '=== VIEW DEFINITION ===' AS section,
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'event_invites';

-- 2. Check grants on the view
SELECT 
  '=== GRANTS ON VIEW ===' AS section,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'event_invites'
ORDER BY grantee, privilege_type;

-- 3. Check if view has RLS
SELECT 
  '=== VIEW RLS CHECK ===' AS section,
  'Views inherit RLS from underlying tables, but need proper grants' AS note;

