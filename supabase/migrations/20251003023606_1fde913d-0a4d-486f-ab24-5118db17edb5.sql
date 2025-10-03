
-- Create base campaign analytics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS campaign_analytics_daily AS
SELECT * FROM campaign_analytics_daily_secured;

-- Create base creative analytics materialized view  
CREATE MATERIALIZED VIEW IF NOT EXISTS creative_analytics_daily AS
SELECT * FROM creative_analytics_daily_secured;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cad_campaign_date ON campaign_analytics_daily(campaign_id, date);
CREATE INDEX IF NOT EXISTS idx_cad_org_date ON campaign_analytics_daily(org_id, date);
CREATE INDEX IF NOT EXISTS idx_crad_creative_date ON creative_analytics_daily(creative_id, date);
CREATE INDEX IF NOT EXISTS idx_crad_campaign_date ON creative_analytics_daily(campaign_id, date);

-- Grant access
GRANT SELECT ON campaign_analytics_daily TO authenticated;
GRANT SELECT ON creative_analytics_daily TO authenticated;
