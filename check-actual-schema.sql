-- Check actual columns in campaigns.campaigns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'campaigns' 
  AND table_name = 'campaigns'
ORDER BY ordinal_position;

-- Check actual columns in campaigns.ad_spend_ledger  
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'campaigns' 
  AND table_name = 'ad_spend_ledger'
ORDER BY ordinal_position;

