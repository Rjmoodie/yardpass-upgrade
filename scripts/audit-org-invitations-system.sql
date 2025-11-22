-- ============================================================
-- AUDIT: Organization Invitations System
-- ============================================================
-- Run this in Supabase SQL Editor to see current state
-- ============================================================

-- ============================================================
-- 1. CHECK TABLE STRUCTURE
-- ============================================================
SELECT 
  '=== TABLE: organizations.org_invitations ===' as section,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'organizations'
  AND table_name = 'org_invitations'
ORDER BY ordinal_position;

-- ============================================================
-- 2. CHECK IF RLS IS ENABLED
-- ============================================================
SELECT 
  '=== RLS STATUS ===' as section,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'organizations'
  AND tablename = 'org_invitations';

-- ============================================================
-- 3. LIST ALL EXISTING POLICIES
-- ============================================================
SELECT 
  '=== EXISTING RLS POLICIES ===' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'organizations'
  AND tablename = 'org_invitations'
ORDER BY policyname;

-- ============================================================
-- 4. CHECK PUBLIC VIEWS
-- ============================================================
SELECT 
  '=== PUBLIC VIEWS ===' as section,
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('org_invitations', 'org_invite_status_log')
ORDER BY viewname;

-- ============================================================
-- 5. CHECK VIEW PERMISSIONS
-- ============================================================
SELECT 
  '=== VIEW GRANTS ===' as section,
  table_schema,
  table_name,
  privilege_type,
  grantee
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('org_invitations', 'org_invite_status_log')
ORDER BY table_name, grantee, privilege_type;

-- ============================================================
-- 6. CHECK ACCEPT FUNCTION
-- ============================================================
SELECT 
  '=== ACCEPT FUNCTION ===' as section,
  routine_schema,
  routine_name,
  routine_type,
  security_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'accept_org_invitation';

-- ============================================================
-- 7. CHECK TABLE CONSTRAINTS
-- ============================================================
SELECT 
  '=== TABLE CONSTRAINTS ===' as section,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(c.oid) as definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'organizations'
  AND t.relname = 'org_invitations'
ORDER BY contype, conname;

-- ============================================================
-- 8. CHECK CURRENT DATA (SAMPLE)
-- ============================================================
SELECT 
  '=== SAMPLE DATA (Last 5 invites) ===' as section,
  id,
  org_id,
  email,
  role,
  status,
  email_status,
  created_at,
  expires_at,
  CASE WHEN expires_at < now() THEN 'EXPIRED' ELSE 'ACTIVE' END as expiry_status
FROM organizations.org_invitations
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================
-- 9. CHECK IF TRACKING COLUMNS EXIST
-- ============================================================
SELECT 
  '=== TRACKING COLUMNS CHECK ===' as section,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'organizations' 
    AND table_name = 'org_invitations' 
    AND column_name = 'email_status'
  ) THEN '✅ email_status exists'
  ELSE '❌ email_status MISSING' END as email_status_check,
  
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'organizations' 
    AND table_name = 'org_invitations' 
    AND column_name = 'email_sent_at'
  ) THEN '✅ email_sent_at exists'
  ELSE '❌ email_sent_at MISSING' END as email_sent_at_check,
  
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'organizations' 
    AND table_name = 'org_invitations' 
    AND column_name = 'metadata'
  ) THEN '✅ metadata exists'
  ELSE '❌ metadata MISSING' END as metadata_check;

-- ============================================================
-- 10. CHECK INDEXES
-- ============================================================
SELECT 
  '=== INDEXES ===' as section,
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'organizations'
  AND tablename = 'org_invitations'
ORDER BY indexname;

-- ============================================================
-- 11. SUMMARY
-- ============================================================
SELECT '=== AUDIT COMPLETE ===' as section,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'organizations' AND tablename = 'org_invitations') as total_policies,
  (SELECT COUNT(*) FROM organizations.org_invitations WHERE status = 'pending') as pending_invites,
  (SELECT COUNT(*) FROM organizations.org_invitations WHERE status = 'accepted') as accepted_invites,
  (SELECT COUNT(*) FROM organizations.org_invitations WHERE expires_at < now() AND status = 'pending') as expired_pending;

