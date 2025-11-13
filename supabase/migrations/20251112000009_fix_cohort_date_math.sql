-- =====================================================================
-- FIX COHORT DATE MATH ERROR
-- =====================================================================
-- Issue: EXTRACT(EPOCH FROM date - date) fails because DATE subtraction
--        returns INTEGER (days), not INTERVAL
-- Fix: Use simple integer division by 7 to get weeks
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_audience_cohorts(
  p_org_id UUID,
  p_weeks INTEGER DEFAULT 12
)
RETURNS TABLE(
  cohort_week DATE,
  week_offset INTEGER,
  buyers BIGINT,
  retention_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH firsts AS (
    SELECT 
      o.user_id,
      DATE_TRUNC('week', MIN(o.created_at))::DATE AS cohort_week,
      COUNT(*) OVER (PARTITION BY DATE_TRUNC('week', MIN(o.created_at))) AS cohort_size
    FROM ticketing.orders o
    WHERE o.status IN ('paid', 'refunded')
      AND EXISTS (
        SELECT 1 FROM events.events ev
        WHERE ev.id = o.event_id
          AND ev.owner_context_type = 'organization'
          AND ev.owner_context_id = p_org_id
      )
    GROUP BY o.user_id
  ),
  activity AS (
    SELECT 
      o.user_id,
      DATE_TRUNC('week', o.created_at)::DATE AS activity_week
    FROM ticketing.orders o
    WHERE o.status IN ('paid', 'refunded')
      AND EXISTS (
        SELECT 1 FROM events.events ev
        WHERE ev.id = o.event_id
          AND ev.owner_context_type = 'organization'
          AND ev.owner_context_id = p_org_id
      )
  )
  SELECT 
    f.cohort_week,
    FLOOR((a.activity_week - f.cohort_week) / 7.0)::INTEGER AS week_offset,  -- Fixed: Simple day division
    COUNT(DISTINCT a.user_id) AS buyers,
    ROUND(100.0 * COUNT(DISTINCT a.user_id)::NUMERIC / NULLIF(MAX(f.cohort_size), 0), 1) AS retention_rate
  FROM firsts f
  JOIN activity a ON a.user_id = f.user_id
  WHERE a.activity_week >= f.cohort_week 
    AND a.activity_week < f.cohort_week + (p_weeks || ' weeks')::INTERVAL
    AND f.cohort_week >= CURRENT_DATE - (p_weeks || ' weeks')::INTERVAL
  GROUP BY f.cohort_week, week_offset
  ORDER BY cohort_week DESC, week_offset;
END;
$$;

COMMENT ON FUNCTION public.get_audience_cohorts IS 
  'Returns weekly cohort retention data. Fixed DATE arithmetic to use integer division instead of EXTRACT(EPOCH).';

