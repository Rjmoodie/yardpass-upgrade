-- ============================================================
-- Fix public.ticket_tiers view - Final Version
-- ============================================================
-- Issue: Latest migration (20251111000007) recreated view with wrong column names
--        AND is missing is_rsvp_only column
-- Fix: Recreate view with correct column names matching actual table schema
-- ============================================================

-- Step 1: Ensure is_rsvp_only column exists in base table
ALTER TABLE ticketing.ticket_tiers 
ADD COLUMN IF NOT EXISTS is_rsvp_only boolean DEFAULT false;

COMMENT ON COLUMN ticketing.ticket_tiers.is_rsvp_only IS 
'If true, this is an RSVP-only tier (no tickets issued, just headcount tracking). Typically used for free tiers.';

-- Step 2: Drop and recreate the view with CORRECT column names AND is_rsvp_only
DROP VIEW IF EXISTS public.ticket_tiers CASCADE;

CREATE VIEW public.ticket_tiers
WITH (security_invoker=false)
AS
SELECT 
  id,
  event_id,
  name,
  badge_label,
  price_cents,
  currency,
  quantity,
  max_per_order,
  sales_start,          -- ✅ Correct name (not sale_starts_at)
  sales_end,            -- ✅ Correct name (not sale_ends_at)
  status,               -- ✅ Correct name (not is_hidden)
  sort_index,           -- ✅ Correct name (not display_order)
  created_at,
  total_quantity,
  sold_quantity,        -- ✅ Correct name (not quantity_sold)
  reserved_quantity,
  issued_quantity,
  fee_bearer,
  tier_visibility,      -- ✅ Correct name (not is_hidden)
  requires_tier_id,
  is_rsvp_only          -- ✅ Added: RSVP-only flag for free tiers
FROM ticketing.ticket_tiers;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_tiers TO authenticated;
GRANT SELECT ON public.ticket_tiers TO anon;
GRANT ALL ON public.ticket_tiers TO service_role;

COMMENT ON VIEW public.ticket_tiers IS 
'View of ticketing.ticket_tiers with all columns including fee_bearer, tier_visibility, requires_tier_id, and is_rsvp_only. Corrected column names to match actual table schema.';

-- ============================================================
-- Migration Complete
-- ============================================================
-- The public.ticket_tiers view now:
-- 1. Uses correct column names matching ticketing.ticket_tiers table
-- 2. Includes is_rsvp_only column
-- 3. Has proper grants for authenticated users and service_role

