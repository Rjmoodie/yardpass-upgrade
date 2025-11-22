-- Verify the event_invites view fix was applied correctly

-- 1. Check view exists and definition
SELECT 
  '=== VIEW DEFINITION ===' AS section,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'event_invites';

-- 2. Check grants on the view
SELECT 
  '=== GRANTS ON public.event_invites VIEW ===' AS section,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'event_invites'
ORDER BY grantee, privilege_type;

-- 3. Check if security_invoker is set
SELECT 
  '=== SECURITY INVOKER CHECK ===' AS section,
  schemaname,
  viewname,
  viewowner,
  CASE 
    WHEN definition LIKE '%security_invoker%' THEN 'Set via definition'
    ELSE 'Check reloptions'
  END AS security_invoker_status
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'event_invites';

-- 4. Check reloptions (where security_invoker setting lives)
SELECT 
  '=== VIEW OPTIONS ===' AS section,
  c.relname AS view_name,
  c.reloptions AS options
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'event_invites'
  AND c.relkind = 'v';

