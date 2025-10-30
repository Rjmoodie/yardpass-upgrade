-- Verify get_campaign_for_ai RPC exists
SELECT 
  proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE proname = 'get_campaign_for_ai'
  AND n.nspname = 'public';

-- Test it with your campaign ID
SELECT * FROM public.get_campaign_for_ai('3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec');

