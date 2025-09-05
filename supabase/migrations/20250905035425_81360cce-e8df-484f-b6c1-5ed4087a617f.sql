-- Function to get top posts analytics
CREATE OR REPLACE FUNCTION public.get_top_posts_analytics(
  p_event_id uuid,
  p_metric text DEFAULT 'views',
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  post_id uuid,
  title text,
  media_urls text[],
  views_total bigint,
  views_unique bigint,
  completions bigint,
  clicks_tickets bigint,
  clicks_total bigint,
  engagement_total bigint,
  ctr_tickets numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH post_metrics AS (
    SELECT 
      p.id as post_id,
      p.text as title,
      p.media_urls,
      p.created_at,
      COALESCE(SUM(CASE WHEN pv.qualified THEN 1 ELSE 0 END), 0) as views_total,
      COALESCE(COUNT(DISTINCT CASE WHEN pv.qualified THEN COALESCE(pv.user_id::text, pv.session_id) END), 0) as views_unique,
      COALESCE(SUM(CASE WHEN pv.completed THEN 1 ELSE 0 END), 0) as completions,
      COALESCE(SUM(CASE WHEN pc.target = 'tickets' THEN 1 ELSE 0 END), 0) as clicks_tickets,
      COALESCE(COUNT(pc.id), 0) as clicks_total,
      COALESCE(COUNT(r.id), 0) + COALESCE(COUNT(c.id), 0) as engagement_total
    FROM event_posts p
    LEFT JOIN post_views pv ON pv.post_id = p.id
    LEFT JOIN post_clicks pc ON pc.post_id = p.id
    LEFT JOIN event_reactions r ON r.post_id = p.id
    LEFT JOIN event_comments c ON c.post_id = p.id
    WHERE p.event_id = p_event_id
    GROUP BY p.id, p.text, p.media_urls, p.created_at
  )
  SELECT 
    pm.post_id,
    pm.title,
    pm.media_urls,
    pm.views_total,
    pm.views_unique,
    pm.completions,
    pm.clicks_tickets,
    pm.clicks_total,
    pm.engagement_total,
    CASE 
      WHEN pm.views_unique > 0 THEN (pm.clicks_tickets::numeric / pm.views_unique::numeric * 100)
      ELSE 0
    END as ctr_tickets,
    pm.created_at
  FROM post_metrics pm
  ORDER BY 
    CASE 
      WHEN p_metric = 'views' THEN pm.views_unique
      WHEN p_metric = 'ctr' THEN (CASE WHEN pm.views_unique > 0 THEN pm.clicks_tickets::numeric / pm.views_unique::numeric ELSE 0 END)
      WHEN p_metric = 'engagement' THEN pm.engagement_total
      ELSE pm.views_unique
    END DESC
  LIMIT p_limit;
END;
$$;