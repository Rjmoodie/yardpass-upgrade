-- Diagnostic: Which event is causing the 403?
-- Run this to find out which event you're trying to invite for

-- 1. YOUR USER ID
SELECT 
  '=== YOUR USER INFO ===' AS section,
  auth.uid() AS your_user_id,
  email
FROM auth.users
WHERE id = auth.uid();

-- 2. ALL YOUR EVENTS (as individual owner or via org)
SELECT 
  '=== YOUR EVENTS ===' AS section,
  e.id AS event_id,
  e.title,
  e.owner_context_type,
  e.owner_context_id,
  CASE 
    WHEN e.created_by = auth.uid() THEN '✅ You created this'
    ELSE '⚠️ Org created this'
  END AS creation_status,
  CASE 
    WHEN e.owner_context_type = 'individual' THEN '✅ Individual event - you own it'
    WHEN e.owner_context_type = 'organization' THEN 
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM organizations.org_memberships m 
          WHERE m.org_id = e.owner_context_id 
            AND m.user_id = auth.uid() 
            AND m.role IN ('owner', 'admin')
        ) THEN '✅ Org event - you are owner/admin'
        ELSE '❌ Org event - you are NOT owner/admin'
      END
  END AS permission_status,
  public.is_event_manager(e.id) AS is_manager_function_result
FROM public.events e
WHERE e.created_by = auth.uid()
   OR e.owner_context_id IN (
     SELECT org_id FROM organizations.org_memberships 
     WHERE user_id = auth.uid()
   )
ORDER BY e.created_at DESC
LIMIT 10;

-- 3. ORGANIZATIONS YOU OWN
SELECT 
  '=== YOUR ORGANIZATIONS ===' AS section,
  o.id AS org_id,
  o.name AS org_name,
  m.role,
  (SELECT COUNT(*) FROM public.events WHERE owner_context_id = o.id) AS event_count
FROM organizations.org_memberships m
JOIN organizations.organizations o ON m.org_id = o.id
WHERE m.user_id = auth.uid()
ORDER BY m.created_at DESC;

-- 4. CHECK THE SPECIFIC EVENT FROM YOUR RECENT ATTEMPT
-- Replace this with the actual event ID if you know it
SELECT 
  '=== CHECKING RECENT EVENT (if known) ===' AS section,
  'Run: SELECT * FROM public.events WHERE id = ''YOUR_EVENT_ID_HERE'';' AS instruction;

