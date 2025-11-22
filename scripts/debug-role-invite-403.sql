-- ============================================================
-- DEBUG: Why is send-role-invite returning 403?
-- ============================================================
-- Run this to find the exact issue
-- ============================================================

-- 1. YOUR USER INFO
SELECT 
  '=== 1. YOUR USER INFO ===' as section,
  auth.uid() as your_user_id,
  auth.jwt() ->> 'email' as your_email;

-- 2. EVENT DETAILS (Check schema and ownership)
SELECT 
  '=== 2. EVENT DETAILS ===' as section,
  e.id,
  e.title,
  e.created_by,
  e.owner_context_type,
  e.owner_context_id,
  e.created_by = auth.uid() as you_created_event,
  CASE 
    WHEN e.owner_context_type = 'organization' THEN '✅ Org-owned'
    WHEN e.owner_context_type IS NULL THEN '❌ NULL (needs fix)'
    ELSE '⚠️ ' || e.owner_context_type
  END as context_type_status
FROM events.events e
WHERE e.id = 'd98755ff-6996-4b8e-85b1-25e9323dd2ee';

-- 3. YOUR ORG MEMBERSHIPS
SELECT 
  '=== 3. YOUR ORG MEMBERSHIPS ===' as section,
  om.org_id,
  o.name as org_name,
  om.role,
  om.org_id = (
    SELECT owner_context_id FROM events.events 
    WHERE id = 'd98755ff-6996-4b8e-85b1-25e9323dd2ee'
  ) as matches_event_org
FROM organizations.org_memberships om
JOIN organizations o ON om.org_id = o.id
WHERE om.user_id = auth.uid();

-- 4. CHECK IF PUBLIC.EVENTS VIEW EXISTS
SELECT 
  '=== 4. PUBLIC.EVENTS VIEW ===' as section,
  COUNT(*) as view_exists,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ View exists'
    ELSE '❌ View MISSING - this is the problem!'
  END as status
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'events';

-- 5. TEST INDIVIDUAL OWNER FUNCTION
SELECT 
  '=== 5. INDIVIDUAL OWNER CHECK ===' as section,
  public.is_event_individual_owner('d98755ff-6996-4b8e-85b1-25e9323dd2ee') as result,
  CASE 
    WHEN public.is_event_individual_owner('d98755ff-6996-4b8e-85b1-25e9323dd2ee') 
    THEN '✅ You are individual owner'
    ELSE '❌ Not individual owner'
  END as status;

-- 6. TEST ORG EDITOR FUNCTION
SELECT 
  '=== 6. ORG EDITOR CHECK ===' as section,
  public.is_event_org_editor('d98755ff-6996-4b8e-85b1-25e9323dd2ee') as result,
  CASE 
    WHEN public.is_event_org_editor('d98755ff-6996-4b8e-85b1-25e9323dd2ee') 
    THEN '✅ You are org editor/admin/owner'
    ELSE '❌ Not org editor/admin/owner'
  END as status;

-- 7. TEST EVENT MANAGER FUNCTION (FINAL CHECK)
SELECT 
  '=== 7. FINAL EVENT MANAGER CHECK ===' as section,
  public.is_event_manager('d98755ff-6996-4b8e-85b1-25e9323dd2ee') as result,
  CASE 
    WHEN public.is_event_manager('d98755ff-6996-4b8e-85b1-25e9323dd2ee') 
    THEN '✅ SHOULD WORK - Function says YES'
    ELSE '❌ BLOCKED - Function says NO'
  END as status,
  CASE 
    WHEN public.is_event_manager('d98755ff-6996-4b8e-85b1-25e9323dd2ee') 
    THEN 'If this is YES but still getting 403, check if function was redeployed'
    ELSE 'This is why you get 403 - check sections above to see what failed'
  END as next_steps;

-- 8. CHECK is_org_role FUNCTION (Used by is_event_org_editor)
SELECT 
  '=== 8. ORG ROLE CHECK ===' as section,
  om.org_id,
  o.name,
  om.role,
  public.is_org_role(om.org_id, ARRAY['editor','admin','owner']) as has_permission
FROM organizations.org_memberships om
JOIN organizations o ON om.org_id = o.id
WHERE om.user_id = auth.uid();

-- 9. DIAGNOSTIC SUMMARY
SELECT 
  '=== 9. DIAGNOSTIC SUMMARY ===' as section,
  (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'events') as public_events_view_exists,
  (SELECT created_by = auth.uid() FROM events.events WHERE id = 'd98755ff-6996-4b8e-85b1-25e9323dd2ee') as you_created_event,
  (SELECT owner_context_type FROM events.events WHERE id = 'd98755ff-6996-4b8e-85b1-25e9323dd2ee') as event_context_type,
  (SELECT COUNT(*) FROM organizations.org_memberships WHERE user_id = auth.uid() AND role IN ('owner','admin','editor')) as your_org_count,
  public.is_event_manager('d98755ff-6996-4b8e-85b1-25e9323dd2ee') as final_permission;

