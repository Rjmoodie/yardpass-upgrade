-- ============================================================
-- CHECK: is_event_manager Function Definition
-- ============================================================

-- Get the full function definition
SELECT 
  routine_name,
  routine_schema,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'is_event_manager';

-- Alternative way if above doesn't show full definition
SELECT 
  pg_get_functiondef(oid) as full_function_definition
FROM pg_proc
WHERE proname = 'is_event_manager'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

