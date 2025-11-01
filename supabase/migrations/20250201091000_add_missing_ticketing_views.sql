-- ============================================================================
-- Add Missing Public Views for Ticketing & Events Tables
-- ============================================================================
-- Exposes ticketing and events tables via public schema views for API access
-- ============================================================================

-- ============================================================================
-- Ticketing Schema Views
-- ============================================================================

-- Scan Logs View
DROP VIEW IF EXISTS public.scan_logs CASCADE;

CREATE VIEW public.scan_logs AS
SELECT 
  id,
  event_id,
  ticket_id,
  scanner_user_id,
  result,
  details,
  created_at
FROM ticketing.scan_logs;

COMMENT ON VIEW public.scan_logs IS 'Public view of ticket scan logs';

GRANT SELECT ON public.scan_logs TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.scan_logs TO authenticated;

-- Refunds View
DROP VIEW IF EXISTS public.refunds CASCADE;

CREATE VIEW public.refunds AS
SELECT 
  id,
  order_id,
  amount_cents,
  reason,
  created_by,
  created_at
FROM ticketing.refunds;

COMMENT ON VIEW public.refunds IS 'Public view of order refunds';

GRANT SELECT ON public.refunds TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.refunds TO authenticated;

-- Guest Codes View
DROP VIEW IF EXISTS public.guest_codes CASCADE;

CREATE VIEW public.guest_codes AS
SELECT 
  id,
  event_id,
  tier_id,
  code,
  max_uses,
  used_count,
  expires_at,
  notes,
  created_by,
  created_at
FROM ticketing.guest_codes;

COMMENT ON VIEW public.guest_codes IS 'Public view of guest codes for events';

GRANT SELECT ON public.guest_codes TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.guest_codes TO authenticated;

-- ============================================================================
-- Events Schema Views
-- ============================================================================

-- Event Invites View
DROP VIEW IF EXISTS public.event_invites CASCADE;

CREATE VIEW public.event_invites AS
SELECT 
  event_id,
  user_id,
  email,
  role,
  created_at
FROM events.event_invites;

COMMENT ON VIEW public.event_invites IS 'Public view of event invitations';

GRANT SELECT ON public.event_invites TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.event_invites TO authenticated;

-- Event Sponsorships View
-- The actual table is in sponsorship schema, create alias to marketplace view
DROP VIEW IF EXISTS public.event_sponsorships CASCADE;

CREATE VIEW public.event_sponsorships AS
SELECT 
  package_id as id,
  event_id,
  tier,
  price_cents,
  inventory,
  benefits,
  event_title,
  city,
  category,
  start_at,
  NULL::uuid as sponsor_id,
  NULL::text as status,
  NULL::timestamptz as created_at
FROM public.marketplace_sponsorships;

COMMENT ON VIEW public.event_sponsorships IS 'Alias for marketplace_sponsorships (backward compatibility)';

GRANT SELECT ON public.event_sponsorships TO authenticated, anon;

-- ============================================================================
-- Sponsorship Schema Views
-- ============================================================================

-- Sponsorship Packages View
-- Direct exposure of sponsorship.sponsorship_packages to preserve foreign key relationships
DROP VIEW IF EXISTS public.sponsorship_packages CASCADE;

CREATE VIEW public.sponsorship_packages AS
SELECT * FROM sponsorship.sponsorship_packages;

COMMENT ON VIEW public.sponsorship_packages IS 'Public view of sponsorship packages with preserved relationships';

GRANT SELECT ON public.sponsorship_packages TO authenticated, anon;
GRANT SELECT ON sponsorship.sponsorship_packages TO authenticated, anon;

-- Sponsorship Orders View
-- Direct exposure of sponsorship.sponsorship_orders to preserve foreign key relationships
DROP VIEW IF EXISTS public.sponsorship_orders CASCADE;

CREATE VIEW public.sponsorship_orders AS
SELECT * FROM sponsorship.sponsorship_orders;

COMMENT ON VIEW public.sponsorship_orders IS 'Public view of sponsorship orders with preserved relationships';

GRANT SELECT ON public.sponsorship_orders TO authenticated, anon;
GRANT SELECT ON sponsorship.sponsorship_orders TO authenticated, anon;

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Grant on underlying ticketing tables (if not already granted)
GRANT SELECT ON ticketing.scan_logs TO authenticated, anon;
GRANT SELECT ON ticketing.refunds TO authenticated, anon;
GRANT SELECT ON ticketing.guest_codes TO authenticated, anon;

-- Grant on underlying events tables (if not already granted)
GRANT SELECT ON events.event_invites TO authenticated, anon;

-- Note: sponsorship tables grants are handled above

