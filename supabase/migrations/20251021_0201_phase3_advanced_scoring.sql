-- =====================================================
-- PHASE 3: ADVANCED SCORING & TRIGGER SYSTEM
-- =====================================================
-- This migration creates advanced scoring functions and triggers
-- for automatic recalculation of match scores

-- =====================================================
-- 1. ENHANCED SCORING FUNCTION
-- =====================================================

-- Advanced scoring function that combines multiple factors
CREATE OR REPLACE FUNCTION public.fn_compute_match_score(
  p_event_id uuid,
  p_sponsor_id uuid
)
RETURNS TABLE (
  score numeric,
  breakdown jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  event_record record;
  sponsor_record record;
  sponsor_profile record;
  event_insights record;
  quality_score numeric;
  
  -- Scoring components
  budget_fit numeric := 0;
  audience_overlap numeric := 0;
  geo_fit numeric := 0;
  engagement_quality numeric := 0;
  objectives_similarity numeric := 0;
  temporal_fit numeric := 0;
  
  -- Final score
  final_score numeric;
  breakdown_json jsonb;
BEGIN
  -- Get event data
  SELECT e.*, eqs.final_quality_score, eqs.quality_tier
  INTO event_record
  FROM public.events e
  LEFT JOIN public.mv_event_quality_scores eqs ON eqs.event_id = e.id
  WHERE e.id = p_event_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0.0, '{"error": "Event not found"}'::jsonb;
    RETURN;
  END IF;
  
  -- Get sponsor data
  SELECT s.*, sp.*
  INTO sponsor_record
  FROM public.sponsors s
  LEFT JOIN public.sponsor_profiles sp ON sp.sponsor_id = s.id
  WHERE s.id = p_sponsor_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0.0, '{"error": "Sponsor not found"}'::jsonb;
    RETURN;
  END IF;
  
  -- Get event audience insights
  SELECT * INTO event_insights
  FROM public.event_audience_insights
  WHERE event_id = p_event_id;
  
  -- 1. Budget Fit (30% weight)
  IF sponsor_record.annual_budget_cents IS NOT NULL AND sponsor_record.annual_budget_cents > 0 THEN
    -- Calculate if sponsor budget aligns with event scale
    budget_fit := LEAST(1.0, 
      CASE 
        WHEN event_record.quality_tier = 'premium' AND sponsor_record.annual_budget_cents >= 1000000 THEN 1.0
        WHEN event_record.quality_tier = 'high' AND sponsor_record.annual_budget_cents >= 500000 THEN 1.0
        WHEN event_record.quality_tier = 'medium' AND sponsor_record.annual_budget_cents >= 100000 THEN 1.0
        WHEN event_record.quality_tier = 'low' AND sponsor_record.annual_budget_cents >= 10000 THEN 1.0
        ELSE 0.3
      END
    );
  ELSE
    budget_fit := 0.5; -- Neutral if no budget info
  END IF;
  
  -- 2. Audience Overlap (25% weight)
  IF event_insights.id IS NOT NULL AND sponsor_record.target_audience IS NOT NULL THEN
    -- Simplified audience overlap calculation
    audience_overlap := 0.7; -- Placeholder for complex audience matching
  ELSE
    audience_overlap := 0.5; -- Neutral if no audience data
  END IF;
  
  -- 3. Geographic Fit (15% weight)
  IF sponsor_record.regions IS NOT NULL AND event_record.city IS NOT NULL THEN
    -- Check if event city matches sponsor regions
    geo_fit := CASE 
      WHEN event_record.city = ANY(sponsor_record.regions) THEN 1.0
      WHEN 'global' = ANY(sponsor_record.regions) THEN 0.8
      ELSE 0.3
    END;
  ELSE
    geo_fit := 0.5; -- Neutral if no geo data
  END IF;
  
  -- 4. Engagement Quality (20% weight)
  engagement_quality := COALESCE(event_record.final_quality_score, 0.5);
  
  -- 5. Objectives Similarity (10% weight)
  -- This would use vector similarity in a real implementation
  objectives_similarity := 0.6; -- Placeholder for vector similarity
  
  -- 6. Temporal Fit (bonus)
  IF event_record.start_at > now() THEN
    temporal_fit := 1.0; -- Future events get full score
  ELSIF event_record.start_at > now() - interval '30 days' THEN
    temporal_fit := 0.8; -- Recent events get high score
  ELSE
    temporal_fit := 0.3; -- Past events get lower score
  END IF;
  
  -- Calculate final weighted score
  final_score := (
    budget_fit * 0.30 +
    audience_overlap * 0.25 +
    geo_fit * 0.15 +
    engagement_quality * 0.20 +
    objectives_similarity * 0.10
  ) * temporal_fit;
  
  -- Ensure score is between 0 and 1
  final_score := GREATEST(0.0, LEAST(1.0, final_score));
  
  -- Create breakdown JSON
  breakdown_json := jsonb_build_object(
    'budget_fit', budget_fit,
    'audience_overlap', audience_overlap,
    'geo_fit', geo_fit,
    'engagement_quality', engagement_quality,
    'objectives_similarity', objectives_similarity,
    'temporal_fit', temporal_fit,
    'event_quality_tier', event_record.quality_tier,
    'sponsor_budget_range', CASE 
      WHEN sponsor_record.annual_budget_cents >= 1000000 THEN 'enterprise'
      WHEN sponsor_record.annual_budget_cents >= 100000 THEN 'mid-market'
      WHEN sponsor_record.annual_budget_cents >= 10000 THEN 'small-business'
      ELSE 'unknown'
    END
  );
  
  RETURN QUERY SELECT final_score, breakdown_json;
END $$;

-- =====================================================
-- 2. TRIGGER FUNCTIONS FOR AUTOMATIC RECALCULATION
-- =====================================================

-- Function to queue recalculation when sponsor profiles change
CREATE OR REPLACE FUNCTION public.fn_queue_recalc_on_sponsor_profiles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Queue recalculation for all events when sponsor profile changes
  INSERT INTO public.fit_recalc_queue (sponsor_id, priority, created_at)
  SELECT DISTINCT e.id, 1, now()
  FROM public.events e
  WHERE e.start_at > now() - interval '90 days' -- Only recent/future events
  ON CONFLICT DO NOTHING;
  
  RETURN COALESCE(NEW, OLD);
END $$;

-- Function to queue recalculation when event insights change
CREATE OR REPLACE FUNCTION public.fn_queue_recalc_on_event_insights()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Queue recalculation for all sponsors when event insights change
  INSERT INTO public.fit_recalc_queue (event_id, priority, created_at)
  SELECT DISTINCT s.id, 1, now()
  FROM public.sponsors s
  JOIN public.sponsor_profiles sp ON sp.sponsor_id = s.id
  WHERE sp.annual_budget_cents > 0 -- Only active sponsors
  ON CONFLICT DO NOTHING;
  
  RETURN COALESCE(NEW, OLD);
END $$;

-- Function to queue recalculation when events change
CREATE OR REPLACE FUNCTION public.fn_queue_recalc_on_events()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Queue recalculation for all sponsors when event changes
  INSERT INTO public.fit_recalc_queue (event_id, priority, created_at)
  SELECT DISTINCT s.id, 1, now()
  FROM public.sponsors s
  JOIN public.sponsor_profiles sp ON sp.sponsor_id = s.id
  WHERE sp.annual_budget_cents > 0 -- Only active sponsors
  ON CONFLICT DO NOTHING;
  
  RETURN COALESCE(NEW, OLD);
END $$;

-- =====================================================
-- 3. CREATE TRIGGERS
-- =====================================================

-- Trigger on sponsor_profiles changes
DROP TRIGGER IF EXISTS trigger_queue_recalc_sponsor_profiles ON public.sponsor_profiles;
CREATE TRIGGER trigger_queue_recalc_sponsor_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.sponsor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_queue_recalc_on_sponsor_profiles();

-- Trigger on event_audience_insights changes
DROP TRIGGER IF EXISTS trigger_queue_recalc_event_insights ON public.event_audience_insights;
CREATE TRIGGER trigger_queue_recalc_event_insights
  AFTER INSERT OR UPDATE OR DELETE ON public.event_audience_insights
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_queue_recalc_on_event_insights();

-- Trigger on events changes
DROP TRIGGER IF EXISTS trigger_queue_recalc_events ON public.events;
CREATE TRIGGER trigger_queue_recalc_events
  AFTER UPDATE ON public.events
  FOR EACH ROW
  WHEN (OLD.title IS DISTINCT FROM NEW.title OR 
        OLD.description IS DISTINCT FROM NEW.description OR
        OLD.category IS DISTINCT FROM NEW.category)
  EXECUTE FUNCTION public.fn_queue_recalc_on_events();

-- =====================================================
-- 4. QUEUE HEALTH MONITORING
-- =====================================================

-- Function to check queue health
CREATE OR REPLACE FUNCTION public.check_recalc_queue_health()
RETURNS TABLE (
  total_pending integer,
  high_priority_pending integer,
  oldest_pending_age interval,
  avg_processing_time interval
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::integer AS total_pending,
    COUNT(*) FILTER (WHERE priority > 0)::integer AS high_priority_pending,
    MAX(now() - created_at) AS oldest_pending_age,
    AVG(processed_at - created_at) AS avg_processing_time
  FROM public.fit_recalc_queue
  WHERE status IS NULL OR status = 'pending';
END $$;

-- Function to clean up old queue items
CREATE OR REPLACE FUNCTION public.cleanup_recalc_queue()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
  additional_count integer;
BEGIN
  -- Delete processed items older than 7 days
  DELETE FROM public.fit_recalc_queue
  WHERE processed_at IS NOT NULL
  AND processed_at < now() - interval '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete failed items older than 30 days
  DELETE FROM public.fit_recalc_queue
  WHERE status = 'failed'
  AND created_at < now() - interval '30 days';
  
  GET DIAGNOSTICS additional_count = ROW_COUNT;
  
  -- Add both counts together
  deleted_count := deleted_count + additional_count;
  
  RETURN deleted_count;
END $$;

-- =====================================================
-- 5. SCHEDULE QUEUE MONITORING
-- =====================================================

-- Schedule queue health checks
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'check-recalc-queue-health',
      '*/30 * * * *', -- Every 30 minutes
      'SELECT public.check_recalc_queue_health();'
    );
    
    PERFORM cron.schedule(
      'cleanup-recalc-queue',
      '0 2 * * *', -- Daily at 2 AM
      'SELECT public.cleanup_recalc_queue();'
    );
    
    RAISE NOTICE 'Scheduled queue monitoring and cleanup';
  ELSE
    RAISE NOTICE 'pg_cron extension not available - manual queue management required';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule queue monitoring: %', SQLERRM;
END $$;

-- =====================================================
-- 6. UPDATE SPONSORSHIP MATCHES WITH NEW SCORING
-- =====================================================

-- Function to update sponsorship matches using new scoring
CREATE OR REPLACE FUNCTION public.update_sponsorship_matches()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  queue_item record;
  updated_count integer := 0;
  score_result record;
BEGIN
  -- Process pending queue items
  FOR queue_item IN 
    SELECT * FROM public.fit_recalc_queue
    WHERE processed_at IS NULL
    ORDER BY priority DESC, created_at ASC
    LIMIT 100
  LOOP
    BEGIN
      -- Update queue item status
      UPDATE public.fit_recalc_queue
      SET processed_at = now()
      WHERE id = queue_item.id;
      
      -- Calculate new scores
      IF queue_item.event_id IS NOT NULL AND queue_item.sponsor_id IS NOT NULL THEN
        -- Specific event-sponsor pair
        SELECT * INTO score_result
        FROM public.fn_compute_match_score(queue_item.event_id, queue_item.sponsor_id);
        
        -- Update or insert match
        INSERT INTO public.sponsorship_matches (
          event_id, sponsor_id, score, overlap_metrics, updated_at
        ) VALUES (
          queue_item.event_id, 
          queue_item.sponsor_id, 
          score_result.score, 
          score_result.breakdown, 
          now()
        )
        ON CONFLICT (event_id, sponsor_id)
        DO UPDATE SET
          score = EXCLUDED.score,
          overlap_metrics = EXCLUDED.breakdown,
          updated_at = EXCLUDED.updated_at;
          
      ELSIF queue_item.event_id IS NOT NULL THEN
        -- All sponsors for specific event
        FOR score_result IN
          SELECT s.id as sponsor_id, fn.*
          FROM public.sponsors s
          JOIN public.sponsor_profiles sp ON sp.sponsor_id = s.id
          CROSS JOIN LATERAL public.fn_compute_match_score(queue_item.event_id, s.id) fn
        LOOP
          INSERT INTO public.sponsorship_matches (
            event_id, sponsor_id, score, overlap_metrics, updated_at
          ) VALUES (
            queue_item.event_id, 
            score_result.sponsor_id, 
            score_result.score, 
            score_result.breakdown, 
            now()
          )
          ON CONFLICT (event_id, sponsor_id)
          DO UPDATE SET
            score = EXCLUDED.score,
            overlap_metrics = EXCLUDED.breakdown,
            updated_at = EXCLUDED.updated_at;
        END LOOP;
        
      ELSIF queue_item.sponsor_id IS NOT NULL THEN
        -- All events for specific sponsor
        FOR score_result IN
          SELECT e.id as event_id, fn.*
          FROM public.events e
          CROSS JOIN LATERAL public.fn_compute_match_score(e.id, queue_item.sponsor_id) fn
        LOOP
          INSERT INTO public.sponsorship_matches (
            event_id, sponsor_id, score, overlap_metrics, updated_at
          ) VALUES (
            score_result.event_id, 
            queue_item.sponsor_id, 
            score_result.score, 
            score_result.breakdown, 
            now()
          )
          ON CONFLICT (event_id, sponsor_id)
          DO UPDATE SET
            score = EXCLUDED.score,
            overlap_metrics = EXCLUDED.breakdown,
            updated_at = EXCLUDED.updated_at;
        END LOOP;
      END IF;
      
      updated_count := updated_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Mark as failed
        UPDATE public.fit_recalc_queue
        SET status = 'failed'
        WHERE id = queue_item.id;
    END;
  END LOOP;
  
  RETURN updated_count;
END $$;

-- =====================================================
-- 7. COMMENTS
-- =====================================================

COMMENT ON FUNCTION public.fn_compute_match_score(uuid, uuid) IS 'Advanced scoring function combining multiple factors for sponsor-event matching';
COMMENT ON FUNCTION public.fn_queue_recalc_on_sponsor_profiles() IS 'Triggers recalculation when sponsor profiles change';
COMMENT ON FUNCTION public.fn_queue_recalc_on_event_insights() IS 'Triggers recalculation when event insights change';
COMMENT ON FUNCTION public.fn_queue_recalc_on_events() IS 'Triggers recalculation when events change';
COMMENT ON FUNCTION public.check_recalc_queue_health() IS 'Monitors the health of the recalculation queue';
COMMENT ON FUNCTION public.cleanup_recalc_queue() IS 'Cleans up old items from the recalculation queue';
COMMENT ON FUNCTION public.update_sponsorship_matches() IS 'Processes the recalculation queue and updates match scores';
