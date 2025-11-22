-- ============================================================
-- AUDIT: Event Role Invites System
-- ============================================================
-- Run this in Supabase SQL Editor to see current state
-- ============================================================

-- ============================================================
-- 1. CHECK TABLE STRUCTURE
-- ============================================================
SELECT 
  '=== TABLE: events.role_invites ===' as section,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'events'
  AND table_name = 'role_invites'
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
WHERE schemaname = 'events'
  AND tablename = 'role_invites';

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
WHERE schemaname = 'events'
  AND tablename = 'role_invites'
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
  AND viewname IN ('role_invites', 'event_invites')
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
  AND table_name IN ('role_invites', 'event_invites')
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
  AND routine_name = 'accept_role_invite';

-- ============================================================
-- 7. CHECK EVENT MANAGER FUNCTION
-- ============================================================
SELECT 
  '=== EVENT MANAGER CHECK FUNCTION ===' as section,
  routine_schema,
  routine_name,
  routine_type,
  security_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'is_event_manager';

-- ============================================================
-- 8. CHECK TABLE CONSTRAINTS
-- ============================================================
SELECT 
  '=== TABLE CONSTRAINTS ===' as section,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(c.oid) as definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'events'
  AND t.relname = 'role_invites'
ORDER BY contype, conname;

-- ============================================================
-- 9. CHECK CURRENT DATA (SAMPLE)
-- ============================================================
SELECT 
  '=== SAMPLE DATA (Last 10 invites) ===' as section,
  id,
  event_id,
  role,
  email,
  phone,
  status,
  created_at,
  expires_at,
  CASE WHEN expires_at < now() THEN 'EXPIRED' ELSE 'ACTIVE' END as expiry_status,
  invited_by
FROM events.role_invites
ORDER BY created_at DESC
LIMIT 10;

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
WHERE schemaname = 'events'
  AND tablename = 'role_invites'
ORDER BY indexname;

-- ============================================================
-- 11. CHECK EVENT ROLES TABLE (where accepted invites go)
-- ============================================================
SELECT 
  '=== EVENT ROLES TABLE ===' as section,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'events'
  AND table_name = 'event_roles'
ORDER BY ordinal_position;

-- ============================================================
-- 12. CHECK ROLE TYPES
-- ============================================================
SELECT 
  '=== AVAILABLE ROLE TYPES ===' as section,
  enumlabel as role_type
FROM pg_enum
WHERE enumtypid = (
  SELECT oid FROM pg_type WHERE typname = 'role_type'
)
ORDER BY enumsortorder;

-- ============================================================
-- 13. CHECK RATE LIMIT DATA
-- ============================================================
SELECT 
  '=== RECENT INVITE ACTIVITY (Last Hour) ===' as section,
  COUNT(*) as total_invites,
  COUNT(DISTINCT invited_by) as unique_inviters,
  COUNT(DISTINCT event_id) as unique_events
FROM events.role_invites
WHERE created_at >= now() - interval '1 hour';

-- Per-user breakdown (top 5)
SELECT 
  '=== TOP INVITERS (Last Hour) ===' as section,
  invited_by,
  COUNT(*) as invite_count
FROM events.role_invites
WHERE created_at >= now() - interval '1 hour'
GROUP BY invited_by
ORDER BY invite_count DESC
LIMIT 5;

-- Per-event breakdown (top 5)
SELECT 
  '=== TOP EVENTS (Last Hour) ===' as section,
  event_id,
  COUNT(*) as invite_count
FROM events.role_invites
WHERE created_at >= now() - interval '1 hour'
GROUP BY event_id
ORDER BY invite_count DESC
LIMIT 5;

-- ============================================================
-- 14. CHECK AUDIT LOG
-- ============================================================
SELECT 
  '=== AUDIT LOG (Recent Role Invites) ===' as section,
  id,
  user_id,
  action,
  resource_type,
  resource_id,
  created_at,
  metadata->>'event_id' as event_id,
  metadata->>'role' as role,
  metadata->>'recipient_email' as recipient_email
FROM audit_log
WHERE action = 'role_invite_sent'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================
-- 15. SUMMARY
-- ============================================================
SELECT '=== AUDIT COMPLETE ===' as section,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'events' AND tablename = 'role_invites') as total_policies,
  (SELECT COUNT(*) FROM events.role_invites WHERE status = 'pending') as pending_invites,
  (SELECT COUNT(*) FROM events.role_invites WHERE status = 'accepted') as accepted_invites,
  (SELECT COUNT(*) FROM events.role_invites WHERE expires_at < now() AND status = 'pending') as expired_pending,
  (SELECT COUNT(*) FROM events.event_roles) as total_active_roles;

