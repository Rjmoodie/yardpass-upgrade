-- Create materialized views for analytics performance

-- Daily GMV / units by event
CREATE MATERIALIZED VIEW public.event_kpis_daily AS
SELECT
  o.event_id,
  DATE_TRUNC('day', o.paid_at)::date AS d,
  COUNT(DISTINCT o.id) AS orders,
  SUM(oi.quantity) AS units,
  SUM(o.total_cents) AS gmv_cents,
  SUM(o.fees_cents) AS fees_cents
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
WHERE o.status = 'paid'
GROUP BY 1, 2;

-- Daily scans
CREATE MATERIALIZED VIEW public.event_scans_daily AS
SELECT
  event_id,
  DATE_TRUNC('day', created_at)::date AS d,
  COUNT(*) AS scans,
  SUM(CASE WHEN result = 'duplicate' THEN 1 ELSE 0 END) AS dupes
FROM public.scan_logs
GROUP BY 1, 2;

-- Post engagement by day
CREATE MATERIALIZED VIEW public.post_engagement_daily AS
SELECT
  p.event_id,
  p.id AS post_id,
  DATE_TRUNC('day', r.created_at)::date AS d,
  COUNT(*) FILTER (WHERE r.kind = 'like') AS likes,
  COUNT(*) FILTER (WHERE r.kind = 'comment') AS comments,
  COUNT(*) FILTER (WHERE r.kind = 'share') AS shares
FROM public.event_posts p
LEFT JOIN public.event_reactions r ON r.post_id = p.id
GROUP BY 1, 2, 3;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_kpis_daily_event_date ON public.event_kpis_daily (event_id, d);
CREATE INDEX IF NOT EXISTS idx_event_scans_daily_event_date ON public.event_scans_daily (event_id, d);
CREATE INDEX IF NOT EXISTS idx_post_engagement_daily_event_date ON public.post_engagement_daily (event_id, d);

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION public.refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.event_kpis_daily;
  REFRESH MATERIALIZED VIEW public.event_scans_daily;
  REFRESH MATERIALIZED VIEW public.post_engagement_daily;
END;
$$;

-- Grant permissions for materialized views
GRANT SELECT ON public.event_kpis_daily TO authenticated;
GRANT SELECT ON public.event_scans_daily TO authenticated;
GRANT SELECT ON public.post_engagement_daily TO authenticated;