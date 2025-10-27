-- Find all wallet-related tables
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name LIKE '%wallet%'
ORDER BY table_schema, table_name;

-- Check the foreign key on wallet_id
SELECT
  tc.constraint_name, 
  kcu.column_name, 
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'campaigns'
  AND tc.table_name = 'ad_spend_ledger'
  AND kcu.column_name = 'wallet_id';

-- Check if wallet_id can be made nullable
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'campaigns'
  AND table_name = 'ad_spend_ledger'
  AND column_name IN ('wallet_id', 'org_wallet_id');

