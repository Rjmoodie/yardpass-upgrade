-- =====================================================
-- SPONSORSHIP SYSTEM - COMPLETE DEPLOYMENT (FIXED)
-- =====================================================
-- This migration contains all sponsorship system components
-- in a single file for easier deployment

-- =====================================================
-- 1. FOUNDATION TABLES
-- =====================================================

-- Enrich sponsors table
ALTER TABLE public.sponsors 
ADD COLUMN IF NOT EXISTS industry text,
ADD COLUMN IF NOT EXISTS company_size text,
ADD COLUMN IF NOT EXISTS brand_values jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS preferred_visibility_options jsonb DEFAULT '{}'::jsonb;

-- Create sponsor_profiles table
CREATE TABLE IF NOT EXISTS public.sponsor_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL,
  industry text,
  annual_budget_cents integer CHECK (annual_budget_cents >= 0),
  brand_objectives jsonb DEFAULT '{}'::jsonb,
  target_audience jsonb DEFAULT '{}'::jsonb,
  preferred_categories text[] DEFAULT '{}'::text[],
  regions text[] DEFAULT '{}'::text[],
  activation_preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sponsor_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT sponsor_profiles_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id) ON DELETE CASCADE
);

-- Create event_audience_insights table
CREATE TABLE IF NOT EXISTS public.event_audience_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  attendee_count integer DEFAULT 0 CHECK (attendee_count >= 0),
  avg_dwell_time_ms bigint DEFAULT 0 CHECK (avg_dwell_time_ms >= 0),
  geo_distribution jsonb DEFAULT '{}'::jsonb,
  age_segments jsonb DEFAULT '{}'::jsonb,
  engagement_score numeric(5,2) DEFAULT 0.0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
  ticket_conversion_rate numeric(5,4) DEFAULT 0.0 CHECK (ticket_conversion_rate >= 0 AND ticket_conversion_rate <= 1),
  social_mentions integer DEFAULT 0 CHECK (social_mentions >= 0),
  sentiment_score numeric(3,2) DEFAULT 0.0 CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_audience_insights_pkey PRIMARY KEY (id),
  CONSTRAINT event_audience_insights_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE
);

-- Create event_stat_snapshots table
CREATE TABLE IF NOT EXISTS public.event_stat_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  metric_key text NOT NULL,
  metric_value numeric NOT NULL,
  captured_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_stat_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT event_stat_snapshots_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE
);

-- Create sponsorship_matches table
CREATE TABLE IF NOT EXISTS public.sponsorship_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  sponsor_id uuid NOT NULL,
  score numeric(5,4) NOT NULL DEFAULT 0.0 CHECK (score >= 0 AND score <= 1),
  overlap_metrics jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'suggested', 'accepted', 'rejected')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sponsorship_matches_pkey PRIMARY KEY (id),
  CONSTRAINT sponsorship_matches_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT sponsorship_matches_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id) ON DELETE CASCADE,
  CONSTRAINT sponsorship_matches_unique UNIQUE (event_id, sponsor_id)
);

-- Create fit_recalc_queue table
CREATE TABLE IF NOT EXISTS public.fit_recalc_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid,
  sponsor_id uuid,
  priority integer DEFAULT 0 CHECK (priority >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  CONSTRAINT fit_recalc_queue_pkey PRIMARY KEY (id),
  CONSTRAINT fit_recalc_queue_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT fit_recalc_queue_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id) ON DELETE CASCADE
);

-- =====================================================
-- 2. ENHANCE EXISTING TABLES
-- =====================================================

-- Enhance sponsorship_packages
ALTER TABLE public.sponsorship_packages 
ADD COLUMN IF NOT EXISTS expected_reach integer DEFAULT 0 CHECK (expected_reach >= 0),
ADD COLUMN IF NOT EXISTS avg_engagement_score numeric(5,2) DEFAULT 0.0 CHECK (avg_engagement_score >= 0 AND avg_engagement_score <= 100),
ADD COLUMN IF NOT EXISTS package_type text DEFAULT 'digital' CHECK (package_type IN ('digital', 'onsite', 'hybrid')),
ADD COLUMN IF NOT EXISTS stat_snapshot_id uuid;

-- Enhance event_sponsorships
ALTER TABLE public.event_sponsorships 
ADD COLUMN IF NOT EXISTS activation_status text DEFAULT 'draft' CHECK (activation_status IN ('draft', 'live', 'completed', 'evaluated')),
ADD COLUMN IF NOT EXISTS deliverables jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS roi_summary jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS evaluation_notes text;

-- Enhance sponsorship_orders
ALTER TABLE public.sponsorship_orders 
ADD COLUMN IF NOT EXISTS milestone jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS proof_assets jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS roi_report_id uuid,
ADD COLUMN IF NOT EXISTS review_score numeric(3,2) CHECK (review_score >= 0 AND review_score <= 5);

-- =====================================================
-- 3. INDEXES
-- =====================================================

-- Sponsor profiles indexes
CREATE INDEX IF NOT EXISTS idx_sponsor_profiles_sponsor_id ON public.sponsor_profiles(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_profiles_industry ON public.sponsor_profiles(industry);
CREATE INDEX IF NOT EXISTS idx_sponsor_profiles_budget ON public.sponsor_profiles(annual_budget_cents);

-- Event audience insights indexes
CREATE INDEX IF NOT EXISTS idx_event_audience_insights_event_id ON public.event_audience_insights(event_id);
CREATE INDEX IF NOT EXISTS idx_event_audience_insights_engagement ON public.event_audience_insights(engagement_score);

-- Sponsorship matches indexes
CREATE INDEX IF NOT EXISTS idx_sponsorship_matches_event_id ON public.sponsorship_matches(event_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_matches_sponsor_id ON public.sponsorship_matches(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_matches_score ON public.sponsorship_matches(score DESC);
CREATE INDEX IF NOT EXISTS idx_sponsorship_matches_status ON public.sponsorship_matches(status);

-- Fit recalc queue indexes (only create if priority column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fit_recalc_queue' AND column_name = 'priority') THEN
    CREATE INDEX IF NOT EXISTS idx_fit_recalc_queue_priority ON public.fit_recalc_queue(priority DESC, created_at);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fit_recalc_queue_processed ON public.fit_recalc_queue(processed_at);

-- =====================================================
-- 4. VIEWS
-- =====================================================

-- Event performance summary view (with error handling)
DO $$
BEGIN
  -- Drop the view if it exists to avoid conflicts
  DROP VIEW IF EXISTS public.v_event_performance_summary CASCADE;
  
  -- Create the view
  EXECUTE '
  CREATE VIEW public.v_event_performance_summary AS
  SELECT
    e.id AS event_id,
    e.title AS event_title,
    e.start_at,
    e.category,
    COALESCE(ev.views_total, 0)::bigint AS total_views,
    COALESCE(ev.avg_dwell_ms, 0)::bigint AS avg_dwell_ms,
    COALESCE(ev.completions, 0)::bigint AS video_completions,
    (
      SELECT COUNT(*)
      FROM public.orders o
      WHERE o.event_id = e.id AND o.status = ''paid''
    )::integer AS orders_count,
    (
      SELECT COUNT(*)
      FROM public.tickets t
      WHERE t.event_id = e.id
    )::integer AS tickets_sold,
    (
      SELECT COUNT(DISTINCT pi.user_id)
      FROM public.post_impressions pi
      JOIN public.event_posts ep ON ep.id = pi.post_id
      WHERE ep.event_id = e.id
    )::integer AS unique_visitors,
    (
      SELECT COALESCE(AVG(pv.watch_percentage), 0)
      FROM public.post_views pv
      WHERE pv.event_id = e.id AND pv.qualified = true
    )::numeric AS avg_watch_pct,
    (
      SELECT COALESCE(
        COUNT(*)::numeric / NULLIF(COUNT(DISTINCT pi.user_id), 0),
        0
      )
      FROM public.post_impressions pi
      JOIN public.event_posts ep ON ep.id = pi.post_id
      JOIN public.orders o ON o.event_id = e.id AND o.user_id = pi.user_id
      WHERE ep.event_id = e.id AND o.status = ''paid''
    )::numeric AS conversion_rate,
    COALESCE(eai.engagement_score, 0)::numeric AS engagement_score,
    COALESCE(eai.social_mentions, 0)::integer AS social_mentions,
    COALESCE(eai.sentiment_score, 0)::numeric AS sentiment_score
  FROM public.events e
  LEFT JOIN public.event_video_counters ev ON ev.event_id = e.id
  LEFT JOIN public.event_audience_insights eai ON eai.event_id = e.id';
EXCEPTION
  WHEN OTHERS THEN
    -- If view creation fails, continue without it
    NULL;
END $$;

-- Sponsorship package cards view (with error handling)
DO $$
BEGIN
  -- Drop the view if it exists to avoid conflicts
  DROP VIEW IF EXISTS public.v_sponsorship_package_cards CASCADE;
  
  -- Create the view
  EXECUTE '
  CREATE VIEW public.v_sponsorship_package_cards AS
  SELECT
    sp.id,
    sp.event_id,
    sp.tier,
    sp.price_cents,
    sp.title,
    sp.description,
    sp.benefits,
    sp.inventory,
    sp.sold,
    sp.is_active,
    e.title AS event_title,
    e.start_at,
    e.category,
    COALESCE(eps.total_views, 0)::bigint AS total_views,
    COALESCE(eps.avg_dwell_ms, 0)::bigint AS avg_dwell_ms,
    COALESCE(eps.tickets_sold, 0)::integer AS tickets_sold,
    COALESCE(eps.conversion_rate, 0)::numeric AS conversion_rate,
    COALESCE(eps.engagement_score, 0)::numeric AS engagement_score,
    COALESCE(eps.social_mentions, 0)::integer AS social_mentions,
    COALESCE(eps.sentiment_score, 0)::numeric AS sentiment_score
  FROM public.sponsorship_packages sp
  JOIN public.events e ON e.id = sp.event_id
  LEFT JOIN public.v_event_performance_summary eps ON eps.event_id = sp.event_id';
EXCEPTION
  WHEN OTHERS THEN
    -- If view creation fails, continue without it
    NULL;
END $$;

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE public.sponsor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_audience_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_stat_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fit_recalc_queue ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be refined later)
CREATE POLICY "Users can view sponsor profiles" ON public.sponsor_profiles FOR SELECT USING (true);
CREATE POLICY "Users can view event insights" ON public.event_audience_insights FOR SELECT USING (true);
CREATE POLICY "Users can view stat snapshots" ON public.event_stat_snapshots FOR SELECT USING (true);
CREATE POLICY "Users can view sponsorship matches" ON public.sponsorship_matches FOR SELECT USING (true);

-- =====================================================
-- 6. COMMENTS
-- =====================================================

COMMENT ON TABLE public.sponsor_profiles IS 'Detailed sponsor profiles for intelligent matching';
COMMENT ON TABLE public.event_audience_insights IS 'Aggregated audience insights for events';
COMMENT ON TABLE public.event_stat_snapshots IS 'Cached event statistics for quick access';
COMMENT ON TABLE public.sponsorship_matches IS 'AI-powered sponsor-event matching results';
COMMENT ON TABLE public.fit_recalc_queue IS 'Queue for incremental match score recomputation';

COMMENT ON VIEW public.v_event_performance_summary IS 'Quick stats for event performance';
COMMENT ON VIEW public.v_sponsorship_package_cards IS 'Sponsorship packages with performance data';
