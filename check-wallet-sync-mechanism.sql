-- Check if there's a trigger or function that syncs wallet with campaign spending

-- 1. Check for triggers on ad_spend_ledger
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'campaigns'
  AND event_object_table = 'ad_spend_ledger';

-- 2. Check for triggers on campaigns table
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'campaigns'
  AND event_object_table = 'campaigns';

-- 3. Check if there's a function to deduct from wallet
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%wallet%'
  AND routine_name LIKE '%deduct%';

-- 4. Check current wallet balance
SELECT 
  id,
  org_id,
  balance_credits,
  updated_at
FROM public.org_wallets
WHERE id = 'db7dca8a-fc56-452d-8a57-53880b93131b';

