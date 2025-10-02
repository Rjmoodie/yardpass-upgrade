-- Create RPC function for campaign analytics daily
CREATE OR REPLACE FUNCTION public.rpc_campaign_analytics_daily(
  p_org_id uuid,
  p_from date,
  p_to date,
  p_campaign_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  org_id uuid,
  campaign_id uuid,
  date date,
  impressions bigint,
  clicks bigint,
  conversions bigint,
  revenue_cents bigint,
  credits_spent bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Verify user has access to this org
  SELECT 
    cads.org_id,
    cads.campaign_id,
    cads.date,
    cads.impressions,
    cads.clicks,
    cads.conversions,
    cads.revenue_cents,
    cads.credits_spent
  FROM campaign_analytics_daily_secured cads
  WHERE cads.org_id = p_org_id
    AND cads.date >= p_from
    AND cads.date <= p_to
    AND (p_campaign_ids IS NULL OR cads.campaign_id = ANY(p_campaign_ids))
    AND EXISTS (
      SELECT 1 FROM org_memberships om
      WHERE om.org_id = p_org_id
        AND om.user_id = auth.uid()
    )
  ORDER BY cads.date, cads.campaign_id;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.rpc_campaign_analytics_daily(uuid, date, date, uuid[]) TO authenticated;

-- Create RPC function for creative analytics rollup
CREATE OR REPLACE FUNCTION public.rpc_creative_analytics_rollup(
  p_org_id uuid,
  p_from text,
  p_to text,
  p_campaign_ids uuid[] DEFAULT NULL,
  p_creative_ids uuid[] DEFAULT NULL,
  p_include_series boolean DEFAULT false,
  p_sort text DEFAULT 'impressions',
  p_dir text DEFAULT 'desc',
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  org_id uuid,
  campaign_id uuid,
  campaign_name text,
  creative_id uuid,
  headline text,
  media_type text,
  active boolean,
  poster_url text,
  media_url text,
  impressions bigint,
  clicks bigint,
  conversions bigint,
  revenue_cents bigint,
  credits_spent bigint,
  ctr numeric,
  daily_series jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_date date := p_from::date;
  v_to_date date := p_to::date;
BEGIN
  -- Verify user has access to this org
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied to organization';
  END IF;

  RETURN QUERY
  WITH rollup AS (
    SELECT 
      cads.org_id,
      cads.campaign_id,
      c.name as campaign_name,
      cads.creative_id,
      cr.headline,
      cr.media_type::text,
      cr.active,
      cr.poster_url,
      cr.media_url,
      SUM(cads.impressions) as impressions,
      SUM(cads.clicks) as clicks,
      SUM(cads.conversions) as conversions,
      SUM(cads.revenue_cents) as revenue_cents,
      SUM(cads.credits_spent) as credits_spent,
      CASE 
        WHEN SUM(cads.impressions) > 0 
        THEN ROUND((SUM(cads.clicks)::numeric / SUM(cads.impressions)::numeric) * 100, 2)
        ELSE 0
      END as ctr,
      CASE 
        WHEN p_include_series THEN
          jsonb_agg(
            jsonb_build_object(
              'date', cads.date,
              'impressions', cads.impressions,
              'clicks', cads.clicks,
              'conversions', cads.conversions,
              'revenue_cents', cads.revenue_cents,
              'credits_spent', cads.credits_spent
            ) ORDER BY cads.date
          )
        ELSE '[]'::jsonb
      END as daily_series
    FROM creative_analytics_daily_secured cads
    JOIN campaigns c ON c.id = cads.campaign_id
    LEFT JOIN ad_creatives cr ON cr.id = cads.creative_id
    WHERE cads.org_id = p_org_id
      AND cads.date >= v_from_date
      AND cads.date <= v_to_date
      AND (p_campaign_ids IS NULL OR cads.campaign_id = ANY(p_campaign_ids))
      AND (p_creative_ids IS NULL OR cads.creative_id = ANY(p_creative_ids))
    GROUP BY cads.org_id, cads.campaign_id, c.name, cads.creative_id, cr.headline, cr.media_type, cr.active, cr.poster_url, cr.media_url
  )
  SELECT *
  FROM rollup
  ORDER BY
    CASE WHEN p_sort = 'impressions' AND p_dir = 'desc' THEN rollup.impressions END DESC NULLS LAST,
    CASE WHEN p_sort = 'impressions' AND p_dir = 'asc' THEN rollup.impressions END ASC NULLS LAST,
    CASE WHEN p_sort = 'clicks' AND p_dir = 'desc' THEN rollup.clicks END DESC NULLS LAST,
    CASE WHEN p_sort = 'clicks' AND p_dir = 'asc' THEN rollup.clicks END ASC NULLS LAST,
    CASE WHEN p_sort = 'ctr' AND p_dir = 'desc' THEN rollup.ctr END DESC NULLS LAST,
    CASE WHEN p_sort = 'ctr' AND p_dir = 'asc' THEN rollup.ctr END ASC NULLS LAST,
    CASE WHEN p_sort = 'credits_spent' AND p_dir = 'desc' THEN rollup.credits_spent END DESC NULLS LAST,
    CASE WHEN p_sort = 'credits_spent' AND p_dir = 'asc' THEN rollup.credits_spent END ASC NULLS LAST,
    CASE WHEN p_sort = 'revenue_cents' AND p_dir = 'desc' THEN rollup.revenue_cents END DESC NULLS LAST,
    CASE WHEN p_sort = 'revenue_cents' AND p_dir = 'asc' THEN rollup.revenue_cents END ASC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.rpc_creative_analytics_rollup(uuid, text, text, uuid[], uuid[], boolean, text, text, int, int) TO authenticated;