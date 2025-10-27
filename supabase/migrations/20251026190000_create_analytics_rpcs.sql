-- Create Analytics RPC Functions for Campaign Manager Dashboard
-- These functions aggregate impression/click/conversion data by day

-- =====================================================
-- 1. Campaign Analytics Daily RPC
-- =====================================================

CREATE OR REPLACE FUNCTION public.rpc_campaign_analytics_daily(
  p_org_id UUID,
  p_from TEXT, -- 'YYYY-MM-DD'
  p_to TEXT,   -- 'YYYY-MM-DD'
  p_campaign_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(
  campaign_id UUID,
  date TEXT,
  impressions BIGINT,
  clicks BIGINT,
  conversions BIGINT,
  credits_spent NUMERIC,
  revenue_cents BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify user has access to this org
  IF NOT EXISTS (
    SELECT 1 FROM public.org_memberships
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      p_from::date,
      p_to::date,
      '1 day'::interval
    )::date AS date
  ),
  campaign_dates AS (
    SELECT 
      c.id AS campaign_id,
      ds.date
    FROM campaigns.campaigns c
    CROSS JOIN date_series ds
    WHERE c.org_id = p_org_id
      AND (p_campaign_ids IS NULL OR c.id = ANY(p_campaign_ids))
  ),
  daily_impressions AS (
    SELECT
      i.campaign_id,
      i.created_at::date AS date,
      COUNT(*) AS impressions
    FROM campaigns.ad_impressions i
    WHERE i.campaign_id IN (
      SELECT id FROM campaigns.campaigns WHERE org_id = p_org_id
    )
    AND i.created_at::date BETWEEN p_from::date AND p_to::date
    AND (p_campaign_ids IS NULL OR i.campaign_id = ANY(p_campaign_ids))
    GROUP BY i.campaign_id, i.created_at::date
  ),
  daily_clicks AS (
    SELECT
      c.campaign_id,
      c.created_at::date AS date,
      COUNT(*) AS clicks
    FROM campaigns.ad_clicks c
    WHERE c.campaign_id IN (
      SELECT id FROM campaigns.campaigns WHERE org_id = p_org_id
    )
    AND c.created_at::date BETWEEN p_from::date AND p_to::date
    AND (p_campaign_ids IS NULL OR c.campaign_id = ANY(p_campaign_ids))
    GROUP BY c.campaign_id, c.created_at::date
  ),
  daily_conversions AS (
    SELECT
      cv.campaign_id,
      cv.occurred_at::date AS date,
      COUNT(*) AS conversions
    FROM campaigns.ad_conversions cv
    WHERE cv.campaign_id IN (
      SELECT id FROM campaigns.campaigns WHERE org_id = p_org_id
    )
    AND cv.occurred_at::date BETWEEN p_from::date AND p_to::date
    AND (p_campaign_ids IS NULL OR cv.campaign_id = ANY(p_campaign_ids))
    GROUP BY cv.campaign_id, cv.occurred_at::date
  ),
  daily_spend AS (
    SELECT
      l.campaign_id,
      l.occurred_at::date AS date,
      SUM(l.credits_charged) AS credits_spent,
      SUM(l.rate_usd_cents * l.quantity) AS revenue_cents
    FROM campaigns.ad_spend_ledger l
    WHERE l.campaign_id IN (
      SELECT id FROM campaigns.campaigns WHERE org_id = p_org_id
    )
    AND l.occurred_at::date BETWEEN p_from::date AND p_to::date
    AND (p_campaign_ids IS NULL OR l.campaign_id = ANY(p_campaign_ids))
    GROUP BY l.campaign_id, l.occurred_at::date
  )
  SELECT
    cd.campaign_id,
    cd.date::text,
    COALESCE(di.impressions, 0) AS impressions,
    COALESCE(dc.clicks, 0) AS clicks,
    COALESCE(dcv.conversions, 0) AS conversions,
    COALESCE(ds.credits_spent, 0) AS credits_spent,
    COALESCE(ds.revenue_cents, 0) AS revenue_cents
  FROM campaign_dates cd
  LEFT JOIN daily_impressions di ON cd.campaign_id = di.campaign_id AND cd.date = di.date
  LEFT JOIN daily_clicks dc ON cd.campaign_id = dc.campaign_id AND cd.date = dc.date
  LEFT JOIN daily_conversions dcv ON cd.campaign_id = dcv.campaign_id AND cd.date = dcv.date
  LEFT JOIN daily_spend ds ON cd.campaign_id = ds.campaign_id AND cd.date = ds.date
  WHERE (
    di.impressions > 0 OR 
    dc.clicks > 0 OR 
    dcv.conversions > 0 OR 
    ds.credits_spent > 0
  )
  ORDER BY cd.date, cd.campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_campaign_analytics_daily TO authenticated;

-- =====================================================
-- 2. Creative Analytics Rollup RPC
-- =====================================================

CREATE OR REPLACE FUNCTION public.rpc_creative_analytics_rollup(
  p_org_id UUID,
  p_from TEXT,
  p_to TEXT,
  p_campaign_ids UUID[] DEFAULT NULL,
  p_creative_ids UUID[] DEFAULT NULL,
  p_include_series BOOLEAN DEFAULT FALSE,
  p_sort TEXT DEFAULT 'impressions',
  p_dir TEXT DEFAULT 'desc',
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE(
  creative_id UUID,
  campaign_id UUID,
  campaign_name TEXT,
  creative_name TEXT,
  media_url TEXT,
  impressions BIGINT,
  clicks BIGINT,
  conversions BIGINT,
  ctr NUMERIC,
  credits_spent NUMERIC,
  revenue_cents BIGINT,
  daily_series JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify user has access to this org
  IF NOT EXISTS (
    SELECT 1 FROM public.org_memberships
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH creative_stats AS (
    SELECT
      cr.id AS creative_id,
      cr.campaign_id,
      COUNT(i.id) AS impressions,
      COUNT(c.id) AS clicks,
      COUNT(cv.campaign_id) AS conversions,
      COALESCE(SUM(l.credits_charged), 0) AS credits_spent,
      COALESCE(SUM(l.rate_usd_cents * l.quantity), 0) AS revenue_cents
    FROM campaigns.ad_creatives cr
    INNER JOIN campaigns.campaigns camp ON camp.id = cr.campaign_id
    LEFT JOIN campaigns.ad_impressions i ON i.creative_id = cr.id
      AND i.created_at::date BETWEEN p_from::date AND p_to::date
    LEFT JOIN campaigns.ad_clicks c ON c.creative_id = cr.id
      AND c.created_at::date BETWEEN p_from::date AND p_to::date
    LEFT JOIN campaigns.ad_conversions cv ON cv.creative_id = cr.id
      AND cv.occurred_at::date BETWEEN p_from::date AND p_to::date
    LEFT JOIN campaigns.ad_spend_ledger l ON l.creative_id = cr.id
      AND l.occurred_at::date BETWEEN p_from::date AND p_to::date
    WHERE camp.org_id = p_org_id
      AND (p_campaign_ids IS NULL OR cr.campaign_id = ANY(p_campaign_ids))
      AND (p_creative_ids IS NULL OR cr.id = ANY(p_creative_ids))
    GROUP BY cr.id, cr.campaign_id
  ),
  daily_data AS (
    SELECT
      cr.id AS creative_id,
      i.created_at::date AS date,
      COUNT(DISTINCT i.id) AS impressions,
      COUNT(DISTINCT c.id) AS clicks,
      SUM(l.credits_charged) AS credits_spent
    FROM campaigns.ad_creatives cr
    INNER JOIN campaigns.campaigns camp ON camp.id = cr.campaign_id
    LEFT JOIN campaigns.ad_impressions i ON i.creative_id = cr.id
      AND i.created_at::date BETWEEN p_from::date AND p_to::date
    LEFT JOIN campaigns.ad_clicks c ON c.creative_id = cr.id
      AND c.created_at = i.created_at
    LEFT JOIN campaigns.ad_spend_ledger l ON l.creative_id = cr.id
      AND l.occurred_at::date = i.created_at::date
    WHERE camp.org_id = p_org_id
      AND (p_campaign_ids IS NULL OR cr.campaign_id = ANY(p_campaign_ids))
      AND (p_creative_ids IS NULL OR cr.id = ANY(p_creative_ids))
      AND p_include_series = TRUE
    GROUP BY cr.id, i.created_at::date
  )
  SELECT
    cs.creative_id,
    cs.campaign_id,
    camp.name AS campaign_name,
    cr.headline AS creative_name,
    cr.media_url,
    cs.impressions,
    cs.clicks,
    cs.conversions,
    CASE WHEN cs.impressions > 0 THEN cs.clicks::numeric / cs.impressions ELSE 0 END AS ctr,
    COALESCE(cs.credits_spent, 0) AS credits_spent,
    COALESCE(cs.revenue_cents, 0) AS revenue_cents,
    CASE 
      WHEN p_include_series THEN (
        SELECT jsonb_agg(jsonb_build_object(
          'date', dd.date,
          'impressions', dd.impressions,
          'clicks', dd.clicks,
          'credits_spent', dd.credits_spent
        ) ORDER BY dd.date)
        FROM daily_data dd
        WHERE dd.creative_id = cs.creative_id
      )
      ELSE NULL
    END AS daily_series
  FROM creative_stats cs
  INNER JOIN campaigns.ad_creatives cr ON cr.id = cs.creative_id
  INNER JOIN campaigns.campaigns camp ON camp.id = cs.campaign_id
  ORDER BY
    CASE WHEN p_sort = 'impressions' AND p_dir = 'desc' THEN cs.impressions END DESC,
    CASE WHEN p_sort = 'impressions' AND p_dir = 'asc' THEN cs.impressions END ASC,
    CASE WHEN p_sort = 'clicks' AND p_dir = 'desc' THEN cs.clicks END DESC,
    CASE WHEN p_sort = 'clicks' AND p_dir = 'asc' THEN cs.clicks END ASC,
    CASE WHEN p_sort = 'credits_spent' AND p_dir = 'desc' THEN cs.credits_spent END DESC,
    CASE WHEN p_sort = 'credits_spent' AND p_dir = 'asc' THEN cs.credits_spent END ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_creative_analytics_rollup TO authenticated;

COMMENT ON FUNCTION public.rpc_campaign_analytics_daily IS 'Returns daily analytics for campaigns with org-level access control';
COMMENT ON FUNCTION public.rpc_creative_analytics_rollup IS 'Returns creative-level analytics rollup with optional daily series';

