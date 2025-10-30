-- Check the analytics RPC to see what revenue it returns
SELECT 
  campaign_id,
  day,
  impressions,
  clicks,
  conversions,
  revenue_cents,
  credits_spent
FROM rpc_campaign_analytics_daily(
  ARRAY['3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec']::UUID[],
  (CURRENT_DATE - INTERVAL '14 days')::DATE,
  CURRENT_DATE::DATE,
  (SELECT org_id FROM campaigns.campaigns WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec')
)
ORDER BY day DESC;

