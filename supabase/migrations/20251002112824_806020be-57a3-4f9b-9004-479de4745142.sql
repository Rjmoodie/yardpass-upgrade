-- Add creative analytics rollup RPC with campaign name
CREATE OR REPLACE FUNCTION public.rpc_creative_analytics_rollup(
  p_org_id uuid,
  p_from date,
  p_to date,
  p_campaign_ids uuid[] DEFAULT NULL,
  p_creative_ids uuid[] DEFAULT NULL,
  p_include_series boolean DEFAULT false,
  p_sort text DEFAULT 'impressions',
  p_dir text DEFAULT 'desc',
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  creative_id uuid,
  campaign_id uuid,
  org_id uuid,
  campaign_name text,
  headline text,
  media_type text,
  active boolean,
  impressions bigint,
  clicks bigint,
  conversions bigint,
  revenue_cents bigint,
  credits_spent bigint,
  ctr numeric,
  series jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sort text := lower(p_sort);
  v_dir  text := case when lower(p_dir) = 'asc' then 'asc' else 'desc' end;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.org_memberships om
    WHERE om.org_id = p_org_id AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized for org %', p_org_id USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      cad.creative_id,
      cad.campaign_id,
      cad.org_id,
      SUM(cad.impressions)::bigint AS impressions,
      SUM(cad.clicks)::bigint AS clicks,
      SUM(cad.conversions)::bigint AS conversions,
      COALESCE(SUM(cad.revenue_cents),0)::bigint AS revenue_cents,
      COALESCE(SUM(cad.credits_spent),0)::bigint AS credits_spent
    FROM creative_analytics_daily cad
    WHERE cad.org_id = p_org_id
      AND cad.date BETWEEN p_from AND p_to
      AND (p_campaign_ids IS NULL OR cad.campaign_id = ANY(p_campaign_ids))
      AND (p_creative_ids IS NULL OR cad.creative_id = ANY(p_creative_ids))
    GROUP BY cad.creative_id, cad.campaign_id, cad.org_id
  ),
  meta AS (
    SELECT
      ac.id AS creative_id,
      ac.campaign_id,
      ac.headline,
      ac.media_type::text,
      ac.active,
      c.name AS campaign_name
    FROM ad_creatives ac
    JOIN campaigns c ON c.id = ac.campaign_id
    WHERE c.org_id = p_org_id
  ),
  joined AS (
    SELECT
      b.creative_id,
      b.campaign_id,
      b.org_id,
      m.campaign_name,
      m.headline,
      m.media_type,
      m.active,
      b.impressions,
      b.clicks,
      b.conversions,
      b.revenue_cents,
      b.credits_spent,
      CASE WHEN b.impressions > 0 THEN (b.clicks::numeric / b.impressions::numeric) ELSE 0 END AS ctr
    FROM base b
    JOIN meta m USING (creative_id, campaign_id)
  ),
  ranked AS (
    SELECT j.*,
      CASE v_sort
        WHEN 'clicks' THEN j.clicks::numeric
        WHEN 'ctr' THEN j.ctr
        WHEN 'credits_spent' THEN j.credits_spent::numeric
        WHEN 'revenue_cents' THEN j.revenue_cents::numeric
        ELSE j.impressions::numeric
      END AS sort_key
    FROM joined j
  ),
  limited AS (
    SELECT * FROM ranked
    ORDER BY
      CASE WHEN v_dir = 'asc' THEN NULL ELSE sort_key END DESC,
      CASE WHEN v_dir = 'asc' THEN sort_key END ASC,
      creative_id
    LIMIT GREATEST(1, LEAST(p_limit, 1000))
    OFFSET GREATEST(0, p_offset)
  ),
  series_data AS (
    SELECT
      l.creative_id,
      json_agg(
        jsonb_build_object(
          'date', cad.date,
          'impressions', cad.impressions,
          'clicks', cad.clicks,
          'conversions', cad.conversions,
          'revenue_cents', cad.revenue_cents,
          'credits_spent', cad.credits_spent
        )
        ORDER BY cad.date ASC
      ) AS series
    FROM limited l
    JOIN creative_analytics_daily cad
      ON cad.creative_id = l.creative_id
     AND cad.org_id = p_org_id
     AND cad.date BETWEEN p_from AND p_to
     AND (p_campaign_ids IS NULL OR cad.campaign_id = ANY(p_campaign_ids))
    GROUP BY l.creative_id
  )
  SELECT
    l.creative_id,
    l.campaign_id,
    l.org_id,
    l.campaign_name,
    l.headline,
    l.media_type,
    l.active,
    l.impressions,
    l.clicks,
    l.conversions,
    l.revenue_cents,
    l.credits_spent,
    l.ctr,
    CASE WHEN p_include_series THEN sd.series ELSE NULL END AS series
  FROM limited l
  LEFT JOIN series_data sd USING (creative_id)
  ORDER BY
    CASE WHEN v_dir = 'asc' THEN NULL ELSE l.sort_key END DESC,
    CASE WHEN v_dir = 'asc' THEN l.sort_key END ASC,
    l.creative_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_creative_analytics_rollup(
  uuid, date, date, uuid[], uuid[], boolean, text, text, int, int
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rpc_creative_analytics_rollup(
  uuid, date, date, uuid[], uuid[], boolean, text, text, int, int
) TO authenticated;