-- Check campaigns.campaigns table schema
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'campaigns' 
  AND table_name = 'campaigns'
ORDER BY ordinal_position;

-- Check campaigns.ad_spend_ledger schema
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'campaigns' 
  AND table_name = 'ad_spend_ledger'
ORDER BY ordinal_position;

-- Check if there's a relationship to wallets
SELECT 
  tc.table_schema, 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'campaigns'
  AND (tc.table_name = 'campaigns' OR tc.table_name = 'ad_spend_ledger');

-- Check actual campaign data
SELECT 
  id,
  name,
  organization_id,
  status
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

