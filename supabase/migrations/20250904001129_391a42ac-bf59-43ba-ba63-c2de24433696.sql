-- Drop materialized views and create secure functions instead
DROP MATERIALIZED VIEW IF EXISTS public.event_kpis_daily CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.event_scans_daily CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.post_engagement_daily CASCADE;

-- Create secure functions for analytics data
CREATE OR REPLACE FUNCTION public.get_event_kpis_daily(p_event_ids uuid[], p_from_date date, p_to_date date)
RETURNS TABLE(
  event_id uuid,
  d date,
  orders bigint,
  units bigint,
  gmv_cents bigint,
  fees_cents bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.event_id,
    DATE_TRUNC('day', o.paid_at)::date AS d,
    COUNT(DISTINCT o.id) AS orders,
    SUM(oi.quantity) AS units,
    SUM(o.total_cents) AS gmv_cents,
    SUM(o.fees_cents) AS fees_cents
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status = 'paid'
    AND o.event_id = ANY(p_event_ids)
    AND DATE_TRUNC('day', o.paid_at)::date >= p_from_date
    AND DATE_TRUNC('day', o.paid_at)::date <= p_to_date
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

CREATE OR REPLACE FUNCTION public.get_event_scans_daily(p_event_ids uuid[], p_from_date date, p_to_date date)
RETURNS TABLE(
  event_id uuid,
  d date,
  scans bigint,
  dupes bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sl.event_id,
    DATE_TRUNC('day', sl.created_at)::date AS d,
    COUNT(*) AS scans,
    SUM(CASE WHEN sl.result = 'duplicate' THEN 1 ELSE 0 END) AS dupes
  FROM scan_logs sl
  WHERE sl.event_id = ANY(p_event_ids)
    AND DATE_TRUNC('day', sl.created_at)::date >= p_from_date
    AND DATE_TRUNC('day', sl.created_at)::date <= p_to_date
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

CREATE OR REPLACE FUNCTION public.get_post_engagement_daily(p_event_ids uuid[], p_from_date date, p_to_date date)
RETURNS TABLE(
  event_id uuid,
  post_id uuid,
  d date,
  likes bigint,
  comments bigint,
  shares bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.event_id,
    p.id AS post_id,
    DATE_TRUNC('day', r.created_at)::date AS d,
    COUNT(*) FILTER (WHERE r.kind = 'like') AS likes,
    COUNT(*) FILTER (WHERE r.kind = 'comment') AS comments,
    COUNT(*) FILTER (WHERE r.kind = 'share') AS shares
  FROM event_posts p
  LEFT JOIN event_reactions r ON r.post_id = p.id
  WHERE p.event_id = ANY(p_event_ids)
    AND (r.created_at IS NULL OR DATE_TRUNC('day', r.created_at)::date >= p_from_date)
    AND (r.created_at IS NULL OR DATE_TRUNC('day', r.created_at)::date <= p_to_date)
  GROUP BY 1, 2, 3
  ORDER BY 1, 2, 3;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_event_kpis_daily TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_scans_daily TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_post_engagement_daily TO authenticated;