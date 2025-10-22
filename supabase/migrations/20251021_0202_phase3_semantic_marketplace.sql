-- =====================================================
-- PHASE 3: SEMANTIC MARKETPLACE & SEARCH
-- =====================================================
-- This migration creates semantic search capabilities and marketplace views
-- for intelligent sponsor-event discovery

-- =====================================================
-- 1. SEMANTIC MARKETPLACE VIEWS
-- =====================================================

-- Comprehensive marketplace view for sponsors
CREATE OR REPLACE VIEW public.v_sponsor_marketplace AS
SELECT
  s.id AS sponsor_id,
  s.name AS sponsor_name,
  s.logo_url,
  s.website_url,
  sp.industry,
  sp.annual_budget_cents,
  sp.brand_objectives,
  sp.target_audience,
  sp.preferred_categories,
  sp.regions,
  sp.activation_preferences,
  -- Aggregated metrics
  COUNT(DISTINCT sm.event_id) AS matched_events_count,
  AVG(sm.score) AS avg_match_score,
  MAX(sm.score) AS best_match_score,
  COUNT(DISTINCT CASE WHEN sm.score > 0.8 THEN sm.event_id END) AS high_quality_matches,
  -- Recent activity
  MAX(sm.updated_at) AS last_match_update,
  -- Quality indicators
  CASE 
    WHEN sp.annual_budget_cents >= 1000000 THEN 'enterprise'
    WHEN sp.annual_budget_cents >= 100000 THEN 'mid-market'
    WHEN sp.annual_budget_cents >= 10000 THEN 'small-business'
    ELSE 'unknown'
  END AS budget_tier
FROM public.sponsors s
JOIN public.sponsor_profiles sp ON sp.sponsor_id = s.id
LEFT JOIN public.sponsorship_matches sm ON sm.sponsor_id = s.id
GROUP BY s.id, s.name, s.logo_url, s.website_url, sp.industry, 
         sp.annual_budget_cents, sp.brand_objectives, sp.target_audience,
         sp.preferred_categories, sp.regions, sp.activation_preferences;

-- Comprehensive marketplace view for events
CREATE OR REPLACE VIEW public.v_event_marketplace AS
SELECT
  e.id AS event_id,
  e.title AS event_title,
  e.description,
  e.category,
  e.start_at,
  e.city,
  e.country,
  e.cover_image_url,
  -- Performance metrics
  eqs.final_quality_score,
  eqs.quality_tier,
  eqs.total_views,
  eqs.avg_dwell_ms,
  eqs.tickets_sold,
  eqs.conversion_rate,
  eqs.engagement_rate,
  eqs.social_mentions,
  eqs.sentiment_score,
  -- Sponsor metrics
  COUNT(DISTINCT sm.sponsor_id) AS matched_sponsors_count,
  AVG(sm.score) AS avg_sponsor_match_score,
  MAX(sm.score) AS best_sponsor_match_score,
  COUNT(DISTINCT CASE WHEN sm.score > 0.8 THEN sm.sponsor_id END) AS high_quality_sponsors,
  -- Sponsorship packages
  COUNT(DISTINCT sp.id) AS available_packages,
  MIN(sp.price_cents) AS min_package_price,
  MAX(sp.price_cents) AS max_package_price,
  AVG(sp.price_cents) AS avg_package_price,
  -- Recent activity
  MAX(sm.updated_at) AS last_match_update
FROM public.events e
LEFT JOIN public.mv_event_quality_scores eqs ON eqs.event_id = e.id
LEFT JOIN public.sponsorship_matches sm ON sm.event_id = e.id
LEFT JOIN public.sponsorship_packages sp ON sp.event_id = e.id AND sp.is_active = true
GROUP BY e.id, e.title, e.description, e.category, e.start_at, e.city, e.country, e.cover_image_url,
         eqs.final_quality_score, eqs.quality_tier, eqs.total_views, eqs.avg_dwell_ms,
         eqs.tickets_sold, eqs.conversion_rate, eqs.engagement_rate, eqs.social_mentions, eqs.sentiment_score;

-- =====================================================
-- 2. SEMANTIC SEARCH FUNCTIONS
-- =====================================================

-- Function for semantic sponsor search
CREATE OR REPLACE FUNCTION public.semantic_sponsor_search(
  p_query_text text,
  p_industry text DEFAULT NULL,
  p_budget_min integer DEFAULT NULL,
  p_budget_max integer DEFAULT NULL,
  p_regions text[] DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  sponsor_id uuid,
  sponsor_name text,
  industry text,
  annual_budget_cents integer,
  match_score numeric,
  relevance_score numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_embedding vector(1536);
BEGIN
  -- In a real implementation, you would generate embeddings from p_query_text
  -- For now, we'll use a placeholder
  query_embedding := NULL;
  
  RETURN QUERY
  SELECT
    s.id AS sponsor_id,
    s.name AS sponsor_name,
    sp.industry,
    sp.annual_budget_cents,
    -- Placeholder for semantic similarity
    CASE 
      WHEN p_query_text ILIKE '%' || sp.industry || '%' THEN 0.8
      WHEN p_query_text ILIKE '%' || s.name || '%' THEN 0.9
      ELSE 0.5
    END AS match_score,
    -- Relevance score combining multiple factors
    (
      CASE 
        WHEN p_query_text ILIKE '%' || sp.industry || '%' THEN 0.8
        WHEN p_query_text ILIKE '%' || s.name || '%' THEN 0.9
        ELSE 0.5
      END * 0.4 +
      CASE 
        WHEN sp.annual_budget_cents >= COALESCE(p_budget_min, 0) 
         AND sp.annual_budget_cents <= COALESCE(p_budget_max, 999999999) THEN 1.0
        ELSE 0.3
      END * 0.3 +
      CASE 
        WHEN p_regions IS NULL OR sp.regions && p_regions THEN 1.0
        ELSE 0.5
      END * 0.3
    ) AS relevance_score
  FROM public.sponsors s
  JOIN public.sponsor_profiles sp ON sp.sponsor_id = s.id
  WHERE (p_industry IS NULL OR sp.industry = p_industry)
  AND (p_budget_min IS NULL OR sp.annual_budget_cents >= p_budget_min)
  AND (p_budget_max IS NULL OR sp.annual_budget_cents <= p_budget_max)
  AND (p_regions IS NULL OR sp.regions && p_regions)
  ORDER BY relevance_score DESC, match_score DESC
  LIMIT p_limit;
END $$;

-- Function for semantic event search
CREATE OR REPLACE FUNCTION public.semantic_event_search(
  p_query_text text,
  p_category text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_quality_tier text DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  event_id uuid,
  event_title text,
  category text,
  start_at timestamp with time zone,
  city text,
  quality_score numeric,
  match_score numeric,
  relevance_score numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_embedding vector(1536);
BEGIN
  -- In a real implementation, you would generate embeddings from p_query_text
  -- For now, we'll use a placeholder
  query_embedding := NULL;
  
  RETURN QUERY
  SELECT
    e.id AS event_id,
    e.title AS event_title,
    e.category,
    e.start_at,
    e.city,
    COALESCE(eqs.final_quality_score, 0.5) AS quality_score,
    -- Placeholder for semantic similarity
    CASE 
      WHEN p_query_text ILIKE '%' || e.category || '%' THEN 0.8
      WHEN p_query_text ILIKE '%' || e.title || '%' THEN 0.9
      WHEN p_query_text ILIKE '%' || e.description || '%' THEN 0.7
      ELSE 0.5
    END AS match_score,
    -- Relevance score combining multiple factors
    (
      CASE 
        WHEN p_query_text ILIKE '%' || e.category || '%' THEN 0.8
        WHEN p_query_text ILIKE '%' || e.title || '%' THEN 0.9
        WHEN p_query_text ILIKE '%' || e.description || '%' THEN 0.7
        ELSE 0.5
      END * 0.4 +
      COALESCE(eqs.final_quality_score, 0.5) * 0.3 +
      CASE 
        WHEN p_city IS NULL OR e.city ILIKE '%' || p_city || '%' THEN 1.0
        ELSE 0.5
      END * 0.3
    ) AS relevance_score
  FROM public.events e
  LEFT JOIN public.mv_event_quality_scores eqs ON eqs.event_id = e.id
  WHERE (p_category IS NULL OR e.category = p_category)
  AND (p_city IS NULL OR e.city ILIKE '%' || p_city || '%')
  AND (p_start_date IS NULL OR e.start_at::date >= p_start_date)
  AND (p_end_date IS NULL OR e.start_at::date <= p_end_date)
  AND (p_quality_tier IS NULL OR eqs.quality_tier = p_quality_tier)
  ORDER BY relevance_score DESC, match_score DESC, eqs.final_quality_score DESC
  LIMIT p_limit;
END $$;

-- =====================================================
-- 3. RECOMMENDATION FUNCTIONS
-- =====================================================

-- Function to get personalized sponsor recommendations
CREATE OR REPLACE FUNCTION public.get_sponsor_recommendations(
  p_event_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  sponsor_id uuid,
  sponsor_name text,
  industry text,
  match_score numeric,
  budget_fit numeric,
  audience_alignment numeric,
  quality_indicators jsonb
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.id AS sponsor_id,
    s.name AS sponsor_name,
    sp.industry,
    sm.score AS match_score,
    (sm.overlap_metrics->>'budget_fit')::numeric AS budget_fit,
    (sm.overlap_metrics->>'audience_overlap')::numeric AS audience_alignment,
    jsonb_build_object(
      'annual_budget_cents', sp.annual_budget_cents,
      'preferred_categories', sp.preferred_categories,
      'regions', sp.regions,
      'engagement_quality', (sm.overlap_metrics->>'engagement_quality')::numeric,
      'temporal_fit', (sm.overlap_metrics->>'temporal_fit')::numeric
    ) AS quality_indicators
  FROM public.sponsorship_matches sm
  JOIN public.sponsors s ON s.id = sm.sponsor_id
  JOIN public.sponsor_profiles sp ON sp.sponsor_id = s.id
  WHERE sm.event_id = p_event_id
  AND sm.score > 0.5
  ORDER BY sm.score DESC
  LIMIT p_limit;
$$;

-- Function to get personalized event recommendations
CREATE OR REPLACE FUNCTION public.get_event_recommendations(
  p_sponsor_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  event_id uuid,
  event_title text,
  category text,
  start_at timestamp with time zone,
  match_score numeric,
  quality_score numeric,
  engagement_metrics jsonb
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    e.id AS event_id,
    e.title AS event_title,
    e.category,
    e.start_at,
    sm.score AS match_score,
    eqs.final_quality_score AS quality_score,
    jsonb_build_object(
      'total_views', eqs.total_views,
      'tickets_sold', eqs.tickets_sold,
      'conversion_rate', eqs.conversion_rate,
      'engagement_rate', eqs.engagement_rate,
      'social_mentions', eqs.social_mentions,
      'quality_tier', eqs.quality_tier
    ) AS engagement_metrics
  FROM public.sponsorship_matches sm
  JOIN public.events e ON e.id = sm.event_id
  LEFT JOIN public.mv_event_quality_scores eqs ON eqs.event_id = e.id
  WHERE sm.sponsor_id = p_sponsor_id
  AND sm.score > 0.5
  ORDER BY sm.score DESC, eqs.final_quality_score DESC
  LIMIT p_limit;
$$;

-- =====================================================
-- 4. MARKETPLACE ANALYTICS
-- =====================================================

-- View for marketplace analytics
CREATE OR REPLACE VIEW public.v_marketplace_analytics AS
SELECT
  'sponsors' AS entity_type,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE budget_tier = 'enterprise') AS enterprise_count,
  COUNT(*) FILTER (WHERE budget_tier = 'mid-market') AS mid_market_count,
  COUNT(*) FILTER (WHERE budget_tier = 'small-business') AS small_business_count,
  AVG(avg_match_score) AS avg_match_score,
  COUNT(*) FILTER (WHERE high_quality_matches > 0) AS active_sponsors
FROM public.v_sponsor_marketplace

UNION ALL

SELECT
  'events' AS entity_type,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE quality_tier = 'premium') AS premium_count,
  COUNT(*) FILTER (WHERE quality_tier = 'high') AS high_count,
  COUNT(*) FILTER (WHERE quality_tier = 'medium') AS medium_count,
  AVG(avg_sponsor_match_score) AS avg_match_score,
  COUNT(*) FILTER (WHERE high_quality_sponsors > 0) AS active_events
FROM public.v_event_marketplace;

-- =====================================================
-- 5. SCHEDULE MARKETPLACE REFRESH
-- =====================================================

-- Function to refresh semantic marketplace
CREATE OR REPLACE FUNCTION public.refresh_semantic_marketplace()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Refresh materialized views
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_event_quality_scores;
  
  -- Log the refresh
  INSERT INTO public.mv_refresh_log (ran_at, concurrent, note)
  VALUES (now(), true, 'Refreshed semantic marketplace');
  
  RAISE NOTICE 'Semantic marketplace refreshed successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error refreshing semantic marketplace: %', SQLERRM;
END $$;

-- Schedule marketplace refresh
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'refresh-semantic-marketplace',
      '0 * * * *', -- Every hour
      'SELECT public.refresh_semantic_marketplace();'
    );
    
    RAISE NOTICE 'Scheduled semantic marketplace refresh';
  ELSE
    RAISE NOTICE 'pg_cron extension not available - manual marketplace refresh required';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule marketplace refresh: %', SQLERRM;
END $$;

-- =====================================================
-- 6. COMMENTS
-- =====================================================

COMMENT ON VIEW public.v_sponsor_marketplace IS 'Comprehensive marketplace view for sponsors with aggregated metrics';
COMMENT ON VIEW public.v_event_marketplace IS 'Comprehensive marketplace view for events with performance metrics';
COMMENT ON FUNCTION public.semantic_sponsor_search(text, text, integer, integer, text[], integer) IS 'Semantic search for sponsors with filtering capabilities';
COMMENT ON FUNCTION public.semantic_event_search(text, text, text, date, date, text, integer) IS 'Semantic search for events with filtering capabilities';
COMMENT ON FUNCTION public.get_sponsor_recommendations(uuid, integer) IS 'Get personalized sponsor recommendations for an event';
COMMENT ON FUNCTION public.get_event_recommendations(uuid, integer) IS 'Get personalized event recommendations for a sponsor';
COMMENT ON VIEW public.v_marketplace_analytics IS 'Analytics dashboard for marketplace metrics';
COMMENT ON FUNCTION public.refresh_semantic_marketplace() IS 'Refreshes all semantic marketplace components';
