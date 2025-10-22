-- =====================================================
-- SPONSORSHIP ENTERPRISE FEATURES
-- =====================================================
-- This migration adds enterprise-grade features including:
-- - Public sponsor profiles and discovery
-- - Package templates and variants
-- - Proposal/negotiation system
-- - Deliverables and proof-of-performance
-- - ML feature store and human feedback
-- - Audience consent management
-- - SLA tracking and contract management

BEGIN;

-- =====================================================
-- 1. NEW CORE TABLES
-- =====================================================

-- 1A) Public-facing sponsor page for discovery & trust
CREATE TABLE IF NOT EXISTS public.sponsor_public_profiles (
  sponsor_id uuid PRIMARY KEY REFERENCES public.sponsors(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  headline text,
  about text,
  brand_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  badges text[] NOT NULL DEFAULT '{}'::text[],
  is_verified boolean NOT NULL DEFAULT false,
  social_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sponsor_public_profiles IS 'Public-facing sponsor profiles for discovery and trust building';

-- 1B) Reusable blueprints organizers can instantiate into event packages
CREATE TABLE IF NOT EXISTS public.package_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  default_price_cents integer NOT NULL CHECK (default_price_cents >= 0),
  default_benefits jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','org','public')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.package_templates IS 'Reusable package blueprints that organizers can instantiate';

-- 1C) Variants/A-Bs of a concrete package
CREATE TABLE IF NOT EXISTS public.package_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.sponsorship_packages(id) ON DELETE CASCADE,
  label text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  benefits jsonb NOT NULL DEFAULT '{}'::jsonb,
  inventory integer NOT NULL DEFAULT 1 CHECK (inventory >= 0),
  stat_snapshot_id uuid REFERENCES public.event_stat_snapshots(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.package_variants IS 'Package variants for A/B testing and different offer configurations';

-- 1D) Proposal/negotiation container
CREATE TABLE IF NOT EXISTS public.proposal_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','counter','accepted','rejected','expired')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, sponsor_id, created_at)  -- Allow multiple threads over time
);

COMMENT ON TABLE public.proposal_threads IS 'Negotiation threads between organizers and sponsors';

-- 1E) Messages (offers/counters) within a proposal
CREATE TABLE IF NOT EXISTS public.proposal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.proposal_threads(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('organizer','sponsor')),
  sender_user_id uuid NOT NULL REFERENCES auth.users(id),
  body text,
  offer jsonb NOT NULL DEFAULT '{}'::jsonb,      -- {price_cents, benefits, term_dates, exclusivity, addenda}
  attachments jsonb,                             -- e.g., files, links
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.proposal_messages IS 'Individual messages and offers within a proposal thread';

-- 1F) First-class deliverables for activation
CREATE TABLE IF NOT EXISTS public.deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  type text NOT NULL,                            -- e.g., 'logo_placement','booth','shoutout','ugc_video'
  spec jsonb NOT NULL DEFAULT '{}'::jsonb,       -- e.g., {size:"1080x1080", placements:["homepage","onsite"], copies:2}
  due_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','needs_changes','approved','waived')),
  evidence_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.deliverables IS 'First-class deliverables tracking for sponsor activations';

-- 1G) Proof-of-performance artifacts for deliverables
CREATE TABLE IF NOT EXISTS public.deliverable_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  asset_url text NOT NULL,                        -- or storage path
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,     -- e.g., {impressions:12345, clicks:321}
  submitted_by uuid REFERENCES auth.users(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  rejected_reason text
);

COMMENT ON TABLE public.deliverable_proofs IS 'Proof-of-performance artifacts with metrics for deliverables';

-- 1H) Feature store for ML/heuristic matching signals
CREATE TABLE IF NOT EXISTS public.match_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,    -- atomic signals (aud_overlap_pct, category_fit, etc.)
  version integer NOT NULL DEFAULT 1,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, sponsor_id, version)
);

COMMENT ON TABLE public.match_features IS 'Feature store for ML matching signals and model versioning';

-- 1I) Human-in-the-loop feedback to improve ranking
CREATE TABLE IF NOT EXISTS public.match_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  label text NOT NULL CHECK (label IN ('good_fit','bad_fit','later')),
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],  -- e.g., {'budget','audience','timing'}
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.match_feedback IS 'Human feedback for improving match algorithms with reason codes';

-- 1J) Audience segment sharing/consent records
CREATE TABLE IF NOT EXISTS public.audience_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  segment_key text NOT NULL,                      -- e.g., 'geo_top3','age_18_24'
  scope text NOT NULL CHECK (scope IN ('aggregated','cohort','pseudonymous')),
  consent_basis text NOT NULL,                    -- e.g., 'contract','legitimate_interest','consent'
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, segment_key)
);

COMMENT ON TABLE public.audience_consents IS 'GDPR/privacy-compliant audience data sharing consent tracking';

-- 1K) Sponsorship SLAs for trust and accountability
CREATE TABLE IF NOT EXISTS public.sponsorship_slas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  deliverable_id uuid REFERENCES public.deliverables(id) ON DELETE SET NULL,
  metric text NOT NULL,                           -- e.g., 'impressions','placement_duration_ms'
  target numeric NOT NULL,
  breach_policy jsonb NOT NULL DEFAULT '{}'::jsonb,  -- e.g., {penalty_cents:5000, remedy:'makegood'}
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sponsorship_slas IS 'Service level agreements with breach policies and remedies';

-- =====================================================
-- 2. UPGRADES TO EXISTING TABLES
-- =====================================================

-- 2A) Packages: link to templates, constraints & audience snapshot
ALTER TABLE public.sponsorship_packages
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.package_templates(id),
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS availability jsonb,                -- {window:{start,end}, max_per_sponsor:1, exclusivity:true}
  ADD COLUMN IF NOT EXISTS audience_snapshot jsonb,           -- denormalized stats excerpt for the package card
  ADD COLUMN IF NOT EXISTS constraints jsonb;                 -- e.g., {category_exclusive:true, sponsor_conflicts:['Beverages']}

-- 2B) Orders: contractual/escrow metadata + invoice linkage
ALTER TABLE public.sponsorship_orders
  ADD COLUMN IF NOT EXISTS contract_url text,
  ADD COLUMN IF NOT EXISTS escrow_state text CHECK (escrow_state IN ('pending','funded','locked','released','refunded')),
  ADD COLUMN IF NOT EXISTS cancellation_policy jsonb;

-- Add invoice_id if not exists (may already have it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sponsorship_orders' AND column_name = 'invoice_id'
  ) THEN
    ALTER TABLE public.sponsorship_orders
      ADD COLUMN invoice_id uuid REFERENCES public.invoices(id);
  END IF;
END $$;

-- 2C) Event sponsorships: normalize contract/activation SLA refs
ALTER TABLE public.event_sponsorships
  ADD COLUMN IF NOT EXISTS contract_id uuid,                          -- external/legal system id if you use one
  ADD COLUMN IF NOT EXISTS activation_state text CHECK (activation_state IN ('draft','in_progress','complete')),
  ADD COLUMN IF NOT EXISTS sla_id uuid REFERENCES public.sponsorship_slas(id);

-- 2D) Sponsors: verification & public visibility knobs
ALTER TABLE public.sponsor_profiles
  ADD COLUMN IF NOT EXISTS verification_status text CHECK (verification_status IN ('none','pending','verified','revoked')) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS public_visibility text CHECK (public_visibility IN ('hidden','limited','full')) DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS case_studies jsonb,
  ADD COLUMN IF NOT EXISTS preferred_formats text[];

-- 2E) Events: brand safety / target audience and sponsorable toggle
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS brand_safety_tags text[],
  ADD COLUMN IF NOT EXISTS target_audience jsonb,
  ADD COLUMN IF NOT EXISTS sponsorable boolean NOT NULL DEFAULT true;

-- 2F) Audience insights: richer facets for matching
ALTER TABLE public.event_audience_insights
  ADD COLUMN IF NOT EXISTS household_income_segments jsonb,
  ADD COLUMN IF NOT EXISTS interests_top text[],
  ADD COLUMN IF NOT EXISTS brand_affinities jsonb;

-- 2G) Matches: explanations & reason codes for transparency
ALTER TABLE public.sponsorship_matches
  ADD COLUMN IF NOT EXISTS explanations jsonb,    -- {top_signals:[{name,weight,value}], debug:{}}
  ADD COLUMN IF NOT EXISTS reason_codes text[];   -- {'audience','budget','category','timing'}

-- =====================================================
-- 3. PERFORMANCE INDICES
-- =====================================================

-- Active packages per event, sorted by quality
CREATE INDEX IF NOT EXISTS idx_sponsorship_packages_event_active_quality
  ON public.sponsorship_packages (event_id, is_active, quality_score DESC NULLS LAST)
  WHERE is_active = true;

-- Orders by event/sponsor/status for dashboard pipelines
CREATE INDEX IF NOT EXISTS idx_sponsorship_orders_event_sponsor_status
  ON public.sponsorship_orders (event_id, sponsor_id, status);

-- Proposal inbox-style views
CREATE INDEX IF NOT EXISTS idx_proposal_threads_event_sponsor_status
  ON public.proposal_threads (event_id, sponsor_id, status);

CREATE INDEX IF NOT EXISTS idx_proposal_threads_status_updated
  ON public.proposal_threads (status, updated_at DESC);

-- Deliverables SLA tracking
CREATE INDEX IF NOT EXISTS idx_deliverables_event_sponsor_due
  ON public.deliverables (event_id, sponsor_id, due_at NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_deliverables_status
  ON public.deliverables (status, due_at NULLS LAST)
  WHERE status IN ('pending', 'needs_changes');

-- Match retrieval (already exists, but ensuring)
CREATE INDEX IF NOT EXISTS idx_sponsorship_matches_event_score_v2
  ON public.sponsorship_matches (event_id, score DESC)
  WHERE score >= 0.5;

-- JSONB facets for audience insights
CREATE INDEX IF NOT EXISTS idx_event_audience_insights_geo_gin
  ON public.event_audience_insights USING gin (geo_distribution);

CREATE INDEX IF NOT EXISTS idx_event_audience_insights_age_gin
  ON public.event_audience_insights USING gin (age_segments);

CREATE INDEX IF NOT EXISTS idx_event_audience_insights_interests_gin
  ON public.event_audience_insights USING gin (interests_top);

-- Package variants
CREATE INDEX IF NOT EXISTS idx_package_variants_package_active
  ON public.package_variants (package_id, is_active)
  WHERE is_active = true;

-- Match features (latest version)
CREATE INDEX IF NOT EXISTS idx_match_features_event_sponsor_version
  ON public.match_features (event_id, sponsor_id, version DESC);

-- Match feedback for learning
CREATE INDEX IF NOT EXISTS idx_match_feedback_label_created
  ON public.match_feedback (label, created_at DESC);

-- Public sponsor profiles
CREATE INDEX IF NOT EXISTS idx_sponsor_public_profiles_verified
  ON public.sponsor_public_profiles (is_verified, updated_at DESC)
  WHERE is_verified = true;

-- =====================================================
-- 4. MATERIALIZED VIEWS (QUICK STATS)
-- =====================================================

-- 4A) Event quality score MV (blend of onsite engagement)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_event_quality_scores AS
SELECT
  e.id AS event_id,
  (
    0.35 * COALESCE(a.engagement_score, 0) +
    0.20 * COALESCE(a.ticket_conversion_rate, 0) +
    0.25 * COALESCE(LOG(1 + COALESCE(ev.views_unique, 0)), 0) +
    0.20 * COALESCE((
        SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pi.dwell_ms)
        FROM public.post_impressions pi
        WHERE pi.post_id IN (SELECT id FROM public.event_posts WHERE event_id = e.id)
    ), 0) / 10000.0  -- Normalize to 0-1 range
  )::numeric AS quality_score,
  now() AS computed_at
FROM public.events e
LEFT JOIN public.event_audience_insights a ON a.event_id = e.id
LEFT JOIN public.event_video_counters ev ON ev.event_id = e.id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_event_quality_scores_pk 
  ON public.mv_event_quality_scores(event_id);

-- 4B) Compact reach snapshot for package cards
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_event_reach_snapshot AS
SELECT
  e.id AS event_id,
  COALESCE(a.attendee_count, 0) AS attendee_count,
  (a.geo_distribution->'top3')::jsonb AS geo_top3,
  (a.age_segments->'buckets')::jsonb AS age_buckets,
  COALESCE(a.social_mentions, 0) AS social_mentions,
  COALESCE(a.sentiment_score, 0) AS sentiment_score,
  now() AS captured_at
FROM public.events e
LEFT JOIN public.event_audience_insights a ON a.event_id = e.id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_event_reach_snapshot_pk 
  ON public.mv_event_reach_snapshot(event_id);

-- =====================================================
-- 5. MV REFRESH HELPER
-- =====================================================

-- Function to refresh both MVs and log duration
CREATE OR REPLACE FUNCTION public.refresh_sponsorship_mvs(concurrent boolean DEFAULT true)
RETURNS void 
LANGUAGE plpgsql 
AS $$
DECLARE
  t_start timestamptz := now();
  dur_ms int;
BEGIN
  IF concurrent THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_event_quality_scores;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_event_reach_snapshot;
  ELSE
    REFRESH MATERIALIZED VIEW public.mv_event_quality_scores;
    REFRESH MATERIALIZED VIEW public.mv_event_reach_snapshot;
  END IF;

  dur_ms := EXTRACT(EPOCH FROM (now() - t_start))::int * 1000;

  INSERT INTO public.mv_refresh_log (concurrent, duration_ms, note)
  VALUES (concurrent, dur_ms, 'sponsorship_mvs');
END;
$$;

COMMENT ON FUNCTION public.refresh_sponsorship_mvs(boolean) IS 'Refreshes sponsorship materialized views and logs duration';

-- =====================================================
-- 6. ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE public.sponsor_public_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_slas ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (adjust based on your auth requirements)

-- Public sponsor profiles: readable by all
CREATE POLICY "Public sponsor profiles are viewable by everyone"
  ON public.sponsor_public_profiles FOR SELECT
  USING (true);

-- Package templates: organization members only
CREATE POLICY "Org members can view their templates"
  ON public.package_templates FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
  ));

-- Proposals: participants only
CREATE POLICY "Proposal participants can view threads"
  ON public.proposal_threads FOR SELECT
  USING (
    created_by = auth.uid() OR
    event_id IN (
      SELECT id FROM public.events WHERE owner_context_id IN (
        SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
      )
    ) OR
    sponsor_id IN (
      SELECT sponsor_id FROM public.sponsor_members WHERE user_id = auth.uid()
    )
  );

-- Deliverables: event owners and sponsors
CREATE POLICY "Event owners and sponsors can view deliverables"
  ON public.deliverables FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE owner_context_id IN (
        SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
      )
    ) OR
    sponsor_id IN (
      SELECT sponsor_id FROM public.sponsor_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

-- Grant execute on MV refresh function
GRANT EXECUTE ON FUNCTION public.refresh_sponsorship_mvs(boolean) TO authenticated, service_role;

-- Grant select on materialized views
GRANT SELECT ON public.mv_event_quality_scores TO authenticated;
GRANT SELECT ON public.mv_event_reach_snapshot TO authenticated;

COMMIT;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
