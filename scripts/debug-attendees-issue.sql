-- Debug script to check why attendees might not be showing
-- Run this to diagnose the attendees page issue

-- 1. Check if events exist and their structure
SELECT '=== EVENTS CHECK ===' as section;
SELECT 
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE visibility = 'public') as public_events,
  COUNT(*) FILTER (WHERE visibility = 'private') as private_events,
  COUNT(*) FILTER (WHERE visibility = 'unlisted') as unlisted_events
FROM events;

-- 2. Check tickets table structure and data
SELECT '=== TICKETS CHECK ===' as section;
SELECT 
  COUNT(*) as total_tickets,
  COUNT(*) FILTER (WHERE status = 'issued') as issued_tickets,
  COUNT(*) FILTER (WHERE status = 'transferred') as transferred_tickets,
  COUNT(*) FILTER (WHERE status = 'redeemed') as redeemed_tickets,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_tickets,
  COUNT(*) FILTER (WHERE status = 'refunded') as refunded_tickets
FROM tickets;

-- 3. Check user_profiles table
SELECT '=== USER PROFILES CHECK ===' as section;
SELECT 
  COUNT(*) as total_profiles,
  COUNT(*) FILTER (WHERE display_name IS NOT NULL) as profiles_with_names,
  COUNT(*) FILTER (WHERE photo_url IS NOT NULL) as profiles_with_photos
FROM user_profiles;

-- 4. Check the join between tickets and user_profiles
SELECT '=== TICKET-USER JOIN CHECK ===' as section;
SELECT 
  COUNT(*) as total_joins,
  COUNT(*) FILTER (WHERE user_profiles.id IS NOT NULL) as successful_joins,
  COUNT(*) FILTER (WHERE user_profiles.display_name IS NOT NULL) as joins_with_names
FROM tickets t
LEFT JOIN user_profiles up ON up.id = t.owner_user_id;

-- 5. Sample data for a specific event (replace with actual event ID)
SELECT '=== SAMPLE EVENT DATA ===' as section;
SELECT 
  e.id as event_id,
  e.title,
  e.visibility,
  e.slug,
  COUNT(t.id) as ticket_count,
  COUNT(t.id) FILTER (WHERE t.status IN ('issued', 'transferred', 'redeemed')) as valid_tickets,
  COUNT(up.id) FILTER (WHERE t.status IN ('issued', 'transferred', 'redeemed')) as attendees_with_profiles
FROM events e
LEFT JOIN tickets t ON t.event_id = e.id
LEFT JOIN user_profiles up ON up.id = t.owner_user_id
WHERE e.visibility = 'public'
GROUP BY e.id, e.title, e.visibility, e.slug
ORDER BY valid_tickets DESC
LIMIT 5;

-- 6. Check for potential RLS issues
SELECT '=== RLS CHECK ===' as section;
-- Check if RLS is enabled on key tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('events', 'tickets', 'user_profiles')
  AND schemaname = 'public';

-- 7. Sample attendee data for debugging
SELECT '=== SAMPLE ATTENDEE DATA ===' as section;
SELECT 
  t.id as ticket_id,
  t.event_id,
  t.owner_user_id,
  t.status,
  up.id as profile_id,
  up.display_name,
  up.photo_url,
  e.title as event_title
FROM tickets t
JOIN user_profiles up ON up.id = t.owner_user_id
JOIN events e ON e.id = t.event_id
WHERE t.status IN ('issued', 'transferred', 'redeemed')
  AND e.visibility = 'public'
ORDER BY t.created_at DESC
LIMIT 10;

-- 8. Check for any data inconsistencies
SELECT '=== DATA CONSISTENCY CHECK ===' as section;
-- Check for tickets without valid user profiles
SELECT 
  COUNT(*) as orphaned_tickets
FROM tickets t
LEFT JOIN user_profiles up ON up.id = t.owner_user_id
WHERE up.id IS NULL;

-- Check for user profiles without valid tickets
SELECT 
  COUNT(*) as profiles_without_tickets
FROM user_profiles up
LEFT JOIN tickets t ON t.owner_user_id = up.id
WHERE t.id IS NULL;
