-- Create materialized view for daily campaign analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS campaign_analytics_daily AS
SELECT 
  c.id AS campaign_id,
  c.org_id,
  DATE(i.created_at) AS date,
  COUNT(DISTINCT i.id) AS impressions,
  COUNT(DISTINCT cl.id) AS clicks,
  COUNT(DISTINCT cl.id) FILTER (WHERE cl.converted = true) AS conversions,
  COALESCE(SUM(cl.conversion_value_cents), 0) AS revenue_cents,
  COALESCE(SUM(s.credits_charged), 0) AS credits_spent
FROM campaigns c
LEFT JOIN ad_impressions i ON i.campaign_id = c.id
LEFT JOIN ad_clicks cl ON cl.campaign_id = c.id AND DATE(cl.created_at) = DATE(i.created_at)
LEFT JOIN ad_spend_ledger s ON s.campaign_id = c.id AND DATE(s.occurred_at) = DATE(i.created_at)
WHERE i.created_at IS NOT NULL
GROUP BY c.id, c.org_id, DATE(i.created_at)
ORDER BY c.id, DATE(i.created_at) DESC;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_daily_org_date 
ON campaign_analytics_daily(org_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_analytics_daily_campaign 
ON campaign_analytics_daily(campaign_id, date DESC);

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_campaign_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW campaign_analytics_daily;
END;
$$;

-- Enable RLS on the materialized view (if supported)
-- Note: Materialized views inherit policies from base tables in most cases
COMMENT ON MATERIALIZED VIEW campaign_analytics_daily IS 'Daily aggregated campaign analytics for impressions, clicks, conversions, and spend';