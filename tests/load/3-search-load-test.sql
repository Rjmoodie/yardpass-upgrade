-- =====================================================
-- Liventix Load Test #3: Search & Discovery System
-- =====================================================
-- Purpose: Test search performance with complex queries
-- Run this in Supabase SQL Editor

-- =====================================================
-- SETUP: Create Diverse Test Events
-- =====================================================

DO $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_categories text[] := ARRAY['music', 'sports', 'arts', 'food', 'tech', 'fitness', 'community'];
  v_cities text[] := ARRAY['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];
  v_countries text[] := ARRAY['USA', 'Canada', 'UK', 'Australia'];
  v_event_count INTEGER := 500; -- Create 500 diverse events
  i INTEGER;
  v_category text;
  v_city text;
  v_country text;
BEGIN
  RAISE NOTICE '🚀 Setting up Search Load Test...';
  
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
      '[LOAD TEST] Search Test Organization',
      'load-test-search-org-' || substring(gen_random_uuid()::text, 1, 8),
      v_user_id
    ) RETURNING id INTO v_org_id;
    
    RAISE NOTICE 'Created test organization: %', v_org_id;
  END IF;

  RAISE NOTICE 'Creating % diverse events for search testing...', v_event_count;

  -- Create diverse events
  FOR i IN 1..v_event_count LOOP
    -- Randomly select category, city, country
    v_category := v_categories[1 + (random() * (ARRAY_LENGTH(v_categories, 1) - 1))::INTEGER];
    v_city := v_cities[1 + (random() * (ARRAY_LENGTH(v_cities, 1) - 1))::INTEGER];
    v_country := v_countries[1 + (random() * (ARRAY_LENGTH(v_countries, 1) - 1))::INTEGER];
    
    INSERT INTO public.events (
      title,
      description,
      start_at,
      end_at,
      venue,
      city,
      country,
      category,
      visibility,
      created_by,
      owner_context_type,
      owner_context_id
    ) VALUES (
      CASE (i % 5)
        WHEN 0 THEN 'Music Festival ' || i
        WHEN 1 THEN 'Concert Series ' || i
        WHEN 2 THEN v_category || ' Event ' || i
        WHEN 3 THEN 'Live Performance ' || i
        ELSE 'Special Event ' || i
      END,
      'Test event #' || i || ' for search load testing. ' ||
      'This event is in the ' || v_category || ' category and located in ' || v_city || ', ' || v_country || '. ' ||
      'Search keywords: live music, concert, festival, performance, entertainment, nightlife.',
      now() + (i || ' days')::interval, -- Spread events over next 500 days
      now() + (i || ' days')::interval + interval '4 hours',
      'Venue ' || (i % 50 + 1),
      v_city,
      v_country,
      v_category,
      'public',
      v_user_id,
      'organization',
      v_org_id
    );
    
    -- Show progress every 100 events
    IF i % 100 = 0 THEN
      RAISE NOTICE '  Created % events...', i;
    END IF;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Created % events across % categories', v_event_count, ARRAY_LENGTH(v_categories, 1);
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- TEST 1: Simple Text Search Performance
-- =====================================================

-- Test basic text search
DO $$
DECLARE
  v_start_time timestamp;
  v_end_time timestamp;
  v_duration interval;
  v_result_count INTEGER;
BEGIN
  RAISE NOTICE '🧪 TEST 1: Simple Text Search ("music festival")';
  
  v_start_time := clock_timestamp();
  
  SELECT COUNT(*) INTO v_result_count
  FROM search_all(
    p_user := NULL,
    p_q := 'music festival',
    p_limit := 20,
    p_offset := 0
  );
  
  v_end_time := clock_timestamp();
  v_duration := v_end_time - v_start_time;
  
  RAISE NOTICE 'Found % results in %', v_result_count, v_duration;
  RAISE NOTICE 'Query time: % ms (Target: < 500ms)', 
    EXTRACT(EPOCH FROM v_duration) * 1000;
  RAISE NOTICE '========================================';
END $$;

-- Analyze the query plan
EXPLAIN ANALYZE
SELECT *
FROM search_all(
  p_user := NULL,
  p_q := 'music festival',
  p_limit := 20,
  p_offset := 0
);

-- =====================================================
-- TEST 2: Multi-Filter Search Performance
-- =====================================================

-- Test search with multiple filters
DO $$
DECLARE
  v_start_time timestamp;
  v_end_time timestamp;
  v_duration interval;
  v_result_count INTEGER;
BEGIN
  RAISE NOTICE '🧪 TEST 2: Multi-Filter Search (text + category + location + date)';
  
  v_start_time := clock_timestamp();
  
  SELECT COUNT(*) INTO v_result_count
  FROM search_all(
    p_user := NULL,
    p_q := 'music',
    p_category := 'music',
    p_location := 'New York',
    p_date_from := CURRENT_DATE,
    p_date_to := CURRENT_DATE + INTERVAL '90 days',
    p_limit := 20,
    p_offset := 0
  );
  
  v_end_time := clock_timestamp();
  v_duration := v_end_time - v_start_time;
  
  RAISE NOTICE 'Found % results in %', v_result_count, v_duration;
  RAISE NOTICE 'Query time: % ms (Target: < 1000ms)', 
    EXTRACT(EPOCH FROM v_duration) * 1000;
  RAISE NOTICE '========================================';
END $$;

-- Analyze the multi-filter query plan
EXPLAIN ANALYZE
SELECT *
FROM search_all(
  p_user := NULL,
  p_q := 'music',
  p_category := 'music',
  p_location := 'New York',
  p_date_from := CURRENT_DATE,
  p_date_to := CURRENT_DATE + INTERVAL '90 days',
  p_limit := 20,
  p_offset := 0
);

-- =====================================================
-- TEST 3: Location-Based Search Performance
-- =====================================================

-- Test location filtering
DO $$
DECLARE
  v_start_time timestamp;
  v_end_time timestamp;
  v_duration interval;
  v_result_count INTEGER;
  v_locations text[] := ARRAY['New York', 'Los Angeles', 'Chicago', 'Houston'];
  v_location text;
BEGIN
  RAISE NOTICE '🧪 TEST 3: Location-Based Search Performance';
  
  FOREACH v_location IN ARRAY v_locations LOOP
    v_start_time := clock_timestamp();
    
    SELECT COUNT(*) INTO v_result_count
    FROM search_all(
      p_user := NULL,
      p_q := NULL,
      p_location := v_location,
      p_limit := 50,
      p_offset := 0
    );
    
    v_end_time := clock_timestamp();
    v_duration := v_end_time - v_start_time;
    
    RAISE NOTICE '  % : % results in % ms', 
      v_location, 
      v_result_count,
      EXTRACT(EPOCH FROM v_duration) * 1000;
  END LOOP;
  
  RAISE NOTICE 'Target: < 800ms per location search';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- TEST 4: Category Filtering Performance
-- =====================================================

-- Test each category
DO $$
DECLARE
  v_start_time timestamp;
  v_end_time timestamp;
  v_duration interval;
  v_result_count INTEGER;
  v_categories text[] := ARRAY['music', 'sports', 'arts', 'food', 'tech', 'fitness'];
  v_category text;
BEGIN
  RAISE NOTICE '🧪 TEST 4: Category Filtering Performance';
  
  FOREACH v_category IN ARRAY v_categories LOOP
    v_start_time := clock_timestamp();
    
    SELECT COUNT(*) INTO v_result_count
    FROM search_all(
      p_user := NULL,
      p_q := NULL,
      p_category := v_category,
      p_date_from := CURRENT_DATE,
      p_date_to := CURRENT_DATE + INTERVAL '365 days',
      p_limit := 100,
      p_offset := 0
    );
    
    v_end_time := clock_timestamp();
    v_duration := v_end_time - v_start_time;
    
    RAISE NOTICE '  % : % results in % ms', 
      v_category, 
      v_result_count,
      EXTRACT(EPOCH FROM v_duration) * 1000;
  END LOOP;
  
  RAISE NOTICE 'Target: < 300ms per category filter';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- TEST 5: Pagination Performance
-- =====================================================

-- Test loading many pages (simulating infinite scroll)
DO $$
DECLARE
  v_start_time timestamp;
  v_total_duration interval := '0 seconds'::interval;
  v_page_duration interval;
  v_result_count INTEGER;
  v_page INTEGER;
  v_offset INTEGER;
  v_page_size INTEGER := 20;
  v_total_pages INTEGER := 20;
BEGIN
  RAISE NOTICE '🧪 TEST 5: Pagination Performance (% pages)', v_total_pages;
  
  FOR v_page IN 1..v_total_pages LOOP
    v_offset := (v_page - 1) * v_page_size;
    v_start_time := clock_timestamp();
    
    SELECT COUNT(*) INTO v_result_count
    FROM search_all(
      p_user := NULL,
      p_q := 'event',
      p_limit := v_page_size,
      p_offset := v_offset
    );
    
    v_page_duration := clock_timestamp() - v_start_time;
    v_total_duration := v_total_duration + v_page_duration;
    
    IF v_page % 5 = 0 THEN
      RAISE NOTICE '  Page %: % ms (offset %)', 
        v_page,
        EXTRACT(EPOCH FROM v_page_duration) * 1000,
        v_offset;
    END IF;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Average per page: % ms', 
    EXTRACT(EPOCH FROM v_total_duration) * 1000 / v_total_pages;
  RAISE NOTICE 'Target: < 500ms per page';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- TEST 6: Complex Search Ranking
-- =====================================================

-- Test that ranking algorithm works correctly
SELECT 
  title,
  category,
  city,
  ts_rank(
    to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(description, '')),
    plainto_tsquery('simple', 'music festival')
  ) as rank_score
FROM events
WHERE title LIKE '%music%' OR title LIKE '%festival%'
ORDER BY rank_score DESC
LIMIT 10;

-- =====================================================
-- TEST 7: Empty/Broad Search Performance
-- =====================================================

-- Test searching with no filters (browse all events)
DO $$
DECLARE
  v_start_time timestamp;
  v_end_time timestamp;
  v_duration interval;
  v_result_count INTEGER;
BEGIN
  RAISE NOTICE '🧪 TEST 7: Broad Search (no filters)';
  
  v_start_time := clock_timestamp();
  
  SELECT COUNT(*) INTO v_result_count
  FROM search_all(
    p_user := NULL,
    p_q := NULL,
    p_limit := 50,
    p_offset := 0
  );
  
  v_end_time := clock_timestamp();
  v_duration := v_end_time - v_start_time;
  
  RAISE NOTICE 'Found % results in %', v_result_count, v_duration;
  RAISE NOTICE 'Query time: % ms (Target: < 500ms)', 
    EXTRACT(EPOCH FROM v_duration) * 1000;
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check event distribution by category
SELECT 
  category,
  COUNT(*) as event_count
FROM events
WHERE created_at > now() - interval '1 hour'
GROUP BY category
ORDER BY event_count DESC;

-- Check event distribution by location
SELECT 
  city,
  country,
  COUNT(*) as event_count
FROM events
WHERE created_at > now() - interval '1 hour'
GROUP BY city, country
ORDER BY event_count DESC
LIMIT 10;

-- Check if indexes are being used
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as "Times Used",
  idx_tup_read as "Tuples Read",
  idx_tup_fetch as "Tuples Fetched"
FROM pg_stat_user_indexes
WHERE tablename = 'events'
ORDER BY idx_scan DESC;

-- Check slow queries (if pg_stat_statements is enabled)
-- SELECT 
--   query,
--   calls,
--   mean_exec_time,
--   max_exec_time
-- FROM pg_stat_statements
-- WHERE query LIKE '%search_all%'
-- ORDER BY mean_exec_time DESC
-- LIMIT 5;

-- =====================================================
-- INDEX OPTIMIZATION SUGGESTIONS
-- =====================================================

-- Check if full-text search index exists
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'events' 
AND indexdef LIKE '%to_tsvector%';

-- If not, create it:
-- CREATE INDEX IF NOT EXISTS events_search_idx 
-- ON events USING gin(to_tsvector('simple', title || ' ' || COALESCE(description, '')));

-- Check geographic index (if using PostGIS)
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'events' 
AND indexdef LIKE '%gist%';

-- =====================================================
-- CLEANUP
-- =====================================================

-- Uncomment to clean up test data
-- DELETE FROM events WHERE title LIKE '%Music Festival%' OR title LIKE '%Concert Series%' OR title LIKE '%Special Event%';

-- =====================================================
-- FINAL SUMMARY
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ All search load tests complete!';
  RAISE NOTICE 'Review results above and check for:';
  RAISE NOTICE '  1. Simple search < 500ms';
  RAISE NOTICE '  2. Multi-filter search < 1000ms';
  RAISE NOTICE '  3. Location search < 800ms';
  RAISE NOTICE '  4. Category filter < 300ms';
  RAISE NOTICE '  5. Pagination < 500ms per page';
  RAISE NOTICE '  6. Ranking works correctly';
  RAISE NOTICE '========================================';
END $$;

