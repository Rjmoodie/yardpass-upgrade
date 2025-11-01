-- Add RPC function to efficiently fetch view counts for multiple posts

CREATE OR REPLACE FUNCTION public.get_post_view_counts(p_post_ids UUID[])
RETURNS TABLE (
  post_id UUID,
  view_count BIGINT,
  unique_sessions BIGINT,
  avg_dwell_seconds NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = events, public
AS $$
  SELECT 
    pi.post_id,
    COUNT(pi.id) as view_count,
    COUNT(DISTINCT pi.session_id) as unique_sessions,
    ROUND(AVG(pi.dwell_ms / 1000.0), 1) as avg_dwell_seconds
  FROM events.post_impressions pi
  WHERE pi.post_id = ANY(p_post_ids)
  GROUP BY pi.post_id;
$$;

COMMENT ON FUNCTION public.get_post_view_counts IS 
  'Efficiently fetches view counts for a batch of posts';

GRANT EXECUTE ON FUNCTION public.get_post_view_counts TO authenticated, anon;

