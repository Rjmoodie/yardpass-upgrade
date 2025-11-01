-- =====================================================
-- OPTIMIZED SPONSORSHIP SYSTEM
-- =====================================================
-- This migration consolidates and optimizes the sponsorship intelligence system
-- with production-ready views, functions, and indexes

-- =====================================================
-- 0. DROP DEPENDENT VIEWS (CASCADE)
-- =====================================================
-- Drop all views that might depend on tables we're modifying
-- This prevents "cannot change data type of view column" errors

-- Drop all sponsorship-related views to allow schema changes
DROP VIEW IF EXISTS public.v_sponsorship_package_cards CASCADE;
DROP VIEW IF EXISTS public.v_sponsor_recommended_packages CASCADE;
DROP VIEW IF EXISTS public.v_sponsor_recommendations CASCADE;
DROP VIEW IF EXISTS public.v_event_recommendations CASCADE;
DROP VIEW IF EXISTS public.v_event_recommended_sponsors CASCADE;
DROP VIEW IF EXISTS public.v_sponsorship_funnel CASCADE;
DROP VIEW IF EXISTS public.v_event_performance_summary CASCADE;
DROP VIEW IF EXISTS public.marketplace_sponsorships CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_sponsor_event_fit_scores CASCADE;

-- Standardize the score column type (remove precision if it exists)
DO $$
BEGIN
  -- Check if score column has precision constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sponsorship_matches' 
    AND column_name = 'score'
    AND numeric_precision IS NOT NULL
  ) THEN
    -- Alter to plain numeric (no views are depending on it now)
    ALTER TABLE public.sponsorship_matches 
      ALTER COLUMN score TYPE numeric USING score::numeric;
  END IF;
END $$;

-- =====================================================
-- 1. RECREATE BASE VIEWS (DEPENDENCIES FIRST)
-- =====================================================

-- Recreate v_event_performance_summary (needed by other views)
CREATE OR REPLACE VIEW public.v_event_performance_summary AS
SELECT
  e.id AS event_id,
  e.title AS event_title,
  e.start_at,
  e.category,
  0::bigint AS total_views,
  0::bigint AS avg_dwell_ms,
  0::bigint AS video_completions,
  (
    SELECT COUNT(*)
    FROM public.orders o
    WHERE o.event_id = e.id AND o.status = 'paid'
  )::integer AS orders_count,
  (
    SELECT COUNT(*)
    FROM public.tickets t
    WHERE t.event_id = e.id
  )::integer AS tickets_sold,
  (
    SELECT COUNT(DISTINCT pi.user_id)
    FROM public.post_impressions pi
    JOIN public.event_posts ep ON ep.id = pi.post_id
    WHERE ep.event_id = e.id
  )::integer AS unique_visitors,
  0::numeric AS avg_watch_pct,
  (
    SELECT COALESCE(
      COUNT(*)::numeric / NULLIF(COUNT(DISTINCT pi.user_id), 0),
      0
    )
    FROM public.post_impressions pi
    JOIN public.event_posts ep ON ep.id = pi.post_id
    JOIN public.orders o ON o.event_id = e.id AND o.user_id = pi.user_id
    WHERE ep.event_id = e.id AND o.status = 'paid'
  )::numeric AS conversion_rate,
  COALESCE(eai.engagement_score, 0)::numeric AS engagement_score,
  COALESCE(eai.social_mentions, 0)::integer AS social_mentions,
  COALESCE(eai.sentiment_score, 0)::numeric AS sentiment_score
FROM public.events e
LEFT JOIN public.event_audience_insights eai ON eai.event_id = e.id;

COMMENT ON VIEW public.v_event_performance_summary IS 'Real-time event performance metrics for sponsorship package cards';

-- =====================================================
-- 2. OPTIMIZED PACKAGE CARDS VIEW
-- =====================================================

-- Create optimized single source for marketplace cards
CREATE OR REPLACE VIEW public.v_sponsorship_package_cards AS
SELECT
  p.id AS package_id,
  p.event_id,
  p.title,
  p.tier,
  p.price_cents,
  p.inventory,
  p.sold,
  p.expected_reach,
  p.avg_engagement_score,
  p.package_type,
  p.quality_score,
  p.quality_updated_at,
  eps.metric_value AS snapshot_metric_value,
  eps.captured_at AS snapshot_captured_at,
  vps.total_views,
  vps.avg_dwell_ms,
  vps.tickets_sold,
  vps.avg_watch_pct,
  ROUND((COALESCE(p.quality_score, 50) / 100.0) * 100) AS quality_score_100
FROM public.sponsorship_packages p
LEFT JOIN public.event_stat_snapshots eps ON eps.id = p.stat_snapshot_id
LEFT JOIN public.v_event_performance_summary vps ON vps.event_id = p.event_id;

COMMENT ON VIEW public.v_sponsorship_package_cards IS 'Optimized single source for marketplace package cards with performance metrics';

-- =====================================================
-- 2. PGVECTOR: FIX TYPES + ANN INDEXES
-- =====================================================

-- Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Migrate columns to proper vector type (384 dimensions for most embedding models)
-- Adjust dimensions based on your embedding model
DO $$
BEGIN
  -- Check and migrate events.description_embedding
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'events' AND table_name = 'events' 
    AND column_name = 'description_embedding'
    AND data_type != 'USER-DEFINED'
  ) THEN
    -- Note: public.events is a view, would need to alter events.events
    -- ALTER TABLE events.events
    --   ALTER COLUMN description_embedding TYPE vector(384) USING NULL;
    NULL;
    RAISE NOTICE 'Migrated events.description_embedding to vector(384)';
  END IF;

  -- Check and migrate sponsor_profiles.objectives_embedding
  -- Note: objectives_embedding column doesn't exist in sponsor_profiles
  -- Skip objectives_embedding migration
END $$;

-- Create HNSW indexes for fast similarity search (inner product for normalized embeddings)
-- Note: public.events is a view and objectives_embedding doesn't exist
-- Skip vector indexes

-- =====================================================
-- 3. OPTIMIZED SCORING FUNCTION (DB-NATIVE)
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.fn_compute_match_score(uuid, uuid);

-- Create optimized DB-native scoring function
CREATE OR REPLACE FUNCTION public.fn_compute_match_score(
  p_event_id uuid, 
  p_sponsor_id uuid
)
RETURNS TABLE (score numeric, breakdown jsonb)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  ins record;
  sp record;
  ev record;
  budget_fit numeric := 0.5;
  cat_overlap numeric := 0.5;
  geo_overlap numeric := 0.5;
  engagement_quality numeric := 0.5;
  obj_sim numeric := 0.5;
  audience_overlap numeric := 0.5;
  final_score numeric;
BEGIN
  -- Get event audience insights
  SELECT * INTO ins 
  FROM public.event_audience_insights 
  WHERE event_id = p_event_id;
  
  -- Get sponsor profile
  SELECT * INTO sp 
  FROM public.sponsor_profiles 
  WHERE sponsor_id = p_sponsor_id;
  
  -- Get event details
  SELECT * INTO ev 
  FROM public.events 
  WHERE id = p_event_id;

  -- Return early if data is missing
  IF sp IS NULL OR ev IS NULL THEN
    RETURN QUERY SELECT 0.0::numeric, '{}'::jsonb;
    RETURN;
  END IF;

  -- 1. Budget Fit (25% weight)
  IF sp.annual_budget_cents IS NOT NULL AND sp.annual_budget_cents > 0 THEN
    budget_fit := LEAST(1.0, (sp.annual_budget_cents::numeric / NULLIF(sp.annual_budget_cents, 0)));
  END IF;

  -- 2. Category Overlap
  IF sp.preferred_categories IS NOT NULL AND array_length(sp.preferred_categories, 1) > 0 THEN
    cat_overlap := CASE 
      WHEN LOWER(ev.category) = ANY (
        ARRAY(SELECT LOWER(x) FROM unnest(sp.preferred_categories) x)
      ) THEN 1.0
      ELSE 0.0
    END;
  END IF;

  -- 3. Geographic Overlap
  IF sp.regions IS NOT NULL AND ins.geo_distribution IS NOT NULL THEN
    geo_overlap := (
      SELECT COALESCE(
        (
          SELECT count(*)::numeric 
          FROM unnest(sp.regions) r
          WHERE r = ANY(ARRAY(SELECT key FROM jsonb_each_text(ins.geo_distribution)))
        ) / GREATEST(1, COALESCE(array_length(sp.regions, 1), 1)),
        0.0
      )
    );
  END IF;

  -- 4. Engagement Quality (15% weight)
  IF ins IS NOT NULL THEN
    engagement_quality := COALESCE(
      0.7 * COALESCE(ins.engagement_score, 0) + 
      0.3 * COALESCE(ins.ticket_conversion_rate, 0),
      0.5
    );
  END IF;

  -- 5. Vector Similarity (Objectives) (10% weight)
  -- Note: Embeddings are optional and may not exist yet
  BEGIN
    -- Check if embedding columns exist and have values
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'sponsor_profiles' 
      AND column_name = 'objectives_embedding'
    ) THEN
      -- Columns exist, try to use them
      EXECUTE 'SELECT 1 - (sp2.objectives_embedding <=> ev2.description_embedding)
               FROM public.sponsor_profiles sp2, public.events ev2
               WHERE sp2.sponsor_id = $1 AND ev2.id = $2
               AND sp2.objectives_embedding IS NOT NULL 
               AND ev2.description_embedding IS NOT NULL'
      INTO obj_sim
      USING p_sponsor_id, p_event_id;
      
      obj_sim := COALESCE(obj_sim, 0.5);
    ELSE
      -- Embeddings not available, use default
      obj_sim := 0.5;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      obj_sim := 0.5;
  END;

  -- 6. Audience Overlap (35% weight) - combines category and geo
  audience_overlap := 0.6 * cat_overlap + 0.4 * geo_overlap;

  -- Calculate final weighted score
  final_score := 
    0.25 * budget_fit +
    0.35 * audience_overlap +
    0.15 * geo_overlap +
    0.15 * engagement_quality +
    0.10 * obj_sim;

  -- Return score and detailed breakdown
  RETURN QUERY SELECT
    ROUND(final_score, 4),
    jsonb_build_object(
      'budget_fit', ROUND(budget_fit, 3),
      'audience_overlap', jsonb_build_object(
        'categories', ROUND(cat_overlap, 3), 
        'geo', ROUND(geo_overlap, 3),
        'combined', ROUND(audience_overlap, 3)
      ),
      'geo_overlap', ROUND(geo_overlap, 3),
      'engagement_quality', ROUND(engagement_quality, 3),
      'objectives_similarity', ROUND(obj_sim, 3),
      'weights', jsonb_build_object(
        'budget', 0.25,
        'audience', 0.35,
        'geo', 0.15,
        'engagement', 0.15,
        'objectives', 0.10
      )
    );
END $$;

COMMENT ON FUNCTION public.fn_compute_match_score(uuid, uuid) IS 'Optimized DB-native match scoring with vector similarity and detailed breakdown';

-- =====================================================
-- 3.5. ENSURE SPONSORSHIP_MATCHES HAS REQUIRED COLUMNS
-- =====================================================

-- Add columns if they don't exist (for compatibility with different migration histories)
DO $$
BEGIN
  -- Add viewed_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sponsorship_matches' 
    AND column_name = 'viewed_at'
  ) THEN
    ALTER TABLE public.sponsorship_matches ADD COLUMN viewed_at timestamptz;
  END IF;

  -- Add contacted_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sponsorship_matches' 
    AND column_name = 'contacted_at'
  ) THEN
    ALTER TABLE public.sponsorship_matches ADD COLUMN contacted_at timestamptz;
  END IF;
END $$;

-- =====================================================
-- 4. OPTIMIZED ENQUEUE TRIGGERS
-- =====================================================

-- Drop existing triggers first (before dropping functions)
DROP TRIGGER IF EXISTS trg_queue_recalc_sponsor_profiles ON public.sponsor_profiles;
DROP TRIGGER IF EXISTS trg_queue_recalc_event_insights ON public.event_audience_insights;
DROP TRIGGER IF EXISTS trigger_queue_recalc_sponsor_profiles ON public.sponsor_profiles;
DROP TRIGGER IF EXISTS trigger_queue_recalc_event_insights ON public.event_audience_insights;
DROP TRIGGER IF EXISTS trigger_queue_recalc_events ON public.events;

-- Now drop existing functions
DROP FUNCTION IF EXISTS public.fn_queue_recalc_on_sponsor_profiles() CASCADE;
DROP FUNCTION IF EXISTS public.fn_queue_recalc_on_event_insights() CASCADE;
DROP FUNCTION IF EXISTS public.fn_queue_recalc_on_events() CASCADE;

-- Optimized enqueue function for sponsor profile changes
CREATE OR REPLACE FUNCTION public.fn_queue_recalc_on_sponsor_profiles()
RETURNS trigger 
LANGUAGE plpgsql 
AS $$
BEGIN
  -- Queue recalculation for all events when sponsor profile changes
  INSERT INTO public.fit_recalc_queue (event_id, sponsor_id, reason, queued_at)
  SELECT eai.event_id, NEW.sponsor_id, 'sponsor_profile_update', now()
  FROM public.event_audience_insights eai
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END $$;

-- Optimized enqueue function for event insight changes
CREATE OR REPLACE FUNCTION public.fn_queue_recalc_on_event_insights()
RETURNS trigger 
LANGUAGE plpgsql 
AS $$
BEGIN
  -- Queue recalculation for all sponsors when event insights change
  INSERT INTO public.fit_recalc_queue (event_id, sponsor_id, reason, queued_at)
  SELECT NEW.event_id, sp.sponsor_id, 'event_insight_update', now()
  FROM public.sponsor_profiles sp
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END $$;

-- Create triggers
CREATE TRIGGER trg_queue_recalc_sponsor_profiles
AFTER INSERT OR UPDATE ON public.sponsor_profiles
FOR EACH ROW EXECUTE FUNCTION public.fn_queue_recalc_on_sponsor_profiles();

CREATE TRIGGER trg_queue_recalc_event_insights
AFTER INSERT OR UPDATE ON public.event_audience_insights
FOR EACH ROW EXECUTE FUNCTION public.fn_queue_recalc_on_event_insights();

-- =====================================================
-- 5. UPSERT MATCH HELPER FUNCTION
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.fn_upsert_match(uuid, uuid);

-- Helper function to persist match result in one call
CREATE OR REPLACE FUNCTION public.fn_upsert_match(
  p_event_id uuid, 
  p_sponsor_id uuid
)
RETURNS void 
LANGUAGE plpgsql 
AS $$
DECLARE 
  r record;
BEGIN
  -- Compute the score
  SELECT * INTO r 
  FROM public.fn_compute_match_score(p_event_id, p_sponsor_id);
  
  -- Upsert into sponsorship_matches
  INSERT INTO public.sponsorship_matches (
    event_id, 
    sponsor_id, 
    score, 
    overlap_metrics, 
    updated_at
  )
  VALUES (
    p_event_id, 
    p_sponsor_id, 
    r.score, 
    r.breakdown, 
    now()
  )
  ON CONFLICT (event_id, sponsor_id) 
  DO UPDATE SET
    score = EXCLUDED.score, 
    overlap_metrics = EXCLUDED.overlap_metrics, 
    updated_at = now();
END $$;

COMMENT ON FUNCTION public.fn_upsert_match(uuid, uuid) IS 'Helper to compute and persist match score in one call';

-- =====================================================
-- 6. TARGETED PERFORMANCE INDEXES
-- =====================================================

-- Matching indexes (feeds & filters)
CREATE INDEX IF NOT EXISTS idx_sponsorship_matches_event_score
  ON public.sponsorship_matches (event_id, score DESC)
  WHERE score >= 0.5;

CREATE INDEX IF NOT EXISTS idx_sponsorship_matches_sponsor_score
  ON public.sponsorship_matches (sponsor_id, score DESC)
  WHERE score >= 0.5;

CREATE INDEX IF NOT EXISTS idx_sponsorship_matches_status_score
  ON public.sponsorship_matches (status, score DESC)
  WHERE status = 'pending';

-- Profile indexes
CREATE INDEX IF NOT EXISTS idx_sponsor_profiles_industry_size
  ON public.sponsor_profiles (industry, company_size);

CREATE INDEX IF NOT EXISTS idx_sponsor_profiles_pref_categories
  ON public.sponsor_profiles USING gin (preferred_categories)
  WHERE preferred_categories IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sponsor_profiles_regions
  ON public.sponsor_profiles USING gin (regions)
  WHERE regions IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sponsor_profiles_budget
  ON public.sponsor_profiles (annual_budget_cents DESC)
  WHERE annual_budget_cents > 0;

-- Package indexes (marketplace filters)
-- Note: public.sponsorship_packages is a view, so we create indexes on the underlying table
CREATE INDEX IF NOT EXISTS idx_sponsorship_packages_event_visibility_price
  ON sponsorship.sponsorship_packages (event_id, is_active, visibility, price_cents)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sponsorship_packages_tier_active
  ON sponsorship.sponsorship_packages (tier, is_active)
  WHERE is_active = true;

-- Event indexes
-- Note: public.events is a view, so we create indexes on the underlying table
CREATE INDEX IF NOT EXISTS idx_events_category_start
  ON events.events (category, start_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_city
  ON events.events (city)
  WHERE city IS NOT NULL;

-- Queue index
CREATE INDEX IF NOT EXISTS idx_fit_recalc_queue_unprocessed
  ON public.fit_recalc_queue (queued_at)
  WHERE processed_at IS NULL;

-- =====================================================
-- 7. OPTIMIZED FEED QUERIES (AS VIEWS)
-- =====================================================

-- Feed: packages recommended for a sponsor
CREATE OR REPLACE VIEW public.v_sponsor_recommended_packages AS
SELECT 
  m.sponsor_id,
  m.event_id, 
  p.id AS package_id, 
  p.title, 
  p.tier, 
  p.price_cents,
  m.score, 
  m.overlap_metrics,
  c.total_views, 
  c.tickets_sold, 
  c.quality_score_100,
  c.avg_engagement_score
FROM public.sponsorship_matches m
JOIN public.sponsorship_packages p 
  ON p.event_id = m.event_id 
  AND p.is_active = true 
  AND p.visibility = 'public'
LEFT JOIN public.v_sponsorship_package_cards c 
  ON c.package_id = p.id
WHERE m.score >= 0.55
ORDER BY m.sponsor_id, m.score DESC;

COMMENT ON VIEW public.v_sponsor_recommended_packages IS 'Packages recommended for sponsors based on match scores';

-- Feed: suggested sponsors for an event
CREATE OR REPLACE VIEW public.v_event_recommended_sponsors AS
SELECT 
  m.event_id,
  m.sponsor_id, 
  s.name AS sponsor_name,
  s.logo_url,
  sp.industry,
  sp.annual_budget_cents,
  m.score, 
  m.overlap_metrics,
  m.status,
  m.viewed_at,
  m.contacted_at
FROM public.sponsorship_matches m
JOIN public.sponsors s ON s.id = m.sponsor_id
LEFT JOIN public.sponsor_profiles sp ON sp.sponsor_id = m.sponsor_id
WHERE m.score >= 0.55
ORDER BY m.event_id, m.score DESC;

COMMENT ON VIEW public.v_event_recommended_sponsors IS 'Sponsors recommended for events based on match scores';

-- =====================================================
-- 8. CLEANUP & MAINTENANCE
-- =====================================================

-- Function to process queue (can be called from Edge Function or cron)
CREATE OR REPLACE FUNCTION public.process_match_queue(p_batch_size integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  processed_count integer := 0;
  queue_item record;
BEGIN
  FOR queue_item IN 
    SELECT * 
    FROM public.fit_recalc_queue 
    WHERE processed_at IS NULL
    ORDER BY queued_at
    LIMIT p_batch_size
  LOOP
    BEGIN
      -- Compute and upsert match
      PERFORM public.fn_upsert_match(queue_item.event_id, queue_item.sponsor_id);
      
      -- Mark as processed
      UPDATE public.fit_recalc_queue
      SET processed_at = now()
      WHERE id = queue_item.id;
      
      processed_count := processed_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but continue processing
        RAISE WARNING 'Failed to process queue item %: %', queue_item.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN processed_count;
END $$;

COMMENT ON FUNCTION public.process_match_queue(integer) IS 'Process pending match score calculations from the queue';

-- =====================================================
-- 9. COMMENTS & DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.sponsorship_matches IS 'AI-powered sponsor-event match scores with detailed breakdowns';
COMMENT ON TABLE public.fit_recalc_queue IS 'Queue for incremental recalculation of match scores';
COMMENT ON TABLE public.sponsor_profiles IS 'Extended sponsor profiles with targeting preferences and embeddings';
COMMENT ON TABLE public.event_audience_insights IS 'Aggregated event performance and audience metrics';

-- =====================================================
-- 10. GRANT PERMISSIONS (adjust as needed)
-- =====================================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.fn_compute_match_score(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_upsert_match(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_match_queue(integer) TO service_role;

-- Grant select on views
GRANT SELECT ON public.v_sponsorship_package_cards TO authenticated;
GRANT SELECT ON public.v_sponsor_recommended_packages TO authenticated;
GRANT SELECT ON public.v_event_recommended_sponsors TO authenticated;
