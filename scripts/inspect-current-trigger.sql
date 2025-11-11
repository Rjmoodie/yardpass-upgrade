-- ============================================================================
-- Inspect Current Profile Trigger
-- ============================================================================

-- 1. Show the trigger definition
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 2. Check what function it calls
SELECT 
  tgname as trigger_name,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- 3. Check if the function exists and what it does
SELECT 
  proname as function_name,
  prosecdef as is_security_definer,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname IN (
  'handle_new_user',
  'create_user_profile',
  'auto_create_profile'
)
ORDER BY proname;

-- 4. List ALL functions that might be handling user creation
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END as security
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE 
  p.proname LIKE '%user%'
  OR p.proname LIKE '%profile%'
  OR p.proname LIKE '%new%user%'
ORDER BY schema, function_name;

-- 5. Check current RLS on user_profiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd as operation,
  CASE 
    WHEN policyname LIKE '%restrict%' THEN '🔒 May block role changes'
    WHEN policyname LIKE '%prevent%' THEN '🔒 May block client insert'
    WHEN policyname LIKE '%own%' THEN '⚠️ Check if role field is restricted'
    ELSE '❓ Unknown security level'
  END as security_assessment
FROM pg_policies
WHERE schemaname IN ('users', 'public')
  AND tablename = 'user_profiles'
ORDER BY cmd, policyname;

