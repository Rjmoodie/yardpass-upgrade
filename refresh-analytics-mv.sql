-- ========================================
-- REFRESH MATERIALIZED VIEW
-- ========================================
-- This will update the cached data in analytics_campaign_daily_mv
-- with the latest data from the fixed analytics_campaign_daily view

-- Refresh the materialized view (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'analytics_campaign_daily_mv') THEN
        REFRESH MATERIALIZED VIEW analytics_campaign_daily_mv;
        RAISE NOTICE '✅ Refreshed analytics_campaign_daily_mv';
    ELSE
        RAISE NOTICE '⚠️  analytics_campaign_daily_mv does not exist';
    END IF;
END $$;

-- Verify the refreshed data
SELECT 
  day,
  impressions,
  clicks,
  spend_credits,
  ctr,
  cpm,
  cpc
FROM analytics_campaign_daily_mv
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY day DESC
LIMIT 10;

