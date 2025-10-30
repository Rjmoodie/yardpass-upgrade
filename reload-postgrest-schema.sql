-- Reload PostgREST schema cache so it can see the new functions

-- First, verify the functions exist
SELECT 
  p.proname AS function_name,
  n.nspname AS schema_name,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('log_ai_recommendation', 'mark_ai_rec_applied')
  AND n.nspname = 'public';

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Alternative: Update a config to force reload
-- This tells Supabase's PostgREST instance to refresh
SELECT set_config('request.jwt.claims', '{}', true);

