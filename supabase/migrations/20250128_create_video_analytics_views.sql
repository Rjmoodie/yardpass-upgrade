-- Create views and RPC functions for video analytics dashboard
-- These provide aggregated data for error rates and performance metrics

-- View: Video error rates by error type (last 30 days)
CREATE OR REPLACE VIEW public.video_error_rates AS
SELECT 
  error_type,
  COUNT(*) as error_count,
  COUNT(DISTINCT playback_id) as affected_playbacks,
  COUNT(DISTINCT post_id) as affected_posts,
  COUNT(DISTINCT event_id) as affected_events,
  COUNT(DISTINCT user_id) as affected_users,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM analytics.video_errors
WHERE created_at >= now() - interval '30 days'
GROUP BY error_type
ORDER BY error_count DESC;

-- View: Video error rates by day (last 30 days)
CREATE OR REPLACE VIEW public.video_error_rates_daily AS
SELECT 
  DATE(created_at) as date,
  error_type,
  COUNT(*) as error_count,
  COUNT(DISTINCT playback_id) as affected_playbacks
FROM analytics.video_errors
WHERE created_at >= now() - interval '30 days'
GROUP BY DATE(created_at), error_type
ORDER BY date DESC, error_count DESC;

-- View: Video performance metrics summary
CREATE OR REPLACE VIEW public.video_performance_summary AS
SELECT 
  metric,
  COUNT(*) as sample_count,
  ROUND(AVG(value)::numeric, 2) as avg_value_ms,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value)::numeric, 2) as median_value_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value)::numeric, 2) as p95_value_ms,
  ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value)::numeric, 2) as p99_value_ms,
  MIN(value) as min_value_ms,
  MAX(value) as max_value_ms,
  COUNT(DISTINCT playback_id) as unique_playbacks,
  COUNT(DISTINCT post_id) as unique_posts,
  COUNT(DISTINCT event_id) as unique_events
FROM analytics.video_metrics
WHERE created_at >= now() - interval '30 days'
GROUP BY metric
ORDER BY metric;

-- View: Video performance metrics by day (last 30 days)
CREATE OR REPLACE VIEW public.video_performance_daily AS
SELECT 
  DATE(created_at) as date,
  metric,
  COUNT(*) as sample_count,
  ROUND(AVG(value)::numeric, 2) as avg_value_ms,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value)::numeric, 2) as median_value_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value)::numeric, 2) as p95_value_ms
FROM analytics.video_metrics
WHERE created_at >= now() - interval '30 days'
GROUP BY DATE(created_at), metric
ORDER BY date DESC, metric;

-- View: Top posts by error rate
CREATE OR REPLACE VIEW public.video_error_top_posts AS
SELECT 
  post_id,
  COUNT(*) as error_count,
  COUNT(DISTINCT error_type) as unique_error_types,
  COUNT(DISTINCT playback_id) as affected_playbacks,
  MIN(created_at) as first_error,
  MAX(created_at) as last_error
FROM analytics.video_errors
WHERE post_id IS NOT NULL
  AND created_at >= now() - interval '30 days'
GROUP BY post_id
ORDER BY error_count DESC
LIMIT 50;

-- View: Top events by error rate
CREATE OR REPLACE VIEW public.video_error_top_events AS
SELECT 
  event_id,
  COUNT(*) as error_count,
  COUNT(DISTINCT error_type) as unique_error_types,
  COUNT(DISTINCT post_id) as affected_posts,
  COUNT(DISTINCT playback_id) as affected_playbacks,
  MIN(created_at) as first_error,
  MAX(created_at) as last_error
FROM analytics.video_errors
WHERE event_id IS NOT NULL
  AND created_at >= now() - interval '30 days'
GROUP BY event_id
ORDER BY error_count DESC
LIMIT 50;

-- RPC function: Get video analytics summary for an organization
CREATE OR REPLACE FUNCTION public.get_video_analytics_summary(
  p_org_id UUID DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = analytics, public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'error_summary', (
      SELECT json_agg(json_build_object(
        'error_type', error_type,
        'error_count', error_count,
        'affected_playbacks', affected_playbacks,
        'affected_posts', affected_posts,
        'affected_events', affected_events
      ))
      FROM public.video_error_rates
      WHERE error_count > 0
    ),
    'performance_summary', (
      SELECT json_agg(json_build_object(
        'metric', metric,
        'avg_value_ms', avg_value_ms,
        'median_value_ms', median_value_ms,
        'p95_value_ms', p95_value_ms,
        'sample_count', sample_count
      ))
      FROM public.video_performance_summary
    ),
    'total_errors', (
      SELECT COUNT(*)::INTEGER
      FROM analytics.video_errors
      WHERE created_at >= now() - (p_days || ' days')::interval
        AND (p_event_id IS NULL OR event_id = p_event_id)
    ),
    'total_metrics', (
      SELECT COUNT(*)::INTEGER
      FROM analytics.video_metrics
      WHERE created_at >= now() - (p_days || ' days')::interval
        AND (p_event_id IS NULL OR event_id = p_event_id)
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_video_analytics_summary TO authenticated, service_role;

-- Grant SELECT on views to authenticated users
GRANT SELECT ON public.video_error_rates TO authenticated;
GRANT SELECT ON public.video_error_rates_daily TO authenticated;
GRANT SELECT ON public.video_performance_summary TO authenticated;
GRANT SELECT ON public.video_performance_daily TO authenticated;
GRANT SELECT ON public.video_error_top_posts TO authenticated;
GRANT SELECT ON public.video_error_top_events TO authenticated;

-- Comments
COMMENT ON VIEW public.video_error_rates IS 'Aggregated video error rates by error type (last 30 days)';
COMMENT ON VIEW public.video_error_rates_daily IS 'Daily video error rates by error type (last 30 days)';
COMMENT ON VIEW public.video_performance_summary IS 'Summary of video performance metrics (last 30 days)';
COMMENT ON VIEW public.video_performance_daily IS 'Daily video performance metrics (last 30 days)';
COMMENT ON VIEW public.video_error_top_posts IS 'Top 50 posts by error count (last 30 days)';
COMMENT ON VIEW public.video_error_top_events IS 'Top 50 events by error count (last 30 days)';
COMMENT ON FUNCTION public.get_video_analytics_summary IS 'Get comprehensive video analytics summary for an organization or event';
