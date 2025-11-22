-- Debug script: Check event_invites access and is_event_manager function
-- Run this to diagnose why no rows are returned

-- 1. Check if invites exist for the event
SELECT 
  'Invites in events.event_invites' AS check_type,
  COUNT(*) AS count
FROM events.event_invites
WHERE event_id = '28309929-28e7-4bda-af28-6e0b47485ce1';

-- 2. Show actual invites (bypassing RLS with service role if needed)
SELECT 
  'All invites for event' AS check_type,
  event_id,
  user_id,
  email,
  created_at
FROM events.event_invites
WHERE event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
ORDER BY created_at DESC;

-- 3. Check if current user is event manager
SELECT 
  'is_event_manager check' AS check_type,
  public.is_event_manager('28309929-28e7-4bda-af28-6e0b47485ce1') AS is_manager,
  auth.uid() AS current_user_id;

-- 4. Check event ownership details
SELECT 
  'Event ownership' AS check_type,
  id,
  title,
  created_by,
  owner_context_type,
  owner_context_id
FROM events.events
WHERE id = '28309929-28e7-4bda-af28-6e0b47485ce1';

-- 5. If org-owned, check org membership
SELECT 
  'Org membership check' AS check_type,
  om.user_id,
  om.role,
  om.org_id,
  auth.uid() = om.user_id AS is_current_user
FROM events.events e
LEFT JOIN organizations.org_memberships om 
  ON e.owner_context_type = 'organization' 
  AND e.owner_context_id = om.org_id
WHERE e.id = '28309929-28e7-4bda-af28-6e0b47485ce1'
  AND (om.user_id = auth.uid() OR om.user_id IS NULL);

-- 6. Check if user created the event
SELECT 
  'Event creator check' AS check_type,
  e.id,
  e.created_by,
  auth.uid() AS current_user_id,
  e.created_by = auth.uid() AS is_creator
FROM events.events e
WHERE e.id = '28309929-28e7-4bda-af28-6e0b47485ce1';

-- 7. Test the view directly (what frontend queries)
SELECT 
  'View query test' AS check_type,
  event_id,
  user_id,
  email,
  created_at
FROM public.event_invites
WHERE event_id = '28309929-28e7-4bda-af28-6e0b47485ce1';

