-- ============================================================================
-- Verification Script: Security Fixes Applied
-- ============================================================================

-- 1. Check audit_log table exists
SELECT 
  'audit_log table' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status;

-- 2. Check RLS policies on role_invites
SELECT 
  'role_invites RLS policies' as check_name,
  COUNT(*)::text || ' policies' as status
FROM pg_policies
WHERE tablename = 'role_invites'
  AND policyname LIKE '%authorized%';

-- Expected: At least 3 policies

-- 3. Check anon access removed
SELECT 
  'anon access to role_invites' as check_name,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ REMOVED (secure)'
    ELSE '❌ STILL EXISTS (vulnerable): ' || COUNT(*)::text || ' grants'
  END as status
FROM information_schema.table_privileges 
WHERE table_name = 'role_invites' 
  AND grantee = 'anon';

-- 4. Check scanner limit trigger
SELECT 
  'scanner limit trigger' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_scanner_limit')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status;

-- 5. Check accept_role_invite function updated
SELECT 
  'accept_role_invite function' as check_name,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%audit_log%'
    THEN '✅ UPDATED (includes audit logging)'
    ELSE '⚠️ OLD VERSION (no audit logging)'
  END as status
FROM pg_proc
WHERE proname = 'accept_role_invite';

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT 
  '====== SECURITY FIX STATUS ======' as summary;

SELECT 
  CASE 
    WHEN 
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log')
      AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_scanner_limit')
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_privileges 
        WHERE table_name = 'role_invites' AND grantee = 'anon'
      )
    THEN '✅ ALL CRITICAL FIXES APPLIED'
    ELSE '⚠️ SOME FIXES MISSING - Check details above'
  END as overall_status;

