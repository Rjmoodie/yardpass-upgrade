-- Fix public.ticket_tiers view to include missing columns
-- Issue: View was created before fee_bearer, tier_visibility, requires_tier_id were added

-- Drop and recreate the view with all columns
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
  fee_bearer,           -- NEW
  tier_visibility,      -- NEW
  requires_tier_id      -- NEW
FROM ticketing.ticket_tiers;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_tiers TO authenticated;
GRANT SELECT ON public.ticket_tiers TO anon;
GRANT ALL ON public.ticket_tiers TO service_role;

COMMENT ON VIEW public.ticket_tiers IS 'View of ticketing.ticket_tiers with all columns including fee_bearer, tier_visibility, requires_tier_id';





