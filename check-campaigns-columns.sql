-- Check campaigns.campaigns columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'campaigns' 
  AND table_name = 'campaigns'
ORDER BY ordinal_position;

-- Check if campaigns has any wallet references
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'campaigns' 
  AND table_name = 'campaigns'
  AND column_name LIKE '%wallet%';

-- Check actual campaign data
SELECT id, org_id, status
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Check if there's an org_wallets table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'org_wallets'
ORDER BY ordinal_position;

