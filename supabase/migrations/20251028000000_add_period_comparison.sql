-- Add period-over-period comparison RPC
-- This allows showing "▲ 15% vs previous period" on KPI cards

CREATE OR REPLACE FUNCTION public.get_campaign_kpis_comparison(
  p_campaign_id UUID,
  p_days INT DEFAULT 7
) RETURNS TABLE (
  metric TEXT,
  current_value NUMERIC,
  previous_value NUMERIC,
  change_pct NUMERIC
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  WITH current_period AS (
    SELECT 
      SUM(impressions)::NUMERIC AS impressions,
      SUM(clicks)::NUMERIC AS clicks,
      SUM(conversions)::NUMERIC AS conversions,
      SUM(spend_credits)::NUMERIC AS spend,
      SUM(COALESCE(value_cents, 0))::NUMERIC / 100.0 AS revenue
    FROM public.analytics_campaign_daily_mv
    WHERE campaign_id = p_campaign_id
      AND day >= CURRENT_DATE - (p_days - 1)
  ),
  previous_period AS (
    SELECT 
      SUM(impressions)::NUMERIC AS impressions,
      SUM(clicks)::NUMERIC AS clicks,
      SUM(conversions)::NUMERIC AS conversions,
      SUM(spend_credits)::NUMERIC AS spend,
      SUM(COALESCE(value_cents, 0))::NUMERIC / 100.0 AS revenue
    FROM public.analytics_campaign_daily_mv
    WHERE campaign_id = p_campaign_id
      AND day >= CURRENT_DATE - (p_days * 2 - 1)
      AND day < CURRENT_DATE - p_days
  )
  SELECT 'impressions'::TEXT, 
         COALESCE(c.impressions, 0), 
         COALESCE(p.impressions, 0), 
         CASE WHEN COALESCE(p.impressions, 0) > 0 
              THEN ((COALESCE(c.impressions, 0) - COALESCE(p.impressions, 0)) / p.impressions * 100) 
              ELSE 0 
         END
  FROM current_period c, previous_period p
  UNION ALL
  SELECT 'clicks'::TEXT, 
         COALESCE(c.clicks, 0), 
         COALESCE(p.clicks, 0),
         CASE WHEN COALESCE(p.clicks, 0) > 0 
              THEN ((COALESCE(c.clicks, 0) - COALESCE(p.clicks, 0)) / p.clicks * 100) 
              ELSE 0 
         END
  FROM current_period c, previous_period p
  UNION ALL
  SELECT 'conversions'::TEXT, 
         COALESCE(c.conversions, 0), 
         COALESCE(p.conversions, 0),
         CASE WHEN COALESCE(p.conversions, 0) > 0 
              THEN ((COALESCE(c.conversions, 0) - COALESCE(p.conversions, 0)) / p.conversions * 100) 
              ELSE 0 
         END
  FROM current_period c, previous_period p
  UNION ALL
  SELECT 'spend'::TEXT, 
         COALESCE(c.spend, 0), 
         COALESCE(p.spend, 0),
         CASE WHEN COALESCE(p.spend, 0) > 0 
              THEN ((COALESCE(c.spend, 0) - COALESCE(p.spend, 0)) / p.spend * 100) 
              ELSE 0 
         END
  FROM current_period c, previous_period p
  UNION ALL
  SELECT 'revenue'::TEXT, 
         COALESCE(c.revenue, 0), 
         COALESCE(p.revenue, 0),
         CASE WHEN COALESCE(p.revenue, 0) > 0 
              THEN ((COALESCE(c.revenue, 0) - COALESCE(p.revenue, 0)) / p.revenue * 100) 
              ELSE 0 
         END
  FROM current_period c, previous_period p;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_campaign_kpis_comparison(UUID, INT) TO anon, authenticated;

-- Test query (optional)
-- SELECT * FROM public.get_campaign_kpis_comparison('3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec', 7);


