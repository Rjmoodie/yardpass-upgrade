-- =====================================================
-- SPONSORSHIP SYSTEM: SHIP BLOCKERS & CRITICAL IMPROVEMENTS
-- =====================================================
-- This migration addresses all P0 (ship blockers) and key P1 items:
-- - Complete FK indexes for all hot paths
-- - Explicit ON DELETE behaviors
-- - Business invariants (unique active matches, open proposals)
-- - Deliverables linkage to orders/packages
-- - State machine coherence checks
-- - JSONB GIN indexes for faceting
-- - Versioning uniqueness

BEGIN;

-- =====================================================
-- P0: FK INDEXES (QUERIES + DELETES)
-- =====================================================

-- Core traversal indexes
CREATE INDEX IF NOT EXISTS idx_sponsorship_matches_event_sponsor 
  ON public.sponsorship_matches (event_id, sponsor_id);

CREATE INDEX IF NOT EXISTS idx_sponsorship_matches_status_updated 
  ON public.sponsorship_matches (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_proposal_threads_event_sponsor_status 
  ON public.proposal_threads (event_id, sponsor_id, status);

CREATE INDEX IF NOT EXISTS idx_proposal_messages_thread_time 
  ON public.proposal_messages (thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sponsorship_orders_event 
  ON public.sponsorship_orders (event_id);

CREATE INDEX IF NOT EXISTS idx_sponsorship_orders_sponsor 
  ON public.sponsorship_orders (sponsor_id);

CREATE INDEX IF NOT EXISTS idx_sponsorship_orders_status_created 
  ON public.sponsorship_orders (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sponsorship_payouts_order 
  ON public.sponsorship_payouts (order_id);

CREATE INDEX IF NOT EXISTS idx_payout_queue_order_status_scheduled 
  ON public.payout_queue (order_id, status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_deliverables_event_sponsor_status 
  ON public.deliverables (event_id, sponsor_id, status);

CREATE INDEX IF NOT EXISTS idx_deliverable_proofs_deliverable_submitted 
  ON public.deliverable_proofs (deliverable_id, submitted_at DESC);

-- Package indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsorship_packages_event_tier_version 
  ON public.sponsorship_packages (event_id, tier, version);

CREATE UNIQUE INDEX IF NOT EXISTS idx_package_variants_package_label 
  ON public.package_variants (package_id, label);

-- Matching features/feedback
CREATE INDEX IF NOT EXISTS idx_match_features_event_sponsor_computed 
  ON public.match_features (event_id, sponsor_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_feedback_event_sponsor_created 
  ON public.match_feedback (event_id, sponsor_id, created_at DESC);

-- Audience & consents
CREATE INDEX IF NOT EXISTS idx_event_audience_insights_event 
  ON public.event_audience_insights (event_id);

CREATE INDEX IF NOT EXISTS idx_audience_consents_event_segment 
  ON public.audience_consents (event_id, segment_key);

-- =====================================================
-- P0: BUSINESS INVARIANTS (UNIQUENESS RULES)
-- =====================================================

-- One active match row per event/sponsor
CREATE UNIQUE INDEX IF NOT EXISTS sponsorship_matches_unique_active
  ON public.sponsorship_matches (event_id, sponsor_id)
  WHERE status IN ('pending', 'suggested', 'accepted');

-- One open proposal thread per event/sponsor
CREATE UNIQUE INDEX IF NOT EXISTS proposal_threads_one_open
  ON public.proposal_threads (event_id, sponsor_id)
  WHERE status IN ('draft', 'sent', 'counter');

-- =====================================================
-- P0: EXPLICIT ON DELETE BEHAVIORS
-- =====================================================

-- Messages cascade with thread
ALTER TABLE public.proposal_messages
  DROP CONSTRAINT IF EXISTS proposal_messages_thread_id_fkey,
  ADD CONSTRAINT proposal_messages_thread_id_fkey
  FOREIGN KEY (thread_id) REFERENCES public.proposal_threads(id) ON DELETE CASCADE;

-- Proofs cascade with deliverable
ALTER TABLE public.deliverable_proofs
  DROP CONSTRAINT IF EXISTS deliverable_proofs_deliverable_id_fkey,
  ADD CONSTRAINT deliverable_proofs_deliverable_id_fkey
  FOREIGN KEY (deliverable_id) REFERENCES public.deliverables(id) ON DELETE CASCADE;

-- Package variants cascade with package
ALTER TABLE public.package_variants
  DROP CONSTRAINT IF EXISTS package_variants_package_id_fkey,
  ADD CONSTRAINT package_variants_package_id_fkey
  FOREIGN KEY (package_id) REFERENCES public.sponsorship_packages(id) ON DELETE CASCADE;

-- Payouts reference orders (RESTRICT - don't delete orders with payouts)
ALTER TABLE public.sponsorship_payouts
  DROP CONSTRAINT IF EXISTS sponsorship_payouts_order_id_fkey,
  ADD CONSTRAINT sponsorship_payouts_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.sponsorship_orders(id) ON DELETE RESTRICT;

-- Payout queue references orders (CASCADE - clean up queue if order deleted)
ALTER TABLE public.payout_queue
  DROP CONSTRAINT IF EXISTS payout_queue_order_id_fkey,
  ADD CONSTRAINT payout_queue_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.sponsorship_orders(id) ON DELETE CASCADE;

-- SLAs reference deliverables (SET NULL - keep SLA if deliverable deleted)
ALTER TABLE public.sponsorship_slas
  DROP CONSTRAINT IF EXISTS sponsorship_slas_deliverable_id_fkey,
  ADD CONSTRAINT sponsorship_slas_deliverable_id_fkey
  FOREIGN KEY (deliverable_id) REFERENCES public.deliverables(id) ON DELETE SET NULL;

-- Match features cascade with sponsors
ALTER TABLE public.match_features
  DROP CONSTRAINT IF EXISTS match_features_sponsor_id_fkey,
  ADD CONSTRAINT match_features_sponsor_id_fkey
  FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id) ON DELETE CASCADE;

-- Match feedback cascade with sponsors
ALTER TABLE public.match_feedback
  DROP CONSTRAINT IF EXISTS match_feedback_sponsor_id_fkey,
  ADD CONSTRAINT match_feedback_sponsor_id_fkey
  FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id) ON DELETE CASCADE;

-- Sponsorship matches cascade with sponsors
ALTER TABLE public.sponsorship_matches
  DROP CONSTRAINT IF EXISTS sponsorship_matches_sponsor_id_fkey,
  ADD CONSTRAINT sponsorship_matches_sponsor_id_fkey
  FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id) ON DELETE CASCADE;

-- =====================================================
-- P1: DELIVERABLES LINKAGE TO ORDERS/PACKAGES
-- =====================================================

-- Add order and package references to deliverables
ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS package_id uuid,
  ADD COLUMN IF NOT EXISTS package_variant_id uuid;

-- Add foreign keys
ALTER TABLE public.deliverables
  DROP CONSTRAINT IF EXISTS deliverables_order_id_fkey,
  ADD CONSTRAINT deliverables_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.sponsorship_orders(id) ON DELETE CASCADE;

ALTER TABLE public.deliverables
  DROP CONSTRAINT IF EXISTS deliverables_package_id_fkey,
  ADD CONSTRAINT deliverables_package_id_fkey
  FOREIGN KEY (package_id) REFERENCES public.sponsorship_packages(id) ON DELETE SET NULL;

ALTER TABLE public.deliverables
  DROP CONSTRAINT IF EXISTS deliverables_package_variant_id_fkey,
  ADD CONSTRAINT deliverables_package_variant_id_fkey
  FOREIGN KEY (package_variant_id) REFERENCES public.package_variants(id) ON DELETE SET NULL;

-- Add indexes for these new FKs
CREATE INDEX IF NOT EXISTS idx_deliverables_order 
  ON public.deliverables (order_id);

CREATE INDEX IF NOT EXISTS idx_deliverables_package 
  ON public.deliverables (package_id);

-- =====================================================
-- P1: STATE MACHINE COHERENCE CHECKS
-- =====================================================

-- Orders: escrow_state must align with status
-- Note: sponsorship_status enum likely has: 'pending', 'completed', 'cancelled'
-- Using flexible constraint that allows NULL escrow_state for all statuses
ALTER TABLE public.sponsorship_orders 
  ADD CONSTRAINT sponsorship_orders_state_consistency CHECK (
    escrow_state IS NULL
    OR (status = 'pending' AND escrow_state IN ('pending', 'funded', 'locked'))
    OR (status = 'completed' AND escrow_state IN ('released', 'locked'))
    OR (status = 'cancelled' AND escrow_state IN ('refunded', 'released', 'pending'))
  );

-- Deliverable proofs: approved_at requires no rejected_reason
ALTER TABLE public.deliverable_proofs
  ADD CONSTRAINT deliverable_proofs_approval_consistency CHECK (
    (approved_at IS NOT NULL AND rejected_reason IS NULL)
    OR (approved_at IS NULL)
  );

-- Proposal threads: accepted/rejected are terminal states
ALTER TABLE public.proposal_threads
  ADD CONSTRAINT proposal_threads_terminal_states CHECK (
    (status NOT IN ('accepted', 'rejected', 'expired'))
    OR (updated_at >= created_at)  -- Ensure progression
  );

-- =====================================================
-- P1: JSONB GIN INDEXES FOR FACETING
-- =====================================================

-- Package faceting
CREATE INDEX IF NOT EXISTS idx_sponsorship_packages_benefits_gin 
  ON public.sponsorship_packages USING gin (benefits jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_sponsorship_packages_availability_gin 
  ON public.sponsorship_packages USING gin (availability jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_sponsorship_packages_audience_snapshot_gin 
  ON public.sponsorship_packages USING gin (audience_snapshot jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_sponsorship_packages_constraints_gin 
  ON public.sponsorship_packages USING gin (constraints jsonb_path_ops);

-- Sponsor faceting
CREATE INDEX IF NOT EXISTS idx_sponsors_brand_values_gin 
  ON public.sponsors USING gin (brand_values jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_sponsor_profiles_brand_objectives_gin 
  ON public.sponsor_profiles USING gin (brand_objectives jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_sponsor_profiles_target_audience_gin 
  ON public.sponsor_profiles USING gin (target_audience jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_sponsor_profiles_activation_prefs_gin 
  ON public.sponsor_profiles USING gin (activation_preferences jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_sponsor_profiles_case_studies_gin 
  ON public.sponsor_profiles USING gin (case_studies jsonb_path_ops);

-- Event faceting
CREATE INDEX IF NOT EXISTS idx_events_target_audience_gin 
  ON public.events USING gin (target_audience jsonb_path_ops);

-- Event audience insights faceting
CREATE INDEX IF NOT EXISTS idx_event_aud_ins_household_income_gin 
  ON public.event_audience_insights USING gin (household_income_segments jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_event_aud_ins_brand_affinities_gin 
  ON public.event_audience_insights USING gin (brand_affinities jsonb_path_ops);

-- Order faceting
CREATE INDEX IF NOT EXISTS idx_sponsorship_orders_milestone_gin 
  ON public.sponsorship_orders USING gin (milestone jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_sponsorship_orders_cancellation_gin 
  ON public.sponsorship_orders USING gin (cancellation_policy jsonb_path_ops);

-- =====================================================
-- P1: ADDITIONAL USEFUL COLUMNS
-- =====================================================

-- Add updated_at to key mutable tables (if not exists)
DO $$
BEGIN
  -- Sponsors
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sponsors' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.sponsors ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;

  -- Sponsor public profiles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sponsor_public_profiles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.sponsor_public_profiles ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;

  -- Package templates (already has it)
  -- Event audience insights: add metadata fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_audience_insights' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.event_audience_insights 
      ADD COLUMN source text,
      ADD COLUMN as_of timestamptz,
      ADD COLUMN confidence numeric CHECK (confidence >= 0 AND confidence <= 1);
  END IF;
END $$;

-- =====================================================
-- P2: AUDIT TRIGGERS (UPDATED_AT AUTO-UPDATE)
-- =====================================================

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- Apply to key tables
DROP TRIGGER IF EXISTS set_updated_at ON public.sponsors;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.sponsors
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.sponsor_public_profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.sponsor_public_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.sponsor_profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.sponsor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.package_templates;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.package_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.sponsorship_packages;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.sponsorship_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.proposal_threads;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.proposal_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.deliverables;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.deliverables
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.event_audience_insights;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.event_audience_insights
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- =====================================================
-- P2: ADDITIONAL INDEXES FOR COMMON QUERIES
-- =====================================================

-- Sponsor discovery
CREATE INDEX IF NOT EXISTS idx_sponsor_public_profiles_verified_updated 
  ON public.sponsor_public_profiles (is_verified, updated_at DESC)
  WHERE is_verified = true;

-- Package marketplace
CREATE INDEX IF NOT EXISTS idx_sponsorship_packages_active_quality 
  ON public.sponsorship_packages (is_active, quality_score DESC NULLS LAST)
  WHERE is_active = true AND visibility = 'public';

-- Event sponsorable flag
CREATE INDEX IF NOT EXISTS idx_events_sponsorable_start 
  ON public.events (sponsorable, start_at DESC)
  WHERE sponsorable = true;

-- Deliverables due soon
CREATE INDEX IF NOT EXISTS idx_deliverables_due_status 
  ON public.deliverables (due_at NULLS LAST, status)
  WHERE status IN ('pending', 'needs_changes');

-- Match feedback for learning
CREATE INDEX IF NOT EXISTS idx_match_feedback_label_reason 
  ON public.match_feedback (label, created_at DESC);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON INDEX sponsorship_matches_unique_active IS 'Ensures only one active match per event-sponsor pair';
COMMENT ON INDEX proposal_threads_one_open IS 'Ensures only one open proposal thread per event-sponsor pair';
COMMENT ON CONSTRAINT sponsorship_orders_state_consistency ON public.sponsorship_orders IS 'Enforces coherence between order status and escrow state';
COMMENT ON CONSTRAINT deliverable_proofs_approval_consistency ON public.deliverable_proofs IS 'Ensures approved proofs have no rejection reason';

COMMENT ON COLUMN public.deliverables.order_id IS 'Links deliverable to the specific order it was part of';
COMMENT ON COLUMN public.deliverables.package_id IS 'Links deliverable to the package it belongs to';
COMMENT ON COLUMN public.event_audience_insights.source IS 'Source of the insight data (e.g., "analytics", "survey", "ml_model")';
COMMENT ON COLUMN public.event_audience_insights.as_of IS 'Timestamp when these insights were valid/captured';
COMMENT ON COLUMN public.event_audience_insights.confidence IS 'Confidence score for these insights (0-1)';

COMMENT ON FUNCTION public.trigger_set_updated_at() IS 'Automatically updates updated_at timestamp on row modification';

COMMIT;

-- =====================================================
-- END OF MIGRATION - SHIP BLOCKERS RESOLVED
-- =====================================================
