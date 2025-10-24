-- ═══════════════════════════════════════════════════════════════
-- 📊 VIEW ALL SOCIAL CONTENT (Posts, Comments, Likes, Media)
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1️⃣ ALL EVENT POSTS WITH MEDIA
-- ───────────────────────────────────────────────────────────────
SELECT 
    '1️⃣ EVENT POSTS' as section,
    ep.id,
    ep.event_id,
    e.title as event_title,
    ep.author_user_id,
    up.display_name as author_name,
    ep.text as post_text,
    ep.media_urls,
    CASE 
        WHEN ep.media_urls IS NOT NULL THEN '🖼️ Has Media (' || jsonb_array_length(ep.media_urls) || ' files)'
        ELSE '📝 Text Only'
    END as media_status,
    ep.like_count,
    ep.comment_count,
    ep.created_at,
    ep.updated_at
FROM events.event_posts ep
LEFT JOIN events.events e ON e.id = ep.event_id
LEFT JOIN users.user_profiles up ON up.user_id = ep.author_user_id
ORDER BY ep.created_at DESC
LIMIT 50;

-- ───────────────────────────────────────────────────────────────
-- 2️⃣ ALL COMMENTS ON POSTS
-- ───────────────────────────────────────────────────────────────
SELECT 
    '2️⃣ COMMENTS' as section,
    ec.id as comment_id,
    ec.post_id,
    ep.text as post_text_preview,
    ec.author_user_id,
    up.display_name as commenter_name,
    ec.text as comment_text,
    ec.like_count as comment_likes,
    ec.created_at as commented_at
FROM events.event_comments ec
LEFT JOIN events.event_posts ep ON ep.id = ec.post_id
LEFT JOIN users.user_profiles up ON up.user_id = ec.author_user_id
ORDER BY ec.created_at DESC
LIMIT 50;

-- ───────────────────────────────────────────────────────────────
-- 3️⃣ ALL POST REACTIONS (Likes)
-- ───────────────────────────────────────────────────────────────
SELECT 
    '3️⃣ POST REACTIONS' as section,
    er.id as reaction_id,
    er.post_id,
    ep.text as post_text_preview,
    er.user_id,
    up.display_name as user_name,
    er.kind as reaction_type,
    er.created_at as reacted_at
FROM events.event_reactions er
LEFT JOIN events.event_posts ep ON ep.id = er.post_id
LEFT JOIN users.user_profiles up ON up.user_id = er.user_id
ORDER BY er.created_at DESC
LIMIT 50;

-- ───────────────────────────────────────────────────────────────
-- 4️⃣ ALL COMMENT REACTIONS (Likes on Comments)
-- ───────────────────────────────────────────────────────────────
SELECT 
    '4️⃣ COMMENT REACTIONS' as section,
    ecr.id as reaction_id,
    ecr.comment_id,
    ec.text as comment_text_preview,
    ecr.user_id,
    up.display_name as user_name,
    ecr.kind as reaction_type,
    ecr.created_at as reacted_at
FROM events.event_comment_reactions ecr
LEFT JOIN events.event_comments ec ON ec.id = ecr.comment_id
LEFT JOIN users.user_profiles up ON up.user_id = ecr.user_id
ORDER BY ecr.created_at DESC
LIMIT 50;

-- ───────────────────────────────────────────────────────────────
-- 5️⃣ COMPLETE POST VIEW (With All Engagement)
-- ───────────────────────────────────────────────────────────────
SELECT 
    '5️⃣ COMPLETE POST VIEW' as section,
    ep.id as post_id,
    e.title as event_title,
    up.display_name as author,
    ep.text as post_content,
    ep.media_urls,
    CASE 
        WHEN ep.media_urls IS NOT NULL 
        THEN jsonb_array_length(ep.media_urls) 
        ELSE 0 
    END as media_count,
    ep.like_count,
    ep.comment_count,
    COUNT(DISTINCT er.id) as actual_reactions,
    COUNT(DISTINCT ec.id) as actual_comments,
    ep.created_at
FROM events.event_posts ep
LEFT JOIN events.events e ON e.id = ep.event_id
LEFT JOIN users.user_profiles up ON up.user_id = ep.author_user_id
LEFT JOIN events.event_reactions er ON er.post_id = ep.id
LEFT JOIN events.event_comments ec ON ec.post_id = ep.id
GROUP BY ep.id, e.title, up.display_name, ep.text, ep.media_urls, 
         ep.like_count, ep.comment_count, ep.created_at
ORDER BY ep.created_at DESC
LIMIT 20;

-- ───────────────────────────────────────────────────────────────
-- 6️⃣ POSTS WITH EXPANDED MEDIA URLs
-- ───────────────────────────────────────────────────────────────
SELECT 
    '6️⃣ MEDIA FILES' as section,
    ep.id as post_id,
    e.title as event_title,
    up.display_name as author,
    LEFT(ep.text, 100) as post_preview,
    media_file.value as media_url,
    CASE 
        WHEN media_file.value::text LIKE '%image%' THEN '🖼️ Image'
        WHEN media_file.value::text LIKE '%video%' THEN '🎥 Video'
        WHEN media_file.value::text LIKE '%mux%' THEN '🎬 Mux Video'
        ELSE '📎 File'
    END as media_type,
    ep.created_at
FROM events.event_posts ep
LEFT JOIN events.events e ON e.id = ep.event_id
LEFT JOIN users.user_profiles up ON up.user_id = ep.author_user_id
CROSS JOIN LATERAL jsonb_array_elements(ep.media_urls) as media_file
WHERE ep.media_urls IS NOT NULL
ORDER BY ep.created_at DESC
LIMIT 100;

-- ───────────────────────────────────────────────────────────────
-- 7️⃣ ENGAGEMENT SUMMARY BY EVENT
-- ───────────────────────────────────────────────────────────────
SELECT 
    '7️⃣ ENGAGEMENT BY EVENT' as section,
    e.id as event_id,
    e.title as event_title,
    COUNT(DISTINCT ep.id) as total_posts,
    COUNT(DISTINCT ec.id) as total_comments,
    COUNT(DISTINCT er.id) as total_post_reactions,
    COUNT(DISTINCT ecr.id) as total_comment_reactions,
    SUM(CASE WHEN ep.media_urls IS NOT NULL THEN jsonb_array_length(ep.media_urls) ELSE 0 END) as total_media_files,
    MAX(ep.created_at) as last_post_at
FROM events.events e
LEFT JOIN events.event_posts ep ON ep.event_id = e.id
LEFT JOIN events.event_comments ec ON ec.post_id = ep.id
LEFT JOIN events.event_reactions er ON er.post_id = ep.id
LEFT JOIN events.event_comment_reactions ecr ON ecr.comment_id = ec.id
GROUP BY e.id, e.title
HAVING COUNT(DISTINCT ep.id) > 0
ORDER BY total_posts DESC
LIMIT 20;

-- ───────────────────────────────────────────────────────────────
-- 8️⃣ MOST ENGAGED POSTS (Top Posts by Engagement)
-- ───────────────────────────────────────────────────────────────
SELECT 
    '8️⃣ TOP POSTS' as section,
    ep.id as post_id,
    e.title as event_title,
    up.display_name as author,
    LEFT(ep.text, 150) as post_preview,
    ep.like_count,
    ep.comment_count,
    (ep.like_count + (ep.comment_count * 2)) as engagement_score,
    CASE 
        WHEN ep.media_urls IS NOT NULL 
        THEN jsonb_array_length(ep.media_urls) 
        ELSE 0 
    END as media_count,
    ep.created_at
FROM events.event_posts ep
LEFT JOIN events.events e ON e.id = ep.event_id
LEFT JOIN users.user_profiles up ON up.user_id = ep.author_user_id
ORDER BY engagement_score DESC
LIMIT 20;

-- ───────────────────────────────────────────────────────────────
-- 9️⃣ MOST ACTIVE USERS (Top Contributors)
-- ───────────────────────────────────────────────────────────────
SELECT 
    '9️⃣ TOP CONTRIBUTORS' as section,
    up.user_id,
    up.display_name,
    COUNT(DISTINCT ep.id) as posts_created,
    COUNT(DISTINCT ec.id) as comments_made,
    COUNT(DISTINCT er.id) as reactions_given,
    (COUNT(DISTINCT ep.id) * 3 + 
     COUNT(DISTINCT ec.id) * 2 + 
     COUNT(DISTINCT er.id)) as activity_score
FROM users.user_profiles up
LEFT JOIN events.event_posts ep ON ep.author_user_id = up.user_id
LEFT JOIN events.event_comments ec ON ec.author_user_id = up.user_id
LEFT JOIN events.event_reactions er ON er.user_id = up.user_id
GROUP BY up.user_id, up.display_name
HAVING COUNT(DISTINCT ep.id) > 0 
    OR COUNT(DISTINCT ec.id) > 0 
    OR COUNT(DISTINCT er.id) > 0
ORDER BY activity_score DESC
LIMIT 20;

-- ───────────────────────────────────────────────────────────────
-- 🔟 SUMMARY STATISTICS
-- ───────────────────────────────────────────────────────────────
SELECT 
    '🔟 SUMMARY' as section,
    (SELECT COUNT(*) FROM events.event_posts) as total_posts,
    (SELECT COUNT(*) FROM events.event_comments) as total_comments,
    (SELECT COUNT(*) FROM events.event_reactions) as total_post_reactions,
    (SELECT COUNT(*) FROM events.event_comment_reactions) as total_comment_reactions,
    (SELECT COUNT(*) FROM events.event_posts WHERE media_urls IS NOT NULL) as posts_with_media,
    (SELECT SUM(jsonb_array_length(media_urls)) 
     FROM events.event_posts 
     WHERE media_urls IS NOT NULL) as total_media_files,
    (SELECT COUNT(DISTINCT author_user_id) FROM events.event_posts) as unique_post_authors,
    (SELECT COUNT(DISTINCT author_user_id) FROM events.event_comments) as unique_commenters;


