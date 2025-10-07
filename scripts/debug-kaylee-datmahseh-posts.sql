-- Debug script to find posts by Kaylee and Datmahseh
-- This will help us understand why their posts aren't showing in the feed

-- First, let's find these users
SELECT 
  up.user_id,
  up.display_name,
  up.created_at as profile_created
FROM user_profiles up 
WHERE LOWER(up.display_name) LIKE '%kaylee%' 
   OR LOWER(up.display_name) LIKE '%datmahseh%'
ORDER BY up.display_name;

-- Now let's find their posts
WITH target_users AS (
  SELECT user_id, display_name
  FROM user_profiles up 
  WHERE LOWER(up.display_name) LIKE '%kaylee%' 
     OR LOWER(up.display_name) LIKE '%datmahseh%'
)
SELECT 
  p.id as post_id,
  p.created_at,
  p.text,
  p.media_urls,
  p.like_count,
  p.comment_count,
  p.deleted_at,
  e.id as event_id,
  e.title as event_title,
  e.start_at as event_start,
  e.visibility as event_visibility,
  tu.display_name as author_name,
  -- Check if post is within current feed window
  CASE 
    WHEN p.created_at > now() - INTERVAL '21 days' THEN 'WITHIN_21_DAYS'
    WHEN p.created_at > now() - INTERVAL '180 days' THEN 'WITHIN_180_DAYS'
    ELSE 'OUTSIDE_180_DAYS'
  END as feed_window_status,
  -- Check if event is within current feed window
  CASE 
    WHEN e.start_at > now() - INTERVAL '21 days' THEN 'EVENT_WITHIN_21_DAYS'
    WHEN e.start_at > now() - INTERVAL '180 days' THEN 'EVENT_WITHIN_180_DAYS'
    ELSE 'EVENT_OUTSIDE_180_DAYS'
  END as event_feed_window_status
FROM event_posts p
JOIN target_users tu ON tu.user_id = p.author_user_id
JOIN events e ON e.id = p.event_id
WHERE p.deleted_at IS NULL
ORDER BY p.created_at DESC;

-- Check what the current get_home_feed_ids function would return
-- (This will only work if you have the function deployed)
SELECT 'Current feed function results:' as info;

-- Let's also check if there are any posts with media_urls
SELECT 
  COUNT(*) as total_posts,
  COUNT(*) FILTER (WHERE media_urls IS NOT NULL AND array_length(media_urls, 1) > 0) as posts_with_media,
  COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '21 days') as posts_within_21_days,
  COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '180 days') as posts_within_180_days
FROM event_posts 
WHERE deleted_at IS NULL;
