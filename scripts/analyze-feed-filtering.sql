-- Analyze Feed Filtering: 21-Day Window Impact
-- This script shows what media posts are affected by the current feed filtering

-- 1. OVERVIEW: Total posts vs. posts in feed window
SELECT 
  'Total Posts' as category,
  COUNT(*) as count,
  COUNT(CASE WHEN media_urls IS NOT NULL AND array_length(media_urls, 1) > 0 THEN 1 END) as with_media
FROM event_posts 
WHERE deleted_at IS NULL

UNION ALL

SELECT 
  'Posts in 21-day window' as category,
  COUNT(*) as count,
  COUNT(CASE WHEN media_urls IS NOT NULL AND array_length(media_urls, 1) > 0 THEN 1 END) as with_media
FROM event_posts p
JOIN events e ON e.id = p.event_id
WHERE p.deleted_at IS NULL
  AND e.visibility = 'public'
  AND e.start_at > now() - INTERVAL '21 days'

UNION ALL

SELECT 
  'Posts EXCLUDED by 21-day window' as category,
  COUNT(*) as count,
  COUNT(CASE WHEN media_urls IS NOT NULL AND array_length(media_urls, 1) > 0 THEN 1 END) as with_media
FROM event_posts p
JOIN events e ON e.id = p.event_id
WHERE p.deleted_at IS NULL
  AND e.visibility = 'public'
  AND e.start_at <= now() - INTERVAL '21 days';

-- 2. DETAILED BREAKDOWN: Posts excluded by time window
SELECT 
  e.title as event_title,
  e.start_at as event_start,
  EXTRACT(DAYS FROM (now() - e.start_at)) as days_old,
  e.visibility,
  COUNT(p.id) as total_posts,
  COUNT(CASE WHEN p.media_urls IS NOT NULL AND array_length(p.media_urls, 1) > 0 THEN 1 END) as media_posts,
  MAX(p.created_at) as latest_post
FROM events e
JOIN event_posts p ON p.event_id = e.id
WHERE p.deleted_at IS NULL
  AND e.visibility = 'public'
  AND e.start_at <= now() - INTERVAL '21 days'
GROUP BY e.id, e.title, e.start_at, e.visibility
ORDER BY e.start_at DESC
LIMIT 20;

-- 3. MEDIA POSTS SPECIFICALLY EXCLUDED
SELECT 
  e.title as event_title,
  up.display_name as author_name,
  p.created_at as post_created,
  EXTRACT(DAYS FROM (now() - p.created_at)) as post_days_old,
  p.media_urls,
  p.text as post_text,
  p.like_count,
  p.comment_count
FROM event_posts p
JOIN events e ON e.id = p.event_id
LEFT JOIN user_profiles up ON up.user_id = p.author_user_id
WHERE p.deleted_at IS NULL
  AND e.visibility = 'public'
  AND e.start_at <= now() - INTERVAL '21 days'
  AND p.media_urls IS NOT NULL 
  AND array_length(p.media_urls, 1) > 0
ORDER BY p.created_at DESC
LIMIT 30;

-- 4. VISIBILITY IMPACT: Posts excluded by event visibility
SELECT 
  e.visibility,
  COUNT(p.id) as total_posts,
  COUNT(CASE WHEN p.media_urls IS NOT NULL AND array_length(p.media_urls, 1) > 0 THEN 1 END) as media_posts
FROM events e
JOIN event_posts p ON p.event_id = e.id
WHERE p.deleted_at IS NULL
GROUP BY e.visibility
ORDER BY e.visibility;

-- 5. TIME DISTRIBUTION: When were the excluded posts created?
SELECT 
  CASE 
    WHEN EXTRACT(DAYS FROM (now() - p.created_at)) <= 7 THEN '0-7 days ago'
    WHEN EXTRACT(DAYS FROM (now() - p.created_at)) <= 14 THEN '8-14 days ago'
    WHEN EXTRACT(DAYS FROM (now() - p.created_at)) <= 21 THEN '15-21 days ago'
    WHEN EXTRACT(DAYS FROM (now() - p.created_at)) <= 30 THEN '22-30 days ago'
    WHEN EXTRACT(DAYS FROM (now() - p.created_at)) <= 60 THEN '31-60 days ago'
    ELSE '60+ days ago'
  END as age_bucket,
  COUNT(p.id) as total_posts,
  COUNT(CASE WHEN p.media_urls IS NOT NULL AND array_length(p.media_urls, 1) > 0 THEN 1 END) as media_posts
FROM event_posts p
JOIN events e ON e.id = p.event_id
WHERE p.deleted_at IS NULL
  AND e.visibility = 'public'
GROUP BY 
  CASE 
    WHEN EXTRACT(DAYS FROM (now() - p.created_at)) <= 7 THEN '0-7 days ago'
    WHEN EXTRACT(DAYS FROM (now() - p.created_at)) <= 14 THEN '8-14 days ago'
    WHEN EXTRACT(DAYS FROM (now() - p.created_at)) <= 21 THEN '15-21 days ago'
    WHEN EXTRACT(DAYS FROM (now() - p.created_at)) <= 30 THEN '22-30 days ago'
    WHEN EXTRACT(DAYS FROM (now() - p.created_at)) <= 60 THEN '31-60 days ago'
    ELSE '60+ days ago'
  END
ORDER BY age_bucket;

-- 6. RECENT MEDIA POSTS THAT WOULD BE INCLUDED (for comparison)
SELECT 
  'RECENT MEDIA POSTS (Included in feed)' as section,
  e.title as event_title,
  up.display_name as author_name,
  p.created_at as post_created,
  EXTRACT(DAYS FROM (now() - p.created_at)) as post_days_old,
  p.media_urls,
  p.like_count,
  p.comment_count
FROM event_posts p
JOIN events e ON e.id = p.event_id
LEFT JOIN user_profiles up ON up.user_id = p.author_user_id
WHERE p.deleted_at IS NULL
  AND e.visibility = 'public'
  AND e.start_at > now() - INTERVAL '21 days'
  AND p.media_urls IS NOT NULL 
  AND array_length(p.media_urls, 1) > 0
ORDER BY p.created_at DESC
LIMIT 10;

-- 7. SUMMARY RECOMMENDATIONS
SELECT 
  'SUMMARY' as section,
  'Current 21-day window excludes' as metric,
  COUNT(*) as value,
  'media posts from older events' as description
FROM event_posts p
JOIN events e ON e.id = p.event_id
WHERE p.deleted_at IS NULL
  AND e.visibility = 'public'
  AND e.start_at <= now() - INTERVAL '21 days'
  AND p.media_urls IS NOT NULL 
  AND array_length(p.media_urls, 1) > 0;
