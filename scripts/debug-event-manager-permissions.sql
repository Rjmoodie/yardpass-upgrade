-- ============================================================
-- DEBUG: Event Manager Permissions
-- ============================================================
-- Run this to check if current user is recognized as event manager
-- ============================================================

-- 1. Check your user ID
SELECT 
  '=== YOUR USER INFO ===' as section,
  auth.uid() as your_user_id,
  auth.jwt() ->> 'email' as your_email;

-- 2. Check events you created
SELECT 
  '=== EVENTS YOU CREATED ===' as section,
  id as event_id,
  title,
  created_by,
  created_at
FROM events.events
WHERE created_by = auth.uid()
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check your event roles
SELECT 
  '=== YOUR EVENT ROLES ===' as section,
  er.event_id,
  e.title as event_title,
  er.role,
  er.status,
  er.created_at
FROM events.event_roles er
JOIN events.events e ON er.event_id = e.id
WHERE er.user_id = auth.uid()
ORDER BY er.created_at DESC;

-- 4. Test is_event_manager function for each event
SELECT 
  '=== EVENT MANAGER TEST ===' as section,
  e.id as event_id,
  e.title,
  e.created_by = auth.uid() as you_are_creator,
  is_event_manager(e.id) as is_event_manager_says,
  CASE 
    WHEN is_event_manager(e.id) THEN '✅ CAN INVITE'
    ELSE '❌ CANNOT INVITE'
  END as permission_status
FROM events.events e
WHERE e.created_by = auth.uid() 
   OR e.id IN (
     SELECT event_id FROM events.event_roles 
     WHERE user_id = auth.uid() AND role = 'organizer'
   )
ORDER BY e.created_at DESC
LIMIT 10;

-- 5. Check the is_event_manager function definition
SELECT 
  '=== is_event_manager FUNCTION ===' as section,
  routine_name,
  routine_type,
  security_type,
  data_type as return_type,
  routine_definition as function_code
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'is_event_manager';

-- 6. Check if you have any event_roles at all
SELECT 
  '=== ALL YOUR ROLES ===' as section,
  COUNT(*) as total_roles,
  COUNT(*) FILTER (WHERE role = 'organizer') as organizer_roles,
  COUNT(*) FILTER (WHERE role = 'scanner') as scanner_roles,
  COUNT(*) FILTER (WHERE status = 'active') as active_roles
FROM events.event_roles
WHERE user_id = auth.uid();

