-- =====================================================
-- HOTFIX: Fix fn_compute_match_score to handle missing embeddings
-- =====================================================

-- Drop and recreate the function with embedding checks
DROP FUNCTION IF EXISTS public.fn_compute_match_score(uuid, uuid);

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
  -- Skip embeddings for now - they're optional and not yet implemented
  obj_sim := 0.5;

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

COMMENT ON FUNCTION public.fn_compute_match_score(uuid, uuid) IS 'Optimized DB-native match scoring (embeddings optional)';

