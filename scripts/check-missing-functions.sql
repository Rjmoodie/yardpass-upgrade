-- ============================================================================
-- Quick Check: Which Functions Are Missing?
-- ============================================================================

-- Check each function individually
SELECT 'is_platform_admin' as function_name, 
       EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'is_platform_admin') as exists;

SELECT 'is_event_manager' as function_name,
       EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'is_event_manager') as exists;

SELECT 'is_event_individual_owner' as function_name,
       EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'is_event_individual_owner') as exists;

SELECT 'is_event_org_editor' as function_name,
       EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'is_event_org_editor') as exists;

SELECT 'is_org_role' as function_name,
       EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'is_org_role') as exists;

SELECT 'get_current_user_org_role' as function_name,
       EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_current_user_org_role') as exists;

SELECT 'accept_role_invite' as function_name,
       EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'accept_role_invite') as exists;

SELECT 'update_user_role' as function_name,
       EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'update_user_role') as exists;

SELECT 'handle_new_user' as function_name,
       EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') as exists;

-- ============================================================================
-- Summary
-- ============================================================================

SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'NONE of the expected functions exist'
    WHEN COUNT(*) < 9 THEN 'SOME functions exist (' || COUNT(*)::text || ' of 9)'
    ELSE 'ALL functions exist (' || COUNT(*)::text || ' of 9)'
  END as status
FROM pg_proc
WHERE proname IN (
  'is_platform_admin',
  'is_event_manager',
  'is_event_individual_owner',
  'is_event_org_editor',
  'is_org_role',
  'get_current_user_org_role',
  'accept_role_invite',
  'update_user_role',
  'handle_new_user'
);

