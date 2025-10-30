-- Check if there's a conversion with $1000 value
SELECT 
  campaign_id,
  value_cents,
  occurred_at,
  attribution_model,
  click_id,
  impression_id
FROM campaigns.ad_conversions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
  OR value_cents = 100000  -- $1000
ORDER BY occurred_at DESC;

-- Check ALL conversions in the system with $1000 value
SELECT 
  campaign_id,
  value_cents,
  occurred_at
FROM campaigns.ad_conversions
WHERE value_cents = 100000
LIMIT 10;

