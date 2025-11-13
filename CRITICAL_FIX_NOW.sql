-- ============================================================================
-- CRITICAL FIX - Run This IMMEDIATELY in Supabase SQL Editor
-- ============================================================================
-- This fixes TWO issues:
-- 1. Missing claim_order_ticketing function (causing silent crashes)
-- 2. Missing service_role grants on views (preventing INSERT/UPDATE)
-- ============================================================================

-- STEP 1: Create missing claim_order_ticketing function
-- (This is why ensure-tickets crashes after "[ENSURE-TICKETS] start")
CREATE OR REPLACE FUNCTION public.claim_order_ticketing(p_order_id UUID)
RETURNS boolean
LANGUAGE sql
AS $$
  SELECT pg_try_advisory_xact_lock(
    ('x' || substr(replace($1::text,'-',''),1,8))::bit(32)::int,
    ('x' || substr(replace($1::text,'-',''),9,8))::bit(32)::int
  );
$$;

GRANT EXECUTE ON FUNCTION public.claim_order_ticketing(UUID) TO service_role, authenticated, anon;

-- STEP 2: Grant service_role permissions on ALL ticketing views
-- (This allows Edge Functions to INSERT/UPDATE through views)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_tiers TO service_role;

-- STEP 3: Grant on underlying ticketing tables (belt and suspenders)
GRANT SELECT, INSERT, UPDATE, DELETE ON ticketing.tickets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ticketing.orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ticketing.order_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ticketing.ticket_tiers TO service_role;

-- STEP 4: Verify functions exist
SELECT 
  proname as function_name,
  'EXISTS ✅' as status
FROM pg_proc 
WHERE proname IN ('claim_order_ticketing', 'gen_qr_code')
ORDER BY proname;

-- Expected output:
-- claim_order_ticketing | EXISTS ✅
-- gen_qr_code           | EXISTS ✅

-- STEP 5: Verify grants exist
SELECT 
  grantee,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_name IN ('tickets', 'orders')
  AND table_schema = 'public'
  AND grantee = 'service_role'
ORDER BY table_name, privilege_type;

-- Expected output should include:
-- service_role | tickets | SELECT
-- service_role | tickets | INSERT
-- service_role | tickets | UPDATE
-- service_role | tickets | DELETE
-- (same for orders)

-- ============================================================================
-- After running this SQL, deploy the functions:
-- ============================================================================
-- supabase functions deploy ensure-tickets --no-verify-jwt --project-ref yieslxnrfeqchbcmgavz
-- supabase functions deploy process-payment --no-verify-jwt --project-ref yieslxnrfeqchbcmgavz
-- ============================================================================


