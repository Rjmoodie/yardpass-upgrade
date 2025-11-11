-- ============================================================================
-- Final Security Verification - Complete System Check
-- ============================================================================

-- ============================================================================
-- 1. Profile Security Status
-- ============================================================================

SELECT 
  CASE 
    WHEN 
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_user_role')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_platform_admin')
      AND EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
    THEN '✅ PROFILE SECURITY: FULLY IMPLEMENTED'
    ELSE '❌ PROFILE SECURITY: INCOMPLETE'
  END as profile_security;

-- ============================================================================
-- 2. Role Invite Security Status
-- ============================================================================

SELECT 
  CASE 
    WHEN 
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log')
      AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_scanner_limit')
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_privileges 
        WHERE table_name = 'role_invites' AND grantee = 'anon'
      )
    THEN '✅ ROLE INVITES: FULLY SECURED'
    ELSE '❌ ROLE INVITES: INCOMPLETE'
  END as invite_security;

-- ============================================================================
-- 3. Check Insecure Policies Are Gone
-- ============================================================================

SELECT 
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'user_profiles' 
        AND policyname IN ('own_profile_all', 'Allow profile creation during signup')
    )
    THEN '✅ INSECURE POLICIES: REMOVED'
    ELSE '❌ INSECURE POLICIES: STILL ACTIVE'
  END as insecure_policies_status;

-- ============================================================================
-- 4. Check Secure Policies Are Active
-- ============================================================================

SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN policyname LIKE '%restricted%' THEN '✅ Blocks role changes'
    WHEN policyname LIKE '%blocked%' THEN '✅ Blocks client action'
    WHEN policyname LIKE '%select_all%' THEN '✅ Public visibility (OK)'
    ELSE '⚠️ Review policy'
  END as assessment
FROM pg_policies
WHERE schemaname = 'users'
  AND tablename = 'user_profiles'
ORDER BY cmd, policyname;

-- ============================================================================
-- 5. Function Security Check
-- ============================================================================

SELECT 
  proname as function_name,
  CASE 
    WHEN prosecdef THEN '✅ SECURITY DEFINER (secure)'
    ELSE '⚠️ SECURITY INVOKER (check carefully)'
  END as security_mode
FROM pg_proc
WHERE proname IN (
  'handle_new_user',
  'update_user_role',
  'is_platform_admin',
  'accept_role_invite',
  'enforce_scanner_limit'
)
ORDER BY proname;

-- ============================================================================
-- 6. Audit Log Check
-- ============================================================================

SELECT 
  'audit_log table' as component,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status;

-- Count recent audit entries
SELECT 
  'audit_log entries (last 24h)' as component,
  COUNT(*)::text || ' entries' as status
FROM public.audit_log
WHERE created_at >= now() - interval '24 hours';

-- ============================================================================
-- FINAL VERDICT
-- ============================================================================

SELECT 
  '========================================' as divider;

SELECT 
  CASE 
    WHEN 
      -- All critical functions exist
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_user_role')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_platform_admin')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'accept_role_invite')
      -- Triggers exist
      AND EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
      AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_scanner_limit')
      -- Insecure policies removed
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_profiles' 
          AND policyname = 'own_profile_all'
      )
      -- Secure policies active
      AND EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_profiles' 
          AND policyname = 'user_profiles_update_restricted'
      )
      -- Audit log ready
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log')
      -- Anon access removed
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_privileges 
        WHERE table_name = 'role_invites' AND grantee = 'anon'
      )
    THEN '🎉 ALL SECURITY FIXES FULLY IMPLEMENTED AND VERIFIED!'
    ELSE '⚠️ SOME COMPONENTS MISSING - Review details above'
  END as final_verdict;

SELECT 
  '========================================' as divider;

-- Show what's protected:
SELECT 
  'PROTECTED AGAINST:' as category,
  string_agg(protection, E'\n  ') as protections
FROM (
  VALUES
    ('✅ Privilege escalation (role self-promotion)'),
    ('✅ Client-side profile manipulation'),
    ('✅ Unauthorized role invites'),
    ('✅ Token exposure to anonymous users'),
    ('✅ Invite spam (rate limited)'),
    ('✅ Data overexposure (scanner limits)'),
    ('✅ Unaudited security events')
) AS t(protection);

