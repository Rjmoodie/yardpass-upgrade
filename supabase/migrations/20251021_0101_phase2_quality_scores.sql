-- =====================================================
-- PHASE 2: EVENT QUALITY SCORE SYSTEM
-- =====================================================
-- This migration creates a comprehensive event quality scoring system
-- with materialized views for fast analytics

-- =====================================================
-- 1. EVENT QUALITY SCORE VIEW
-- =====================================================

-- Create comprehensive event quality score view
CREATE OR REPLACE VIEW public.v_event_quality_score AS
WITH event_metrics AS (
  SELECT
    e.id AS event_id,
    e.title,
    e.start_at,
    e.category,
    -- Engagement metrics
    COALESCE(ev.views_total, 0)::bigint AS total_views,
    COALESCE(ev.avg_dwell_ms, 0)::bigint AS avg_dwell_ms,
    COALESCE(ev.completions, 0)::bigint AS video_completions,
    COALESCE(ev.likes, 0)::bigint AS likes,
    COALESCE(ev.comments, 0)::bigint AS comments,
    COALESCE(ev.shares, 0)::bigint AS shares,
    
    -- Conversion metrics
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
    
    -- Audience metrics
    (
      SELECT COUNT(DISTINCT pi.user_id)
      FROM public.post_impressions pi
      JOIN public.event_posts ep ON ep.id = pi.post_id
      WHERE ep.event_id = e.id
    )::integer AS unique_visitors,
    
    -- Engagement rate
    CASE 
      WHEN COALESCE(ev.views_total, 0) > 0 THEN 
        (COALESCE(ev.likes, 0) + COALESCE(ev.comments, 0) + COALESCE(ev.shares, 0))::numeric / ev.views_total::numeric
      ELSE 0
    END AS engagement_rate,
    
    -- Conversion rate
    CASE 
      WHEN (
        SELECT COUNT(DISTINCT pi.user_id)
        FROM public.post_impressions pi
        JOIN public.event_posts ep ON ep.id = pi.post_id
        WHERE ep.event_id = e.id
      ) > 0 THEN
        (
          SELECT COUNT(*)
          FROM public.orders o
          WHERE o.event_id = e.id AND o.status = 'paid'
        )::numeric / (
          SELECT COUNT(DISTINCT pi.user_id)
          FROM public.post_impressions pi
          JOIN public.event_posts ep ON ep.id = pi.post_id
          WHERE ep.event_id = e.id
        )::numeric
      ELSE 0
    END AS conversion_rate,
    
    -- Recency score (events closer to now get higher scores)
    CASE 
      WHEN e.start_at > now() THEN 1.0  -- Future events
      WHEN e.start_at > now() - interval '7 days' THEN 0.8  -- Recent events
      WHEN e.start_at > now() - interval '30 days' THEN 0.6  -- Past month
      WHEN e.start_at > now() - interval '90 days' THEN 0.4  -- Past quarter
      ELSE 0.2  -- Older events
    END AS recency_score,
    
    -- Social proof score
    COALESCE(eai.social_mentions, 0)::integer AS social_mentions,
    COALESCE(eai.sentiment_score, 0)::numeric AS sentiment_score,
    
    -- Content quality indicators
    CASE 
      WHEN LENGTH(e.description) > 200 THEN 1.0
      WHEN LENGTH(e.description) > 100 THEN 0.7
      WHEN LENGTH(e.description) > 50 THEN 0.4
      ELSE 0.1
    END AS content_quality_score,
    
    -- Category popularity (simplified)
    CASE e.category
      WHEN 'music' THEN 1.0
      WHEN 'sports' THEN 0.9
      WHEN 'technology' THEN 0.8
      WHEN 'business' THEN 0.7
      WHEN 'education' THEN 0.6
      ELSE 0.5
    END AS category_popularity_score

  FROM public.events e
  LEFT JOIN public.event_video_counters ev ON ev.event_id = e.id
  LEFT JOIN public.event_audience_insights eai ON eai.event_id = e.id
),
quality_calculations AS (
  SELECT
    *,
    -- Weighted quality score calculation
    (
      -- Engagement weight: 30%
      (engagement_rate * 0.3) +
      -- Conversion weight: 25%
      (conversion_rate * 0.25) +
      -- Recency weight: 20%
      (recency_score * 0.2) +
      -- Content quality weight: 15%
      (content_quality_score * 0.15) +
      -- Category popularity weight: 10%
      (category_popularity_score * 0.1)
    ) AS calculated_quality_score,
    
    -- Volume score (events with more activity get higher scores)
    LEAST(1.0, (total_views / 1000.0)) AS volume_score,
    
    -- Social proof score
    LEAST(1.0, (social_mentions / 100.0)) AS social_proof_score,
    
    -- Sentiment score (normalized)
    (sentiment_score + 1.0) / 2.0 AS normalized_sentiment_score

  FROM event_metrics
)
SELECT
  event_id,
  title,
  start_at,
  category,
  total_views,
  avg_dwell_ms,
  video_completions,
  likes,
  comments,
  shares,
  orders_count,
  tickets_sold,
  unique_visitors,
  engagement_rate,
  conversion_rate,
  recency_score,
  social_mentions,
  sentiment_score,
  content_quality_score,
  category_popularity_score,
  calculated_quality_score,
  volume_score,
  social_proof_score,
  normalized_sentiment_score,
  
  -- Final composite quality score
  (
    (calculated_quality_score * 0.4) +
    (volume_score * 0.3) +
    (social_proof_score * 0.2) +
    (normalized_sentiment_score * 0.1)
  ) AS final_quality_score,
  
  -- Quality tier classification
  CASE 
    WHEN (
      (calculated_quality_score * 0.4) +
      (volume_score * 0.3) +
      (social_proof_score * 0.2) +
      (normalized_sentiment_score * 0.1)
    ) >= 0.8 THEN 'premium'
    WHEN (
      (calculated_quality_score * 0.4) +
      (volume_score * 0.3) +
      (social_proof_score * 0.2) +
      (normalized_sentiment_score * 0.1)
    ) >= 0.6 THEN 'high'
    WHEN (
      (calculated_quality_score * 0.4) +
      (volume_score * 0.3) +
      (social_proof_score * 0.2) +
      (normalized_sentiment_score * 0.1)
    ) >= 0.4 THEN 'medium'
    ELSE 'low'
  END AS quality_tier,
  
  now() AS calculated_at

FROM quality_calculations;

-- =====================================================
-- 2. MATERIALIZED VIEW FOR PERFORMANCE
-- =====================================================

-- Create materialized view for fast access
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_event_quality_scores AS
SELECT * FROM public.v_event_quality_score;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_event_quality_scores_event_id 
ON public.mv_event_quality_scores (event_id);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_mv_event_quality_scores_quality_tier 
ON public.mv_event_quality_scores (quality_tier);

CREATE INDEX IF NOT EXISTS idx_mv_event_quality_scores_final_score 
ON public.mv_event_quality_scores (final_quality_score DESC);

CREATE INDEX IF NOT EXISTS idx_mv_event_quality_scores_category 
ON public.mv_event_quality_scores (category);

-- =====================================================
-- 3. REFRESH FUNCTION
-- =====================================================

-- Function to refresh quality scores
CREATE OR REPLACE FUNCTION public.refresh_event_quality_scores()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_event_quality_scores;
  
  -- Log the refresh
  INSERT INTO public.mv_refresh_log (ran_at, concurrent, note)
  VALUES (now(), true, 'Refreshed event quality scores');
  
  RAISE NOTICE 'Event quality scores refreshed successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error refreshing event quality scores: %', SQLERRM;
END $$;

-- =====================================================
-- 4. UPDATE SPONSORSHIP PACKAGE CARDS VIEW
-- =====================================================

-- Drop the existing view to allow column changes
DROP VIEW IF EXISTS public.v_sponsorship_package_cards CASCADE;

-- Update the sponsorship package cards view to include quality scores
CREATE VIEW public.v_sponsorship_package_cards AS
SELECT
  sp.id,
  sp.event_id,
  sp.tier,
  sp.price_cents,
  sp.title,
  sp.description,
  sp.benefits,
  sp.inventory,
  sp.sold,
  sp.is_active,
  e.title AS event_title,
  e.start_at,
  e.category,
  COALESCE(eps.total_views, 0)::bigint AS total_views,
  COALESCE(eps.avg_dwell_ms, 0)::bigint AS avg_dwell_ms,
  COALESCE(eps.tickets_sold, 0)::integer AS tickets_sold,
  COALESCE(eps.conversion_rate, 0)::numeric AS conversion_rate,
  COALESCE(eps.engagement_score, 0)::numeric AS engagement_score,
  COALESCE(eps.social_mentions, 0)::integer AS social_mentions,
  COALESCE(eps.sentiment_score, 0)::numeric AS sentiment_score,
  -- Add quality score data
  COALESCE(eqs.final_quality_score, 0)::numeric AS final_quality_score,
  COALESCE(eqs.quality_tier, 'low') AS quality_tier,
  COALESCE(eqs.engagement_rate, 0)::numeric AS engagement_rate,
  COALESCE(eqs.volume_score, 0)::numeric AS volume_score,
  COALESCE(eqs.social_proof_score, 0)::numeric AS social_proof_score,
  COALESCE(eqs.normalized_sentiment_score, 0)::numeric AS normalized_sentiment_score
FROM public.sponsorship_packages sp
JOIN public.events e ON e.id = sp.event_id
LEFT JOIN public.v_event_performance_summary eps ON eps.event_id = sp.event_id
LEFT JOIN public.mv_event_quality_scores eqs ON eqs.event_id = sp.event_id;

-- =====================================================
-- 5. SCHEDULE REFRESH
-- =====================================================

-- Schedule automatic refresh of quality scores
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'refresh-event-quality-scores',
      '0 3 * * *', -- Run daily at 3 AM
      'SELECT public.refresh_event_quality_scores();'
    );
    
    RAISE NOTICE 'Scheduled automatic quality score refresh';
  ELSE
    RAISE NOTICE 'pg_cron extension not available - manual refresh required';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule quality score refresh: %', SQLERRM;
END $$;

-- =====================================================
-- 6. COMMENTS
-- =====================================================

COMMENT ON VIEW public.v_event_quality_score IS 'Comprehensive event quality scoring with multiple metrics';
COMMENT ON MATERIALIZED VIEW public.mv_event_quality_scores IS 'Materialized view for fast event quality score lookups';
COMMENT ON FUNCTION public.refresh_event_quality_scores() IS 'Refreshes the materialized view of event quality scores';
