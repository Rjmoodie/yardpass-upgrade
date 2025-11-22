-- ============================================================
-- Fix public.ticket_tiers view to include is_rsvp_only column
-- ============================================================
-- Issue: The view was recreated in 20250207000001 without is_rsvp_only
--        The column may not exist in ticketing.ticket_tiers table yet
-- ============================================================

-- Step 1: Add is_rsvp_only column to ticketing.ticket_tiers if it doesn't exist
ALTER TABLE ticketing.ticket_tiers 
ADD COLUMN IF NOT EXISTS is_rsvp_only boolean DEFAULT false;

COMMENT ON COLUMN ticketing.ticket_tiers.is_rsvp_only IS 
'If true, this is an RSVP-only tier (no tickets issued, just headcount tracking). Typically used for free tiers.';

-- Step 2: Drop and recreate the view with all columns including is_rsvp_only
DROP VIEW IF EXISTS public.ticket_tiers CASCADE;

CREATE VIEW public.ticket_tiers AS
SELECT 
  id,
  event_id,
  name,
  badge_label,
  price_cents,
  currency,
  quantity,
  max_per_order,
  sales_start,
  sales_end,
  status,
  sort_index,
  created_at,
  total_quantity,
  sold_quantity,
  reserved_quantity,
  issued_quantity,
  fee_bearer,
  tier_visibility,
  requires_tier_id,
  is_rsvp_only          -- ✅ Added: RSVP-only flag for free tiers
FROM ticketing.ticket_tiers;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_tiers TO authenticated;
GRANT SELECT ON public.ticket_tiers TO anon;
GRANT ALL ON public.ticket_tiers TO service_role;

COMMENT ON VIEW public.ticket_tiers IS 'View of ticketing.ticket_tiers with all columns including fee_bearer, tier_visibility, requires_tier_id, and is_rsvp_only';

-- ============================================================
-- Migration Complete
-- ============================================================
-- The public.ticket_tiers view now includes is_rsvp_only column
-- This allows frontend and Edge Functions to access the RSVP flag

