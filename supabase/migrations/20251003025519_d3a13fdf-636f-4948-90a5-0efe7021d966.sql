-- Drop existing functions to recreate with correct signatures
DROP FUNCTION IF EXISTS rpc_campaign_analytics_daily(uuid, date, date, uuid[]);
DROP FUNCTION IF EXISTS rpc_creative_analytics_rollup(uuid, text, text, uuid[], uuid[], boolean, text, text, int, int);

-- Create RPC function for campaign analytics daily
CREATE OR REPLACE FUNCTION rpc_campaign_analytics_daily(
  p_org_id uuid,
  p_from date,
  p_to date,
  p_campaign_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
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
  SELECT
    campaign_id,
    date,
    impressions,
    clicks,
    conversions,
    revenue_cents,
    credits_spent
  FROM campaign_analytics_daily_secured
  WHERE org_id = p_org_id
    AND date >= p_from
    AND date <= p_to
    AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
  ORDER BY date, campaign_id;
$$;

-- Create RPC function for creative analytics rollup
CREATE OR REPLACE FUNCTION rpc_creative_analytics_rollup(
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
  creative_id uuid,
  campaign_id uuid,
  campaign_name text,
  headline text,
  media_type text,
  poster_url text,
  media_url text,
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
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH agg AS (
    SELECT
      cad.creative_id,
      cad.campaign_id,
      SUM(cad.impressions) as total_impressions,
      SUM(cad.clicks) as total_clicks,
      SUM(cad.conversions) as total_conversions,
      SUM(cad.revenue_cents) as total_revenue_cents,
      SUM(cad.credits_spent) as total_credits_spent,
      CASE 
        WHEN p_include_series THEN 
          jsonb_agg(
            jsonb_build_object(
              'date', cad.date,
              'impressions', cad.impressions,
              'clicks', cad.clicks,
              'conversions', cad.conversions,
              'revenue_cents', cad.revenue_cents,
              'credits_spent', cad.credits_spent
            ) ORDER BY cad.date
          )
        ELSE NULL
      END as daily_series
    FROM creative_analytics_daily_secured cad
    WHERE cad.org_id = p_org_id
      AND cad.date >= p_from::date
      AND cad.date <= p_to::date
      AND (p_campaign_ids IS NULL OR cad.campaign_id = ANY(p_campaign_ids))
      AND (p_creative_ids IS NULL OR cad.creative_id = ANY(p_creative_ids))
    GROUP BY cad.creative_id, cad.campaign_id
  )
  SELECT
    agg.creative_id,
    agg.campaign_id,
    c.name as campaign_name,
    ac.headline,
    ac.media_type::text,
    ac.poster_url,
    ac.media_url,
    ac.active,
    agg.total_impressions,
    agg.total_clicks,
    agg.total_conversions,
    agg.total_revenue_cents,
    agg.total_credits_spent,
    CASE 
      WHEN agg.total_impressions > 0 
      THEN (agg.total_clicks::numeric / agg.total_impressions::numeric)
      ELSE 0
    END as ctr,
    agg.daily_series
  FROM agg
  JOIN ad_creatives ac ON ac.id = agg.creative_id
  JOIN campaigns c ON c.id = agg.campaign_id
  ORDER BY
    CASE 
      WHEN p_sort = 'impressions' AND p_dir = 'desc' THEN agg.total_impressions END DESC,
    CASE 
      WHEN p_sort = 'impressions' AND p_dir = 'asc' THEN agg.total_impressions END ASC,
    CASE 
      WHEN p_sort = 'clicks' AND p_dir = 'desc' THEN agg.total_clicks END DESC,
    CASE 
      WHEN p_sort = 'clicks' AND p_dir = 'asc' THEN agg.total_clicks END ASC,
    CASE 
      WHEN p_sort = 'ctr' AND p_dir = 'desc' THEN 
        (CASE WHEN agg.total_impressions > 0 THEN agg.total_clicks::numeric / agg.total_impressions::numeric ELSE 0 END) 
      END DESC,
    CASE 
      WHEN p_sort = 'ctr' AND p_dir = 'asc' THEN 
        (CASE WHEN agg.total_impressions > 0 THEN agg.total_clicks::numeric / agg.total_impressions::numeric ELSE 0 END)
      END ASC,
    CASE 
      WHEN p_sort = 'credits_spent' AND p_dir = 'desc' THEN agg.total_credits_spent END DESC,
    CASE 
      WHEN p_sort = 'credits_spent' AND p_dir = 'asc' THEN agg.total_credits_spent END ASC,
    CASE 
      WHEN p_sort = 'revenue_cents' AND p_dir = 'desc' THEN agg.total_revenue_cents END DESC,
    CASE 
      WHEN p_sort = 'revenue_cents' AND p_dir = 'asc' THEN agg.total_revenue_cents END ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;