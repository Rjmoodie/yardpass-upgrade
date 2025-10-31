-- Check which impressions were charged vs deduplicated

SELECT 
  id,
  created_at,
  session_id,
  user_id,
  request_id,
  DATE_TRUNC('hour', created_at) AS hour_bucket
FROM campaigns.ad_impressions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY created_at DESC;

-- Check the dedup constraint
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'campaigns.ad_impressions'::regclass
  AND contype = 'u';



