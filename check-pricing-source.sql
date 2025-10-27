-- Check ad_creatives table columns first
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'campaigns' 
  AND table_name = 'ad_creatives'
ORDER BY ordinal_position;

-- Check ad_creatives data (any columns)
SELECT *
FROM campaigns.ad_creatives
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
LIMIT 1;

-- Check if there's a pricing matrix
SELECT * FROM campaigns.ad_pricing_matrix LIMIT 5;

-- Check all campaigns columns to see what exists
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'campaigns' 
  AND table_name = 'campaigns'
ORDER BY ordinal_position;

