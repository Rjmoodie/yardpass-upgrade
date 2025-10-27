-- Check the actual foreign key constraint
SELECT
  tc.constraint_name, 
  tc.table_schema,
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
  AND tc.table_name = 'ad_spend_ledger'
  AND kcu.column_name = 'wallet_id';

-- Check what wallet tables exist
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name LIKE '%wallet%'
ORDER BY table_schema, table_name;

-- Check the org_id for the test campaign
SELECT id, org_id
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Check if that org has a wallet in organizations.org_wallets
SELECT w.id as wallet_id, w.org_id, w.status
FROM campaigns.campaigns c
JOIN organizations.org_wallets w ON w.org_id = c.org_id
WHERE c.id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

