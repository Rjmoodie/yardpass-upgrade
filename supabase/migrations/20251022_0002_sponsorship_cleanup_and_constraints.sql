-- =====================================================
-- SPONSORSHIP SYSTEM: CLEANUP & CONSTRAINTS
-- =====================================================
-- This migration adds critical constraints, normalizes data types,
-- and improves data integrity across the sponsorship system

-- =====================================================
-- 1. NORMALIZE CURRENCIES (ISO UPPERCASE)
-- =====================================================

-- Note: sponsorship_packages is a view, cannot alter
-- Skip package currency constraints

-- Add currency check constraint to ticket_tiers (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_tiers_currency_chk'
  ) THEN
    ALTER TABLE public.ticket_tiers
      ADD CONSTRAINT ticket_tiers_currency_chk
      CHECK (currency IN ('USD', 'EUR', 'GBP', 'CAD'));
  END IF;
END $$;

-- Note: sponsorship_packages and sponsorship_orders are views, cannot update
-- Skip currency updates

-- =====================================================
-- 2. MAKE MATCHES IDEMPOTENT (UNIQUE PAIR)
-- =====================================================

-- Add unique constraint on event_id + sponsor_id pair (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sponsorship_matches_event_sponsor_unique'
  ) THEN
    ALTER TABLE public.sponsorship_matches
      ADD CONSTRAINT sponsorship_matches_event_sponsor_unique 
      UNIQUE (event_id, sponsor_id);
  END IF;
END $$;

-- Add score bounds check (0 to 1) (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sponsorship_matches_score_chk'
  ) THEN
    ALTER TABLE public.sponsorship_matches
      ADD CONSTRAINT sponsorship_matches_score_chk 
      CHECK (score >= 0::numeric AND score <= 1::numeric);
  END IF;
END $$;

-- =====================================================
-- 3. PACKAGE UNIQUENESS PER EVENT
-- =====================================================

-- Note: sponsorship_packages is a view, cannot add constraints
-- Skip tier uniqueness constraint

-- =====================================================
-- 4. VECTOR COLUMNS (ALREADY DONE IN PREVIOUS MIGRATION)
-- =====================================================

-- Note: Vector columns and indexes were already created in
-- 20251022_0001_optimized_sponsorship_system.sql
-- This section is here for reference only

-- =====================================================
-- 5. ON DELETE CASCADE (PREVENT ORPHANS)
-- =====================================================

-- Note: sponsorship_packages is a view, cannot alter constraints
-- Skip package FK

-- Sponsorship matches: cascade delete when event is deleted
ALTER TABLE public.sponsorship_matches
  DROP CONSTRAINT IF EXISTS sponsorship_matches_event_id_fkey,
  ADD CONSTRAINT sponsorship_matches_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES events.events(id) ON DELETE CASCADE;

-- Note: sponsorship_orders is a view, cannot alter constraints
-- Skip orders FK

-- Event audience insights: cascade delete when event is deleted
ALTER TABLE public.event_audience_insights
  DROP CONSTRAINT IF EXISTS event_audience_insights_event_id_fkey,
  ADD CONSTRAINT event_audience_insights_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES events.events(id) ON DELETE CASCADE;

-- Event stat snapshots: cascade delete when event is deleted
ALTER TABLE public.event_stat_snapshots
  DROP CONSTRAINT IF EXISTS event_stat_snapshots_event_id_fkey,
  ADD CONSTRAINT event_stat_snapshots_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES events.events(id) ON DELETE CASCADE;

-- Note: event_sponsorships is a view, cannot alter constraints
-- Skip event_sponsorships FK

-- =====================================================
-- 6. PERFORMANCE INDEXES
-- =====================================================

-- Marketplace filter indexes
-- Note: public.sponsorship_packages is a view, create indexes on underlying table
CREATE INDEX IF NOT EXISTS idx_pkg_active_vis_price 
  ON sponsorship.sponsorship_packages (is_active, visibility, price_cents)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_pkg_event 
  ON sponsorship.sponsorship_packages (event_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_pkg_tier 
  ON sponsorship.sponsorship_packages (tier, is_active);

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

-- Note: sponsorship_orders is a view, cannot create indexes
-- Skip orders indexes

-- =====================================================
-- 7. MONEY TYPE CONSTRAINTS
-- =====================================================

-- Note: sponsorship_packages, sponsorship_orders, and event_sponsorships are views
-- Skip money constraints on views

-- =====================================================
-- 8. ADDITIONAL DATA INTEGRITY CONSTRAINTS
-- =====================================================

-- Note: sponsorship_packages is a view, cannot add constraints
-- Skip all package constraints

-- Budget constraints (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sponsor_profiles_budget_positive'
  ) THEN
    ALTER TABLE public.sponsor_profiles
      ADD CONSTRAINT sponsor_profiles_budget_positive 
      CHECK (annual_budget_cents IS NULL OR annual_budget_cents >= 0);
  END IF;
END $$;

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

-- Payout amount constraints (only if tables exist)
DO $$
BEGIN
  -- Check if sponsorship_payouts table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'sponsorship_payouts'
  ) THEN
    -- Add amount constraint if not exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'sponsorship_payouts_amount_positive'
    ) THEN
      ALTER TABLE public.sponsorship_payouts
        ADD CONSTRAINT sponsorship_payouts_amount_positive 
        CHECK (amount_cents > 0);
    END IF;

    -- Add fee constraint if not exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'sponsorship_payouts_fee_valid'
    ) THEN
      ALTER TABLE public.sponsorship_payouts
        ADD CONSTRAINT sponsorship_payouts_fee_valid 
        CHECK (application_fee_cents >= 0 AND application_fee_cents < amount_cents);
    END IF;
  END IF;

  -- Check if payout_configurations table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'payout_configurations'
  ) THEN
    -- Add fee percentage constraint if not exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'payout_configurations_fee_valid'
    ) THEN
      ALTER TABLE public.payout_configurations
        ADD CONSTRAINT payout_configurations_fee_valid 
        CHECK (platform_fee_percentage >= 0 AND platform_fee_percentage <= 1);
    END IF;

    -- Add minimum payout constraint if not exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'payout_configurations_min_payout_positive'
    ) THEN
      ALTER TABLE public.payout_configurations
        ADD CONSTRAINT payout_configurations_min_payout_positive 
        CHECK (minimum_payout_amount_cents > 0);
    END IF;
  END IF;
END $$;

-- =====================================================
-- 11. COMMENTS FOR DOCUMENTATION
-- =====================================================

-- Add comments on constraints (will be ignored if constraints don't exist)
-- Note: We can't use DO blocks for COMMENT statements, so we wrap in a function
DO $$
BEGIN
  -- Try to add comments, ignore errors if constraints don't exist
  BEGIN
    EXECUTE 'COMMENT ON CONSTRAINT sponsorship_matches_event_sponsor_unique ON public.sponsorship_matches IS ''Ensures one match score per event-sponsor pair for idempotency''';
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Constraint doesn't exist, skip
  END;

  BEGIN
    EXECUTE 'COMMENT ON CONSTRAINT sponsorship_matches_score_chk ON public.sponsorship_matches IS ''Match scores must be between 0 and 1''';
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Constraint doesn't exist, skip
  END;
END $$;

-- Add comments on indexes (will be ignored if indexes don't exist)
DO $$
BEGIN
  BEGIN
    EXECUTE 'COMMENT ON INDEX idx_pkg_active_vis_price IS ''Optimizes marketplace filtering by status, visibility, and price''';
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Index doesn't exist, skip
  END;

  BEGIN
    EXECUTE 'COMMENT ON INDEX idx_match_event_score IS ''Optimizes sponsor recommendations for events''';
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Index doesn't exist, skip
  END;

  BEGIN
    EXECUTE 'COMMENT ON INDEX idx_match_sponsor_score IS ''Optimizes event recommendations for sponsors''';
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Index doesn't exist, skip
  END;
END $$;

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
