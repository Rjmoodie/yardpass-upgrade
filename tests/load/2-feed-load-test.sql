-- =====================================================
-- YardPass Load Test #2: Unified Feed System
-- =====================================================
-- Purpose: Test feed performance with large datasets
-- Run this in Supabase SQL Editor

-- =====================================================
-- SETUP: Create Test Event & Posts
-- =====================================================

DO $$
DECLARE
  v_event_id uuid;
  v_user_id uuid;
  v_org_id uuid;
  v_post_count INTEGER := 1000; -- Create 1000 test posts
  i INTEGER;
BEGIN
  RAISE NOTICE '🚀 Setting up Feed Load Test...';
  
  -- Get a test user
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found. Please create a test user first.';
  END IF;

  -- Get or create an organization for the user
  SELECT id INTO v_org_id 
  FROM organizations 
  WHERE created_by = v_user_id 
  LIMIT 1;
  
  IF v_org_id IS NULL THEN
    INSERT INTO organizations (
      name,
      handle,
      created_by
    ) VALUES (
      '[LOAD TEST] Feed Test Organization',
      'load-test-feed-org-' || substring(gen_random_uuid()::text, 1, 8),
      v_user_id
    ) RETURNING id INTO v_org_id;
    
    RAISE NOTICE 'Created test organization: %', v_org_id;
  END IF;

  -- Create test event
  INSERT INTO public.events (
    title,
    description,
    start_at,
    end_at,
    category,
    visibility,
    created_by,
    owner_context_type,
    owner_context_id
  ) VALUES (
    '[LOAD TEST] Feed Performance Event',
    'Test event for feed load testing with many posts',
    now() + interval '15 days',
    now() + interval '15 days' + interval '6 hours',
    'music',
    'public',
    v_user_id,
    'organization',
    v_org_id
  ) RETURNING id INTO v_event_id;

  RAISE NOTICE 'Created test event: %', v_event_id;
  RAISE NOTICE 'Creating % posts...', v_post_count;

  -- Create bulk posts for load testing
  FOR i IN 1..v_post_count LOOP
    INSERT INTO public.event_posts (
      event_id,
      author_user_id,
      content,
      visibility
    ) VALUES (
      v_event_id,
      v_user_id,
      'Test post #' || i || ' - Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' ||
      'This is a test post created for load testing the unified feed system. ' ||
      'Post number ' || i || ' of ' || v_post_count || '.',
      'public'
    );
    
    -- Show progress every 100 posts
    IF i % 100 = 0 THEN
      RAISE NOTICE '  Created % posts...', i;
    END IF;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Created % posts', v_post_count;
  RAISE NOTICE 'Event ID: %', v_event_id;
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- TEST 1: Feed Load Performance (Initial 50 Posts)
-- =====================================================

-- This tests the initial feed load time
EXPLAIN ANALYZE
SELECT 
  ep.id,
  ep.content,
  ep.created_at,
  ep.author_user_id,
  up.display_name,
  up.avatar_url,
  (
    SELECT COUNT(*) 
    FROM post_reactions pr 
    WHERE pr.post_id = ep.id
  ) as reaction_count
FROM event_posts ep
LEFT JOIN user_profiles up ON up.user_id = ep.author_user_id
WHERE ep.event_id = (
  SELECT id FROM events WHERE title LIKE '[LOAD TEST] Feed%' ORDER BY created_at DESC LIMIT 1
)
AND ep.deleted_at IS NULL
ORDER BY ep.created_at DESC
LIMIT 50;

-- Expected: Query should complete in < 100ms

-- =====================================================
-- TEST 2: Infinite Scroll Performance (Pagination)
-- =====================================================

-- Simulate loading next page of posts
DO $$
DECLARE
  v_event_id uuid;
  v_start_time timestamp;
  v_end_time timestamp;
  v_duration interval;
  v_offset INTEGER;
  v_page_size INTEGER := 20;
  v_total_pages INTEGER := 10;
  i INTEGER;
BEGIN
  RAISE NOTICE '🧪 TEST 2: Infinite Scroll Performance';
  
  SELECT id INTO v_event_id 
  FROM events 
  WHERE title LIKE '[LOAD TEST] Feed%' 
  ORDER BY created_at DESC LIMIT 1;
  
  v_start_time := clock_timestamp();
  
  -- Simulate scrolling through 10 pages
  FOR i IN 0..(v_total_pages - 1) LOOP
    v_offset := i * v_page_size;
    
    PERFORM ep.id
    FROM event_posts ep
    WHERE ep.event_id = v_event_id
    AND ep.deleted_at IS NULL
    ORDER BY ep.created_at DESC
    LIMIT v_page_size
    OFFSET v_offset;
    
    RAISE NOTICE '  Page %: offset % (%.3f ms)', 
      i + 1, 
      v_offset,
      EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000;
  END LOOP;
  
  v_end_time := clock_timestamp();
  v_duration := v_end_time - v_start_time;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total time for % pages: %', v_total_pages, v_duration;
  RAISE NOTICE 'Average per page: % ms', 
    EXTRACT(EPOCH FROM v_duration) * 1000 / v_total_pages;
  RAISE NOTICE 'Target: < 500ms per page';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- TEST 3: Post Reactions Load Test
-- =====================================================

-- Create many reactions on posts to test reaction counting
DO $$
DECLARE
  v_event_id uuid;
  v_post_ids uuid[];
  v_user_ids uuid[];
  v_post_id uuid;
  v_user_id uuid;
  i INTEGER;
  j INTEGER;
BEGIN
  RAISE NOTICE '🧪 TEST 3: Creating Reaction Load (100 posts × 50 reactions each)';
  
  -- Get test event
  SELECT id INTO v_event_id 
  FROM events 
  WHERE title LIKE '[LOAD TEST] Feed%' 
  ORDER BY created_at DESC LIMIT 1;
  
  -- Get first 100 posts
  SELECT ARRAY_AGG(id) INTO v_post_ids
  FROM (
    SELECT id FROM event_posts 
    WHERE event_id = v_event_id 
    ORDER BY created_at DESC 
    LIMIT 100
  ) sub;
  
  -- Get multiple users (or create dummy user IDs for testing)
  SELECT ARRAY_AGG(id) INTO v_user_ids
  FROM (
    SELECT id FROM auth.users LIMIT 50
  ) sub;
  
  IF ARRAY_LENGTH(v_user_ids, 1) < 10 THEN
    RAISE NOTICE 'Not enough users for reaction testing. Skipping.';
    RETURN;
  END IF;
  
  -- Create reactions
  FOREACH v_post_id IN ARRAY v_post_ids LOOP
    FOR i IN 1..LEAST(50, ARRAY_LENGTH(v_user_ids, 1)) LOOP
      v_user_id := v_user_ids[i];
      
      BEGIN
        INSERT INTO post_reactions (post_id, user_id, reaction_type)
        VALUES (v_post_id, v_user_id, 'like')
        ON CONFLICT (post_id, user_id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        -- Ignore errors
      END;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '✅ Created reactions on 100 posts';
END $$;

-- Now test feed load with reactions
EXPLAIN ANALYZE
SELECT 
  ep.id,
  ep.content,
  ep.created_at,
  COUNT(DISTINCT pr.id) as reaction_count,
  COUNT(DISTINCT c.id) as comment_count
FROM event_posts ep
LEFT JOIN post_reactions pr ON pr.post_id = ep.id
LEFT JOIN comments c ON c.post_id = ep.id AND c.deleted_at IS NULL
WHERE ep.event_id = (
  SELECT id FROM events WHERE title LIKE '[LOAD TEST] Feed%' ORDER BY created_at DESC LIMIT 1
)
AND ep.deleted_at IS NULL
GROUP BY ep.id, ep.content, ep.created_at
ORDER BY ep.created_at DESC
LIMIT 50;

-- Expected: Should still complete in < 200ms even with reactions

-- =====================================================
-- TEST 4: Feed Query with User Metadata
-- =====================================================

-- Test the complete feed query with all joins
EXPLAIN ANALYZE
SELECT 
  ep.id,
  ep.content,
  ep.created_at,
  ep.media_url,
  ep.media_type,
  up.display_name as author_name,
  up.avatar_url as author_avatar,
  e.title as event_title,
  COUNT(DISTINCT pr.id) as reaction_count,
  COUNT(DISTINCT c.id) as comment_count,
  EXISTS(
    SELECT 1 FROM post_reactions pr2 
    WHERE pr2.post_id = ep.id 
    AND pr2.user_id = (SELECT id FROM auth.users LIMIT 1)
  ) as user_has_reacted
FROM event_posts ep
LEFT JOIN user_profiles up ON up.user_id = ep.author_user_id
LEFT JOIN events e ON e.id = ep.event_id
LEFT JOIN post_reactions pr ON pr.post_id = ep.id
LEFT JOIN comments c ON c.post_id = ep.id AND c.deleted_at IS NULL
WHERE ep.event_id = (
  SELECT id FROM events WHERE title LIKE '[LOAD TEST] Feed%' ORDER BY created_at DESC LIMIT 1
)
AND ep.deleted_at IS NULL
GROUP BY 
  ep.id, ep.content, ep.created_at, ep.media_url, ep.media_type,
  up.display_name, up.avatar_url, e.title
ORDER BY ep.created_at DESC
LIMIT 50;

-- Expected: Complete query should finish in < 300ms

-- =====================================================
-- TEST 5: Concurrent Post Creation
-- =====================================================

-- Simulate multiple users creating posts simultaneously
DO $$
DECLARE
  v_event_id uuid;
  v_user_id uuid;
  v_start_time timestamp;
  v_end_time timestamp;
  v_duration interval;
  i INTEGER;
  v_concurrent_posts INTEGER := 50;
BEGIN
  RAISE NOTICE '🧪 TEST 5: Concurrent Post Creation (% posts)', v_concurrent_posts;
  
  SELECT id INTO v_event_id 
  FROM events 
  WHERE title LIKE '[LOAD TEST] Feed%' 
  ORDER BY created_at DESC LIMIT 1;
  
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  v_start_time := clock_timestamp();
  
  FOR i IN 1..v_concurrent_posts LOOP
    INSERT INTO event_posts (
      event_id,
      author_user_id,
      content,
      visibility
    ) VALUES (
      v_event_id,
      v_user_id,
      'Concurrent test post #' || i || ' created at ' || clock_timestamp(),
      'public'
    );
  END LOOP;
  
  v_end_time := clock_timestamp();
  v_duration := v_end_time - v_start_time;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created % posts in %', v_concurrent_posts, v_duration;
  RAISE NOTICE 'Average per post: % ms', 
    EXTRACT(EPOCH FROM v_duration) * 1000 / v_concurrent_posts;
  RAISE NOTICE 'Target: < 100ms per post creation';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check total posts created
SELECT 
  e.title,
  COUNT(ep.id) as total_posts,
  COUNT(DISTINCT ep.author_user_id) as unique_authors,
  MIN(ep.created_at) as oldest_post,
  MAX(ep.created_at) as newest_post
FROM events e
LEFT JOIN event_posts ep ON ep.event_id = e.id
WHERE e.title LIKE '[LOAD TEST] Feed%'
GROUP BY e.id, e.title;

-- Check posts with most reactions
SELECT 
  ep.id,
  LEFT(ep.content, 50) || '...' as content_preview,
  COUNT(pr.id) as reaction_count
FROM event_posts ep
LEFT JOIN post_reactions pr ON pr.post_id = ep.id
WHERE ep.event_id = (
  SELECT id FROM events WHERE title LIKE '[LOAD TEST] Feed%' ORDER BY created_at DESC LIMIT 1
)
GROUP BY ep.id, ep.content
ORDER BY reaction_count DESC
LIMIT 10;

-- Check database indexes being used
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('event_posts', 'post_reactions', 'comments')
ORDER BY idx_scan DESC;

-- =====================================================
-- CLEANUP
-- =====================================================

-- Uncomment to clean up test data
-- DELETE FROM post_reactions WHERE post_id IN (
--   SELECT id FROM event_posts WHERE event_id IN (
--     SELECT id FROM events WHERE title LIKE '[LOAD TEST] Feed%'
--   )
-- );
-- DELETE FROM comments WHERE post_id IN (
--   SELECT id FROM event_posts WHERE event_id IN (
--     SELECT id FROM events WHERE title LIKE '[LOAD TEST] Feed%'
--   )
-- );
-- DELETE FROM event_posts WHERE event_id IN (
--   SELECT id FROM events WHERE title LIKE '[LOAD TEST] Feed%'
-- );
-- DELETE FROM events WHERE title LIKE '[LOAD TEST] Feed%';

-- =====================================================
-- FINAL SUMMARY
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ All feed load tests complete!';
  RAISE NOTICE 'Review results above and check for:';
  RAISE NOTICE '  1. Initial load < 100ms';
  RAISE NOTICE '  2. Pagination < 500ms per page';
  RAISE NOTICE '  3. Reaction queries < 200ms';
  RAISE NOTICE '  4. Full feed query < 300ms';
  RAISE NOTICE '  5. Post creation < 100ms';
  RAISE NOTICE '========================================';
END $$;

