-- =====================================================
-- SPONSORSHIP SYSTEM: CLEANUP & CONSTRAINTS
-- =====================================================
-- This migration adds critical constraints, normalizes data types,
-- and improves data integrity across the sponsorship system

-- =====================================================
-- 1. NORMALIZE CURRENCIES (ISO UPPERCASE)
-- =====================================================

-- Update sponsorship_packages currency default
ALTER TABLE public.sponsorship_packages
  ALTER COLUMN currency SET DEFAULT 'USD';

-- Add currency check constraint to sponsorship_packages
ALTER TABLE public.sponsorship_packages
  ADD CONSTRAINT sponsorship_packages_currency_chk
  CHECK (currency IN ('USD', 'EUR', 'GBP', 'CAD'));

-- Add currency check constraint to ticket_tiers
ALTER TABLE public.ticket_tiers
  ADD CONSTRAINT ticket_tiers_currency_chk
  CHECK (currency IN ('USD', 'EUR', 'GBP', 'CAD'));

-- Update existing lowercase 'usd' to uppercase 'USD' (if any)
UPDATE public.sponsorship_packages SET currency = 'USD' WHERE currency = 'usd';
UPDATE public.sponsorship_orders SET currency = 'USD' WHERE currency = 'usd';

-- =====================================================
-- 2. MAKE MATCHES IDEMPOTENT (UNIQUE PAIR)
-- =====================================================

-- Add unique constraint on event_id + sponsor_id pair
ALTER TABLE public.sponsorship_matches
  ADD CONSTRAINT sponsorship_matches_event_sponsor_unique 
  UNIQUE (event_id, sponsor_id);

-- Add score bounds check (0 to 1)
ALTER TABLE public.sponsorship_matches
  ADD CONSTRAINT sponsorship_matches_score_chk 
  CHECK (score >= 0::numeric AND score <= 1::numeric);

-- =====================================================
-- 3. PACKAGE UNIQUENESS PER EVENT
-- =====================================================

-- Ensure one package per tier per event (prevents duplicates)
ALTER TABLE public.sponsorship_packages
  ADD CONSTRAINT sponsorship_packages_event_tier_unique 
  UNIQUE (event_id, tier);

-- =====================================================
-- 4. VECTOR COLUMNS (ALREADY DONE IN PREVIOUS MIGRATION)
-- =====================================================

-- Note: Vector columns and indexes were already created in
-- 20251022_0001_optimized_sponsorship_system.sql
-- This section is here for reference only

-- =====================================================
-- 5. ON DELETE CASCADE (PREVENT ORPHANS)
-- =====================================================

-- Sponsorship packages: cascade delete when event is deleted
ALTER TABLE public.sponsorship_packages
  DROP CONSTRAINT IF EXISTS sponsorship_packages_event_id_fkey,
  ADD CONSTRAINT sponsorship_packages_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Sponsorship matches: cascade delete when event is deleted
ALTER TABLE public.sponsorship_matches
  DROP CONSTRAINT IF EXISTS sponsorship_matches_event_id_fkey,
  ADD CONSTRAINT sponsorship_matches_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Sponsorship orders: cascade delete when event is deleted
ALTER TABLE public.sponsorship_orders
  DROP CONSTRAINT IF EXISTS sponsorship_orders_event_id_fkey,
  ADD CONSTRAINT sponsorship_orders_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Event audience insights: cascade delete when event is deleted
ALTER TABLE public.event_audience_insights
  DROP CONSTRAINT IF EXISTS event_audience_insights_event_id_fkey,
  ADD CONSTRAINT event_audience_insights_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Event stat snapshots: cascade delete when event is deleted
ALTER TABLE public.event_stat_snapshots
  DROP CONSTRAINT IF EXISTS event_stat_snapshots_event_id_fkey,
  ADD CONSTRAINT event_stat_snapshots_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Event sponsorships: cascade delete when event is deleted
ALTER TABLE public.event_sponsorships
  DROP CONSTRAINT IF EXISTS event_sponsorships_event_id_fkey,
  ADD CONSTRAINT event_sponsorships_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- =====================================================
-- 6. PERFORMANCE INDEXES
-- =====================================================

-- Marketplace filter indexes
CREATE INDEX IF NOT EXISTS idx_pkg_active_vis_price 
  ON public.sponsorship_packages (is_active, visibility, price_cents)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_pkg_event 
  ON public.sponsorship_packages (event_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_pkg_tier 
  ON public.sponsorship_packages (tier, is_active);

-- Match feed indexes
CREATE INDEX IF NOT EXISTS idx_match_event_score 
  ON public.sponsorship_matches (event_id, score DESC)
  WHERE score >= 0.5;

CREATE INDEX IF NOT EXISTS idx_match_sponsor_score 
  ON public.sponsorship_matches (sponsor_id, score DESC)
  WHERE score >= 0.5;

CREATE INDEX IF NOT EXISTS idx_match_status_updated 
  ON public.sponsorship_matches (status, updated_at DESC);

-- Profile indexes for faceting
CREATE INDEX IF NOT EXISTS idx_sp_profile_industry_size 
  ON public.sponsor_profiles (industry, company_size);

CREATE INDEX IF NOT EXISTS idx_sp_profile_categories 
  ON public.sponsor_profiles USING gin (preferred_categories)
  WHERE preferred_categories IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sp_profile_regions 
  ON public.sponsor_profiles USING gin (regions)
  WHERE regions IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sp_profile_budget 
  ON public.sponsor_profiles (annual_budget_cents DESC NULLS LAST)
  WHERE annual_budget_cents IS NOT NULL;

-- Order indexes
CREATE INDEX IF NOT EXISTS idx_sponsorship_orders_event 
  ON public.sponsorship_orders (event_id, status);

CREATE INDEX IF NOT EXISTS idx_sponsorship_orders_sponsor 
  ON public.sponsorship_orders (sponsor_id, status);

CREATE INDEX IF NOT EXISTS idx_sponsorship_orders_status_created 
  ON public.sponsorship_orders (status, created_at DESC);

-- =====================================================
-- 7. MONEY TYPE CONSTRAINTS
-- =====================================================

-- Ensure all money fields are non-negative
ALTER TABLE public.sponsorship_packages
  ADD CONSTRAINT sponsorship_packages_price_positive 
  CHECK (price_cents >= 0);

ALTER TABLE public.sponsorship_orders
  ADD CONSTRAINT sponsorship_orders_amount_positive 
  CHECK (amount_cents >= 0);

ALTER TABLE public.event_sponsorships
  ADD CONSTRAINT event_sponsorships_amount_positive 
  CHECK (amount_cents >= 0);

-- =====================================================
-- 8. ADDITIONAL DATA INTEGRITY CONSTRAINTS
-- =====================================================

-- Inventory constraints
ALTER TABLE public.sponsorship_packages
  ADD CONSTRAINT sponsorship_packages_inventory_positive 
  CHECK (inventory >= 0);

ALTER TABLE public.sponsorship_packages
  ADD CONSTRAINT sponsorship_packages_sold_valid 
  CHECK (sold >= 0 AND sold <= inventory);

-- Quality score constraints
ALTER TABLE public.sponsorship_packages
  ADD CONSTRAINT sponsorship_packages_quality_valid 
  CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100));

-- Expected reach constraint
ALTER TABLE public.sponsorship_packages
  ADD CONSTRAINT sponsorship_packages_reach_positive 
  CHECK (expected_reach IS NULL OR expected_reach >= 0);

-- Budget constraints
ALTER TABLE public.sponsor_profiles
  ADD CONSTRAINT sponsor_profiles_budget_positive 
  CHECK (annual_budget_cents IS NULL OR annual_budget_cents >= 0);

-- =====================================================
-- 9. FIT_RECALC_QUEUE IMPROVEMENTS
-- =====================================================

-- Add index for unprocessed queue items
CREATE INDEX IF NOT EXISTS idx_fit_recalc_queue_unprocessed 
  ON public.fit_recalc_queue (queued_at)
  WHERE processed_at IS NULL;

-- Add index for processing by reason
CREATE INDEX IF NOT EXISTS idx_fit_recalc_queue_reason 
  ON public.fit_recalc_queue (reason, queued_at)
  WHERE processed_at IS NULL;

-- =====================================================
-- 10. PAYOUT SYSTEM CONSTRAINTS
-- =====================================================

-- Payout amount constraints
ALTER TABLE public.sponsorship_payouts
  ADD CONSTRAINT sponsorship_payouts_amount_positive 
  CHECK (amount_cents > 0);

ALTER TABLE public.sponsorship_payouts
  ADD CONSTRAINT sponsorship_payouts_fee_valid 
  CHECK (application_fee_cents >= 0 AND application_fee_cents < amount_cents);

-- Payout configuration constraints
ALTER TABLE public.payout_configurations
  ADD CONSTRAINT payout_configurations_fee_valid 
  CHECK (platform_fee_percentage >= 0 AND platform_fee_percentage <= 1);

ALTER TABLE public.payout_configurations
  ADD CONSTRAINT payout_configurations_min_payout_positive 
  CHECK (minimum_payout_amount_cents > 0);

-- =====================================================
-- 11. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON CONSTRAINT sponsorship_matches_event_sponsor_unique ON public.sponsorship_matches 
  IS 'Ensures one match score per event-sponsor pair for idempotency';

COMMENT ON CONSTRAINT sponsorship_matches_score_chk ON public.sponsorship_matches 
  IS 'Match scores must be between 0 and 1';

COMMENT ON CONSTRAINT sponsorship_packages_event_tier_unique ON public.sponsorship_packages 
  IS 'Ensures one package per tier per event to prevent duplicates';

COMMENT ON CONSTRAINT sponsorship_packages_currency_chk ON public.sponsorship_packages 
  IS 'Enforces ISO currency codes (uppercase)';

-- Note: COMMENT ON INDEX uses just the index name, not the table
COMMENT ON INDEX idx_pkg_active_vis_price 
  IS 'Optimizes marketplace filtering by status, visibility, and price';

COMMENT ON INDEX idx_match_event_score 
  IS 'Optimizes sponsor recommendations for events';

COMMENT ON INDEX idx_match_sponsor_score 
  IS 'Optimizes event recommendations for sponsors';

-- =====================================================
-- 12. VALIDATION FUNCTION
-- =====================================================

-- Helper function to validate sponsorship data integrity
CREATE OR REPLACE FUNCTION public.validate_sponsorship_data()
RETURNS TABLE (
  check_name text,
  status text,
  details text
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check for duplicate matches
  RETURN QUERY
  SELECT 
    'duplicate_matches'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'Found ' || COUNT(*)::text || ' duplicate event-sponsor pairs'
  FROM (
    SELECT event_id, sponsor_id, COUNT(*) as cnt
    FROM public.sponsorship_matches
    GROUP BY event_id, sponsor_id
    HAVING COUNT(*) > 1
  ) dups;

  -- Check for invalid currencies
  RETURN QUERY
  SELECT 
    'invalid_currencies'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'Found ' || COUNT(*)::text || ' packages with invalid currency'
  FROM public.sponsorship_packages
  WHERE currency NOT IN ('USD', 'EUR', 'GBP', 'CAD');

  -- Check for oversold packages
  RETURN QUERY
  SELECT 
    'oversold_packages'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'Found ' || COUNT(*)::text || ' packages with sold > inventory'
  FROM public.sponsorship_packages
  WHERE sold > inventory;

  -- Check for invalid scores
  RETURN QUERY
  SELECT 
    'invalid_scores'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'Found ' || COUNT(*)::text || ' matches with scores outside 0-1 range'
  FROM public.sponsorship_matches
  WHERE score < 0 OR score > 1;

  -- Check for orphaned matches (no event)
  RETURN QUERY
  SELECT 
    'orphaned_matches'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'Found ' || COUNT(*)::text || ' matches with missing events'
  FROM public.sponsorship_matches m
  WHERE NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = m.event_id);

  -- Check for orphaned packages (no event)
  RETURN QUERY
  SELECT 
    'orphaned_packages'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'Found ' || COUNT(*)::text || ' packages with missing events'
  FROM public.sponsorship_packages p
  WHERE NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = p.event_id);
END $$;

COMMENT ON FUNCTION public.validate_sponsorship_data() 
  IS 'Validates data integrity across sponsorship system';

-- =====================================================
-- 13. GRANT PERMISSIONS
-- =====================================================

-- Grant execute on validation function
GRANT EXECUTE ON FUNCTION public.validate_sponsorship_data() TO authenticated;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
