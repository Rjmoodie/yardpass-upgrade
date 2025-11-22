-- Test is_event_manager directly with your actual user ID
-- Run this AS your authenticated user (not in SQL Editor - use a test script or check from browser)

-- First, let's check if the function works in general
SELECT 
  '=== TEST is_event_manager FOR EVENT d98755ff-6996-4b8e-85b1-25e9323dd2ee ===' AS section,
  public.is_event_manager('d98755ff-6996-4b8e-85b1-25e9323dd2ee') AS result,
  CASE 
    WHEN public.is_event_manager('d98755ff-6996-4b8e-85b1-25e9323dd2ee') = true THEN '✅ Should work'
    ELSE '❌ BLOCKED - This is why you get 403'
  END AS status;

-- Check the event details
SELECT 
  '=== EVENT DETAILS ===' AS section,
  id AS event_id,
  title,
  owner_context_type,
  owner_context_id,
  created_by
FROM events.events
WHERE id = 'd98755ff-6996-4b8e-85b1-25e9323dd2ee';

-- Check your membership in the org that owns this event
SELECT 
  '=== YOUR ORG MEMBERSHIP ===' AS section,
  m.org_id,
  o.name AS org_name,
  m.role,
  CASE 
    WHEN m.role IN ('owner', 'admin', 'editor') THEN '✅ Should have access'
    ELSE '❌ Role too low'
  END AS access_status
FROM events.events e
JOIN organizations.organizations o ON e.owner_context_id = o.id
LEFT JOIN organizations.org_memberships m ON m.org_id = o.id AND m.user_id = auth.uid()
WHERE e.id = 'd98755ff-6996-4b8e-85b1-25e9323dd2ee';

