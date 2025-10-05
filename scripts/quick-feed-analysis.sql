-- Quick Feed Analysis: Media Posts Affected by 21-Day Window
-- Run this to see immediate impact of current filtering

-- 1. QUICK SUMMARY
SELECT 
  'MEDIA POSTS EXCLUDED BY 21-DAY WINDOW' as analysis,
  COUNT(*) as total_media_posts_excluded
FROM event_posts p
JOIN events e ON e.id = p.event_id
WHERE p.deleted_at IS NULL
  AND e.visibility = 'public'
  AND e.start_at <= now() - INTERVAL '21 days'
  AND p.media_urls IS NOT NULL 
  AND array_length(p.media_urls, 1) > 0;

-- 2. TOP 10 EXCLUDED MEDIA POSTS (by engagement)
SELECT 
  e.title as event,
  up.display_name as author,
  p.created_at as posted,
  EXTRACT(DAYS FROM (now() - p.created_at)) as days_old,
  p.like_count + p.comment_count as total_engagement,
  p.media_urls[1] as first_media_url
FROM event_posts p
JOIN events e ON e.id = p.event_id
LEFT JOIN user_profiles up ON up.user_id = p.author_user_id
WHERE p.deleted_at IS NULL
  AND e.visibility = 'public'
  AND e.start_at <= now() - INTERVAL '21 days'
  AND p.media_urls IS NOT NULL 
  AND array_length(p.media_urls, 1) > 0
ORDER BY (p.like_count + p.comment_count) DESC
LIMIT 10;

-- 3. AGE DISTRIBUTION OF EXCLUDED POSTS
SELECT 
  CASE 
    WHEN EXTRACT(DAYS FROM (now() - p.created_at)) <= 30 THEN '22-30 days old'
    WHEN EXTRACT(DAYS FROM (now() - p.created_at)) <= 60 THEN '31-60 days old'
    WHEN EXTRACT(DAYS FROM (now() - p.created_at)) <= 90 THEN '61-90 days old'
    ELSE '90+ days old'
  END as age_range,
  COUNT(*) as media_posts_excluded
FROM event_posts p
JOIN events e ON e.id = p.event_id
WHERE p.deleted_at IS NULL
  AND e.visibility = 'public'
  AND e.start_at <= now() - INTERVAL '21 days'
  AND p.media_urls IS NOT NULL 
  AND array_length(p.media_urls, 1) > 0
GROUP BY 
  CASE 
    WHEN EXTRACT(DAYS FROM (now() - p.created_at)) <= 30 THEN '22-30 days old'
    WHEN EXTRACT(DAYS FROM (now() - p.created_at)) <= 60 THEN '31-60 days old'
    WHEN EXTRACT(DAYS FROM (now() - p.created_at)) <= 90 THEN '61-90 days old'
    ELSE '90+ days old'
  END
ORDER BY age_range;
