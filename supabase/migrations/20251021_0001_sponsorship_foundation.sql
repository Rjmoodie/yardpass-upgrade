-- === SPONSORSHIP FOUNDATION DDL ===
-- Phase 1: Core tables, indexes, and queue for data-driven sponsorship matching

-- 1) Enrich sponsors with profile data
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS company_size text,
  ADD COLUMN IF NOT EXISTS brand_values jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_visibility_options jsonb DEFAULT '{}'::jsonb;

-- 2) Sponsor profile (deep targeting & budget data)
CREATE TABLE IF NOT EXISTS public.sponsor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL UNIQUE REFERENCES public.sponsors(id) ON DELETE CASCADE,
  industry text,
  company_size text,
  annual_budget_cents integer CHECK (annual_budget_cents IS NULL OR annual_budget_cents >= 0),
  brand_objectives jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_audience jsonb NOT NULL DEFAULT '{}'::jsonb,              -- e.g., {age_buckets, interests}
  preferred_categories text[] NOT NULL DEFAULT '{}',
  regions text[] NOT NULL DEFAULT '{}',                              -- ISO country/region codes
  activation_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  reputation_score numeric,                                          -- optional derived metric
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sponsor_profiles IS 'Deep sponsor targeting profiles for intelligent event matching';
COMMENT ON COLUMN public.sponsor_profiles.brand_objectives IS 'JSONB: brand goals, keywords for similarity matching';
COMMENT ON COLUMN public.sponsor_profiles.target_audience IS 'JSONB: demographic and psychographic targeting data';

-- 3) Event audience insights (aggregated behavioral & demographic data)
CREATE TABLE IF NOT EXISTS public.event_audience_insights (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  attendee_count integer,
  avg_dwell_time_ms integer CHECK (avg_dwell_time_ms IS NULL OR avg_dwell_time_ms >= 0),
  geo_distribution jsonb NOT NULL DEFAULT '{}'::jsonb,              -- {country: count, ...}
  age_segments jsonb NOT NULL DEFAULT '{}'::jsonb,                  -- {18-24: 0.2, 25-34: 0.4, ...}
  engagement_score numeric,                                         -- 0..1 normalized
  ticket_conversion_rate numeric,                                   -- 0..1 normalized
  social_mentions integer,
  sentiment_score numeric,                                          -- -1..1 normalized
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.event_audience_insights IS 'Aggregated audience metrics for sponsorship matching and ROI prediction';

-- 4) Snapshots for quick package previews and historical tracking
CREATE TABLE IF NOT EXISTS public.event_stat_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  metric_value numeric,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_stat_snapshots_event_time
  ON public.event_stat_snapshots (event_id, captured_at DESC);

COMMENT ON TABLE public.event_stat_snapshots IS 'Time-series metrics for package stat cards and historical analysis';

-- 5) Pairwise matches (canonical store for sponsor-event fit scores)
CREATE TABLE IF NOT EXISTS public.sponsorship_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  overlap_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,               -- {budget_fit:0.8, audience_overlap:{...}, ...}
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','suggested','accepted','rejected')),
  viewed_at timestamptz,
  contacted_at timestamptz,
  declined_reason text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, sponsor_id)
);

COMMENT ON TABLE public.sponsorship_matches IS 'Precomputed sponsor-event fit scores with explainability metrics';
COMMENT ON COLUMN public.sponsorship_matches.overlap_metrics IS 'JSONB breakdown: budget_fit, audience_overlap, geo_fit, engagement_quality, objectives_similarity';

-- 6) Enrich existing sponsorship objects
ALTER TABLE public.sponsorship_packages
  ADD COLUMN IF NOT EXISTS expected_reach integer,
  ADD COLUMN IF NOT EXISTS avg_engagement_score numeric,
  ADD COLUMN IF NOT EXISTS package_type text,                        -- digital | onsite | hybrid
  ADD COLUMN IF NOT EXISTS stat_snapshot_id uuid REFERENCES public.event_stat_snapshots(id),
  ADD COLUMN IF NOT EXISTS quality_score integer CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)),
  ADD COLUMN IF NOT EXISTS quality_updated_at timestamptz;

COMMENT ON COLUMN public.sponsorship_packages.expected_reach IS 'Estimated audience reach for this package';
COMMENT ON COLUMN public.sponsorship_packages.quality_score IS '0-100 quality score based on engagement, conversion, and fulfillment history';

ALTER TABLE public.event_sponsorships
  ADD COLUMN IF NOT EXISTS activation_status text DEFAULT 'draft',   -- draft|live|completed|evaluated
  ADD COLUMN IF NOT EXISTS deliverables jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS roi_summary jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deliverables_due_date timestamptz,
  ADD COLUMN IF NOT EXISTS deliverables_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS organizer_approved_at timestamptz;

COMMENT ON COLUMN public.event_sponsorships.deliverables IS 'JSONB: list of required deliverables with status tracking';
COMMENT ON COLUMN public.event_sponsorships.roi_summary IS 'JSONB: post-event ROI metrics and analysis';

ALTER TABLE public.sponsorship_orders
  ADD COLUMN IF NOT EXISTS milestone jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS proof_assets jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS roi_report_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS last_modified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS version_number integer DEFAULT 1;

COMMENT ON COLUMN public.sponsorship_orders.milestone IS 'JSONB: payment milestone definitions and status';
COMMENT ON COLUMN public.sponsorship_orders.proof_assets IS 'JSONB: URLs and metadata for deliverable proofs';

-- 7) Performance indexes
CREATE INDEX IF NOT EXISTS idx_sponsor_profiles_industry_size
  ON public.sponsor_profiles (industry, company_size);

CREATE INDEX IF NOT EXISTS idx_sponsor_profiles_pref_categories
  ON public.sponsor_profiles USING gin (preferred_categories);

CREATE INDEX IF NOT EXISTS idx_sponsor_profiles_regions
  ON public.sponsor_profiles USING gin (regions);

CREATE INDEX IF NOT EXISTS idx_event_audience_insights_engagement
  ON public.event_audience_insights (engagement_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_sponsorship_matches_event_score
  ON public.sponsorship_matches (event_id, score DESC);

CREATE INDEX IF NOT EXISTS idx_sponsorship_matches_sponsor_score
  ON public.sponsorship_matches (sponsor_id, score DESC);

CREATE INDEX IF NOT EXISTS idx_sponsorship_matches_status_score
  ON public.sponsorship_matches (status, score DESC) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sponsorship_packages_quality
  ON public.sponsorship_packages (quality_score DESC NULLS LAST, created_at DESC);

-- 8) Lightweight queue for incremental recompute
CREATE TABLE IF NOT EXISTS public.fit_recalc_queue (
  id bigserial PRIMARY KEY,
  event_id uuid,
  sponsor_id uuid,
  reason text NOT NULL,
  queued_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (event_id, sponsor_id)
);

CREATE INDEX IF NOT EXISTS idx_fit_recalc_queue_pending
  ON public.fit_recalc_queue (processed_at NULLS FIRST, queued_at);

COMMENT ON TABLE public.fit_recalc_queue IS 'Queue for incremental recalculation of sponsorship match scores';

-- 9) Trigger to increment version on sponsorship_orders updates
CREATE OR REPLACE FUNCTION increment_sponsorship_order_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version_number := OLD.version_number + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_sponsorship_order_version
  BEFORE UPDATE ON public.sponsorship_orders
  FOR EACH ROW
  EXECUTE FUNCTION increment_sponsorship_order_version();

-- 10) Trigger to auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sponsor_profiles_updated_at
  BEFORE UPDATE ON public.sponsor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_event_audience_insights_updated_at
  BEFORE UPDATE ON public.event_audience_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_sponsorship_matches_updated_at
  BEFORE UPDATE ON public.sponsorship_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

