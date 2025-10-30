-- Check what the RPC returns for revenue_cents
SELECT *
FROM rpc_campaign_analytics_daily(
  'cea0a26d-2a3b-49a1-ad64-e38f80abeab9',  -- org_id
  '2025-10-12',  -- from (14 days ago)
  '2025-10-30',  -- to
  NULL  -- all campaigns
)
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
LIMIT 10;

