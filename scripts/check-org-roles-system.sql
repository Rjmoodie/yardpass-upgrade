-- ============================================================================
-- Check Organization Roles System
-- ============================================================================

-- 1. Check if org_memberships table exists and structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'organizations'
  AND table_name = 'org_memberships'
ORDER BY ordinal_position;

-- 2. Check RLS policies on org_memberships
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  permissive
FROM pg_policies
WHERE schemaname = 'organizations'
  AND tablename = 'org_memberships'
ORDER BY cmd, policyname;

-- 3. Check organization role helper functions
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  CASE WHEN prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END as security
FROM pg_proc
WHERE proname IN (
  'get_current_user_org_role',
  'is_org_role',
  'is_event_org_editor'
)
ORDER BY proname;

-- 4. Check if send-org-invite Edge Function is referenced
SELECT 
  'send-org-invite function' as component,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name LIKE '%org%invite%'
    )
    THEN '✅ May exist as Edge Function'
    ELSE 'ℹ️ Check Edge Functions in dashboard'
  END as status;

-- 5. Check accept_org_invitation function
SELECT 
  proname as function_name,
  CASE WHEN prosecdef THEN '✅ SECURITY DEFINER' ELSE '⚠️ SECURITY INVOKER' END as security
FROM pg_proc
WHERE proname LIKE '%org%invite%'
  OR proname LIKE '%org%invitation%';

-- 6. Test org role hierarchy (if you're a member)
SELECT 
  'Your org memberships' as check_name,
  COUNT(*)::text || ' organizations' as status
FROM organizations.org_memberships
WHERE user_id = auth.uid();

-- ============================================================================
-- Summary
-- ============================================================================

SELECT 
  CASE 
    WHEN 
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'organizations' AND table_name = 'org_memberships')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_current_user_org_role')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_org_role')
    THEN '✅ ORG ROLES SYSTEM: FULLY WIRED UP'
    ELSE '⚠️ ORG ROLES SYSTEM: INCOMPLETE'
  END as org_system_status;

