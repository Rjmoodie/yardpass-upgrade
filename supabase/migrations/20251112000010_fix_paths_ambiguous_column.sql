-- =====================================================================
-- FIX AMBIGUOUS COLUMN REFERENCE IN get_audience_paths
-- =====================================================================
-- Issue: Column "path" is ambiguous - conflicts with potential variable
-- Fix: Qualify all column references with table aliases
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_audience_paths(
  p_org_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  path TEXT,
  users BIGINT,
  avg_time_to_purchase_minutes INTEGER,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH sequences AS (
    SELECT
      COALESCE(e.user_id::TEXT, e.session_id) AS user_key,
      STRING_AGG(
        DISTINCT e.event_name, 
        ' → ' 
        ORDER BY e.event_name
      ) AS path_seq,
      EXTRACT(EPOCH FROM (MAX(e.ts) - MIN(e.ts))) / 60 AS minutes
    FROM analytics.events e
    WHERE e.org_id = p_org_id
      AND e.ts BETWEEN p_from AND p_to
      AND e.event_name IN ('page_view', 'event_view', 'ticket_cta_click', 'checkout_started', 'purchase')
      AND NOT e.is_bot
      AND NOT e.is_internal
    GROUP BY user_key
    HAVING COUNT(DISTINCT e.event_name) >= 2
  ),
  path_stats AS (
    SELECT
      s.path_seq,
      COUNT(*) AS user_count,
      ROUND(AVG(s.minutes)) AS avg_minutes,
      COUNT(*) FILTER (WHERE s.path_seq LIKE '%purchase%')::NUMERIC / COUNT(*) * 100 AS conv_rate
    FROM sequences s
    GROUP BY s.path_seq
  )
  SELECT 
    ps.path_seq AS path,
    ps.user_count AS users,
    ps.avg_minutes::INTEGER AS avg_time_to_purchase_minutes,
    ROUND(ps.conv_rate, 1) AS conversion_rate
  FROM path_stats ps
  WHERE ps.user_count >= 5  -- Minimum sample size
  ORDER BY ps.user_count DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_audience_paths IS 
  'Returns top user journey paths to purchase. Fixed ambiguous column references.';

