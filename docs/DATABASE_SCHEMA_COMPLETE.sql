-- =====================================================
-- YARDPASS COMPLETE DATABASE SCHEMA
-- =====================================================
-- This file contains the complete production database schema
-- including all sponsorship system tables and constraints
-- 
-- WARNING: This schema is for REFERENCE ONLY and is not meant to be run.
-- Table order and constraints may not be valid for execution.
-- Use the numbered migration files in supabase/migrations/ for actual deployment.
--
-- Generated: October 2025
-- Version: 1.0.0
-- Total Tables: 80+
-- =====================================================

-- =====================================================
-- AD SYSTEM TABLES
-- =====================================================

CREATE TABLE public.ad_clicks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  impression_id uuid,
  user_id uuid,
  session_id text,
  converted boolean DEFAULT false,
  conversion_value_cents integer,
  ticket_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  creative_id uuid,
  CONSTRAINT ad_clicks_pkey PRIMARY KEY (id),
  CONSTRAINT ad_clicks_creative_id_fkey FOREIGN KEY (creative_id) REFERENCES public.ad_creatives(id),
  CONSTRAINT ad_clicks_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT ad_clicks_impression_id_fkey FOREIGN KEY (impression_id) REFERENCES public.ad_impressions(id),
  CONSTRAINT ad_clicks_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id)
);

CREATE TABLE public.ad_creatives (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  headline text NOT NULL,
  body_text text,
  cta_label text NOT NULL DEFAULT 'Learn More'::text CHECK (cta_label IS NULL OR length(cta_label) >= 1 AND length(cta_label) <= 24),
  cta_url text,
  media_type USER-DEFINED NOT NULL,
  media_url text,
  post_id uuid,
  poster_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ad_creatives_pkey PRIMARY KEY (id),
  CONSTRAINT ad_creatives_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT ad_creatives_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.event_posts(id)
);

CREATE TABLE public.ad_impressions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  user_id uuid,
  session_id text,
  placement USER-DEFINED NOT NULL,
  event_id uuid,
  post_id uuid,
  user_agent text,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  creative_id uuid,
  CONSTRAINT ad_impressions_pkey PRIMARY KEY (id),
  CONSTRAINT ad_impressions_creative_id_fkey FOREIGN KEY (creative_id) REFERENCES public.ad_creatives(id),
  CONSTRAINT ad_impressions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id),
  CONSTRAINT ad_impressions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT ad_impressions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.event_posts(id)
);

CREATE TABLE public.ad_spend_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  wallet_id uuid NOT NULL,
  metric_type text NOT NULL CHECK (metric_type = ANY (ARRAY['impression'::text, 'click'::text, 'other'::text])),
  quantity integer NOT NULL CHECK (quantity >= 0),
  rate_model text NOT NULL CHECK (rate_model = ANY (ARRAY['cpm'::text, 'cpc'::text])),
  rate_usd_cents integer NOT NULL CHECK (rate_usd_cents >= 0),
  credits_charged integer NOT NULL CHECK (credits_charged >= 0),
  occurred_at timestamp with time zone NOT NULL,
  wallet_transaction_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  org_wallet_id uuid,
  creative_id uuid,
  CONSTRAINT ad_spend_ledger_pkey PRIMARY KEY (id),
  CONSTRAINT ad_spend_ledger_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id),
  CONSTRAINT ad_spend_ledger_wallet_transaction_id_fkey FOREIGN KEY (wallet_transaction_id) REFERENCES public.wallet_transactions(id),
  CONSTRAINT ad_spend_ledger_org_wallet_id_fkey FOREIGN KEY (org_wallet_id) REFERENCES public.org_wallets(id),
  CONSTRAINT ad_spend_ledger_creative_id_fkey FOREIGN KEY (creative_id) REFERENCES public.ad_creatives(id)
);

-- =====================================================
-- ANALYTICS & TRACKING TABLES
-- =====================================================

CREATE TABLE public.analytics_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid,
  event_type text NOT NULL,
  event_id uuid,
  ticket_id uuid,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  path text,
  url text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  session_id text,
  CONSTRAINT analytics_events_pkey PRIMARY KEY (id)
);

-- =====================================================
-- CAMPAIGN SYSTEM TABLES
-- =====================================================

CREATE TABLE public.campaign_placements (
  campaign_id uuid NOT NULL,
  placement USER-DEFINED NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  CONSTRAINT campaign_placements_pkey PRIMARY KEY (campaign_id, placement),
  CONSTRAINT campaign_placements_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);

CREATE TABLE public.campaign_targeting (
  campaign_id uuid NOT NULL,
  locations jsonb DEFAULT '[]'::jsonb,
  categories ARRAY DEFAULT '{}'::text[],
  keywords ARRAY DEFAULT '{}'::text[],
  exclude_ticket_holders boolean DEFAULT false,
  exclude_past_attendees boolean DEFAULT false,
  estimated_reach integer,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT campaign_targeting_pkey PRIMARY KEY (campaign_id),
  CONSTRAINT campaign_targeting_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);

CREATE TABLE public.campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  created_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  objective USER-DEFINED NOT NULL DEFAULT 'ticket_sales'::campaign_objective,
  status USER-DEFINED NOT NULL DEFAULT 'draft'::campaign_status,
  total_budget_credits integer NOT NULL,
  daily_budget_credits integer,
  spent_credits integer NOT NULL DEFAULT 0,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone,
  timezone text NOT NULL DEFAULT 'UTC'::text,
  pacing_strategy USER-DEFINED NOT NULL DEFAULT 'even'::pacing_strategy,
  frequency_cap_per_user integer DEFAULT 3 CHECK (frequency_cap_per_user IS NULL OR frequency_cap_per_user > 0),
  frequency_cap_period USER-DEFINED DEFAULT 'day'::frequency_period,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  archived_at timestamp with time zone,
  CONSTRAINT campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT campaigns_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);

-- =====================================================
-- CHECKOUT & PAYMENT TABLES
-- =====================================================

CREATE TABLE public.checkout_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid,
  user_id uuid,
  event_id uuid,
  status text DEFAULT 'pending'::text,
  hold_ids ARRAY DEFAULT ARRAY[]::uuid[],
  pricing_snapshot jsonb,
  contact_snapshot jsonb,
  verification_state jsonb,
  express_methods jsonb,
  cart_snapshot jsonb,
  stripe_session_id text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT checkout_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT checkout_sessions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT checkout_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT checkout_sessions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);

-- =====================================================
-- INFRASTRUCTURE TABLES
-- =====================================================

CREATE TABLE public.circuit_breaker_state (
  id text NOT NULL,
  state text DEFAULT 'closed'::text CHECK (state = ANY (ARRAY['closed'::text, 'open'::text, 'half_open'::text])),
  failure_count integer DEFAULT 0,
  failure_threshold integer DEFAULT 5,
  timeout_seconds integer DEFAULT 60,
  last_failure_at timestamp with time zone,
  next_attempt_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT circuit_breaker_state_pkey PRIMARY KEY (id)
);

-- =====================================================
-- CONVERSATION SYSTEM TABLES
-- =====================================================

CREATE TABLE public.conversation_participants (
  conversation_id uuid NOT NULL,
  participant_type USER-DEFINED NOT NULL,
  participant_user_id uuid NOT NULL,
  participant_org_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  last_read_at timestamp with time zone,
  CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, participant_type, participant_user_id, participant_org_id),
  CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.direct_conversations(id),
  CONSTRAINT conversation_participants_participant_user_id_fkey FOREIGN KEY (participant_user_id) REFERENCES auth.users(id),
  CONSTRAINT conversation_participants_participant_org_id_fkey FOREIGN KEY (participant_org_id) REFERENCES public.organizations(id)
);

-- =====================================================
-- WALLET & CREDITS TABLES
-- =====================================================

CREATE TABLE public.credit_lots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet_id uuid,
  org_wallet_id uuid,
  quantity_purchased integer NOT NULL CHECK (quantity_purchased > 0),
  quantity_remaining integer NOT NULL,
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  source text NOT NULL CHECK (source = ANY (ARRAY['purchase'::text, 'grant'::text, 'refund'::text, 'promo'::text, 'adjustment'::text])),
  stripe_checkout_session_id text,
  invoice_id uuid,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  depleted_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT credit_lots_pkey PRIMARY KEY (id),
  CONSTRAINT credit_lots_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id),
  CONSTRAINT credit_lots_org_wallet_id_fkey FOREIGN KEY (org_wallet_id) REFERENCES public.org_wallets(id),
  CONSTRAINT credit_lots_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
);

CREATE TABLE public.credit_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  price_usd_cents integer NOT NULL CHECK (price_usd_cents >= 0),
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT credit_packages_pkey PRIMARY KEY (id)
);

-- =====================================================
-- EVENT CORE TABLES
-- =====================================================

CREATE TABLE public.cultural_guides (
  event_id uuid NOT NULL,
  roots_summary text,
  themes ARRAY DEFAULT '{}'::text[],
  community ARRAY DEFAULT '{}'::text[],
  history_long text,
  etiquette_tips ARRAY,
  CONSTRAINT cultural_guides_pkey PRIMARY KEY (event_id),
  CONSTRAINT cultural_guides_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);

CREATE TABLE public.dead_letter_webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  correlation_id uuid,
  webhook_type text NOT NULL,
  payload jsonb NOT NULL,
  original_timestamp timestamp with time zone NOT NULL,
  failure_reason text,
  retry_count integer DEFAULT 0,
  last_retry_at timestamp with time zone,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'retrying'::text, 'failed'::text, 'succeeded'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT dead_letter_webhooks_pkey PRIMARY KEY (id)
);

-- =====================================================
-- SPONSORSHIP SYSTEM TABLES (ENTERPRISE FEATURES)
-- =====================================================

-- Deliverables and proof tracking
CREATE TABLE public.deliverable_proofs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deliverable_id uuid NOT NULL,
  asset_url text NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_by uuid,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  approved_at timestamp with time zone,
  rejected_reason text,
  CONSTRAINT deliverable_proofs_pkey PRIMARY KEY (id),
  CONSTRAINT deliverable_proofs_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id),
  CONSTRAINT deliverable_proofs_deliverable_id_fkey FOREIGN KEY (deliverable_id) REFERENCES public.deliverables(id) ON DELETE CASCADE,
  CONSTRAINT deliverable_proofs_approval_consistency CHECK (
    (approved_at IS NOT NULL AND rejected_reason IS NULL) OR (approved_at IS NULL)
  )
);

COMMENT ON TABLE public.deliverable_proofs IS 'Proof-of-performance artifacts with metrics for sponsor deliverables';

CREATE TABLE public.deliverables (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  sponsor_id uuid NOT NULL,
  type text NOT NULL,
  spec jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (spec IS NOT NULL AND spec <> '{}'::jsonb),
  due_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'submitted'::text, 'needs_changes'::text, 'approved'::text, 'waived'::text])),
  evidence_required boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  order_id uuid,
  package_id uuid,
  package_variant_id uuid,
  CONSTRAINT deliverables_pkey PRIMARY KEY (id),
  CONSTRAINT deliverables_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id) ON DELETE CASCADE,
  CONSTRAINT deliverables_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT deliverables_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sponsorship_orders(id) ON DELETE CASCADE,
  CONSTRAINT deliverables_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.sponsorship_packages(id) ON DELETE SET NULL,
  CONSTRAINT deliverables_package_variant_id_fkey FOREIGN KEY (package_variant_id) REFERENCES public.package_variants(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.deliverables IS 'First-class deliverables tracking for sponsor activations with SLA support';
COMMENT ON COLUMN public.deliverables.order_id IS 'Links deliverable to the specific order it was part of';

-- Direct messaging
CREATE TABLE public.direct_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  subject text,
  request_status USER-DEFINED NOT NULL DEFAULT 'open'::conversation_request_status,
  last_message_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT direct_conversations_pkey PRIMARY KEY (id),
  CONSTRAINT direct_conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

CREATE TABLE public.direct_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_type USER-DEFINED NOT NULL,
  sender_user_id uuid,
  sender_org_id uuid,
  body text NOT NULL,
  attachments jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent'::text,
  CONSTRAINT direct_messages_pkey PRIMARY KEY (id),
  CONSTRAINT direct_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.direct_conversations(id),
  CONSTRAINT direct_messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES auth.users(id),
  CONSTRAINT direct_messages_sender_org_id_fkey FOREIGN KEY (sender_org_id) REFERENCES public.organizations(id)
);

-- =====================================================
-- EVENT INTELLIGENCE TABLES
-- =====================================================

CREATE TABLE public.event_audience_insights (
  event_id uuid NOT NULL,
  attendee_count integer,
  avg_dwell_time_ms integer CHECK (avg_dwell_time_ms IS NULL OR avg_dwell_time_ms >= 0),
  geo_distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  age_segments jsonb NOT NULL DEFAULT '{}'::jsonb,
  engagement_score numeric,
  ticket_conversion_rate numeric,
  social_mentions integer,
  sentiment_score numeric,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  household_income_segments jsonb,
  interests_top ARRAY,
  brand_affinities jsonb,
  source text,
  as_of timestamp with time zone,
  confidence numeric CHECK (confidence >= 0::numeric AND confidence <= 1::numeric),
  CONSTRAINT event_audience_insights_pkey PRIMARY KEY (event_id),
  CONSTRAINT event_audience_insights_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.event_audience_insights IS 'Aggregated event performance and audience metrics for sponsor matching';
COMMENT ON COLUMN public.event_audience_insights.source IS 'Source of the insight data (e.g., "analytics", "survey", "ml_model")';
COMMENT ON COLUMN public.event_audience_insights.as_of IS 'Timestamp when these insights were valid/captured';
COMMENT ON COLUMN public.event_audience_insights.confidence IS 'Confidence score for these insights (0-1)';

-- Event engagement tables
CREATE TABLE public.event_comment_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind = 'like'::text),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_comment_reactions_pkey PRIMARY KEY (id),
  CONSTRAINT event_comment_reactions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.event_comments(id),
  CONSTRAINT event_comment_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.event_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  author_user_id uuid NOT NULL,
  text text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  client_id text,
  CONSTRAINT event_comments_pkey PRIMARY KEY (id),
  CONSTRAINT event_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.event_posts(id),
  CONSTRAINT event_comments_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES auth.users(id)
);

-- Event impressions (partitioned for performance)
CREATE TABLE public.event_impressions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid,
  session_id text CHECK (session_id IS NULL OR length(session_id) >= 16 AND length(session_id) <= 64),
  dwell_ms integer DEFAULT 0 CHECK (dwell_ms >= 0 AND dwell_ms <= (60 * 60 * 1000)),
  completed boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_impressions_pkey PRIMARY KEY (id),
  CONSTRAINT event_impressions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_impressions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Partitioned table for event_impressions (improved query performance)
CREATE TABLE public.event_impressions_p (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid,
  session_id text CHECK (session_id IS NULL OR length(session_id) >= 16 AND length(session_id) <= 64),
  dwell_ms integer DEFAULT 0 CHECK (dwell_ms >= 0 AND dwell_ms <= (60 * 60 * 1000)),
  completed boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_impressions_p_pkey PRIMARY KEY (id, created_at),
  CONSTRAINT event_impressions_p_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_impressions_p_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE public.event_impressions_p IS 'Partitioned event impressions by month for improved query performance';

-- Monthly partitions (18+ months from April 2024 to May 2025+)
-- Note: Individual partition tables omitted for brevity
-- Pattern: event_impressions_p_YYYYMM

-- Default partition for out-of-range data
CREATE TABLE public.event_impressions_default PARTITION OF public.event_impressions_p DEFAULT;

-- =====================================================
-- EVENT MANAGEMENT TABLES
-- =====================================================

CREATE TABLE public.event_invites (
  event_id uuid NOT NULL,
  user_id uuid,
  email text NOT NULL,
  role text DEFAULT 'viewer'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_invites_pkey PRIMARY KEY (event_id, email),
  CONSTRAINT event_invites_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);

CREATE TABLE public.event_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  author_user_id uuid NOT NULL,
  ticket_tier_id uuid,
  text text,
  media_urls ARRAY DEFAULT '{}'::text[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone,
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  deleted_at timestamp with time zone,
  CONSTRAINT event_posts_pkey PRIMARY KEY (id),
  CONSTRAINT event_posts_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_posts_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES auth.users(id),
  CONSTRAINT event_posts_ticket_tier_id_fkey FOREIGN KEY (ticket_tier_id) REFERENCES public.ticket_tiers(id)
);

CREATE TABLE public.event_reactions (
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'like'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_reactions_pkey PRIMARY KEY (post_id, user_id, kind),
  CONSTRAINT event_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.event_posts(id),
  CONSTRAINT event_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.event_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  status text NOT NULL DEFAULT 'active'::text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_roles_pkey PRIMARY KEY (id),
  CONSTRAINT event_roles_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT event_roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

CREATE TABLE public.event_scanners (
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'enabled'::text,
  invited_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_scanners_pkey PRIMARY KEY (event_id, user_id),
  CONSTRAINT event_scanners_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_scanners_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT event_scanners_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id)
);

CREATE TABLE public.event_series (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  organization_id uuid NOT NULL,
  created_by uuid NOT NULL,
  recurrence USER-DEFINED NOT NULL,
  recurrence_interval integer NOT NULL DEFAULT 1,
  series_start timestamp with time zone NOT NULL,
  series_end date NOT NULL,
  max_events integer,
  timezone text NOT NULL DEFAULT 'UTC'::text,
  template jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_series_pkey PRIMARY KEY (id),
  CONSTRAINT event_series_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);

CREATE TABLE public.event_share_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  event_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['story_video'::text, 'story_image'::text, 'link_video'::text, 'link_image'::text])),
  storage_path text,
  mux_upload_id text,
  mux_asset_id text,
  mux_playback_id text,
  poster_url text,
  duration_seconds integer,
  width integer,
  height integer,
  active boolean NOT NULL DEFAULT true,
  title text,
  caption text,
  CONSTRAINT event_share_assets_pkey PRIMARY KEY (id),
  CONSTRAINT event_share_assets_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);

CREATE TABLE public.event_sponsorships (
  event_id uuid NOT NULL,
  sponsor_id uuid NOT NULL,
  tier text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  benefits jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  activation_status text DEFAULT 'draft'::text,
  deliverables jsonb DEFAULT '{}'::jsonb,
  roi_summary jsonb DEFAULT '{}'::jsonb,
  deliverables_due_date timestamp with time zone,
  deliverables_submitted_at timestamp with time zone,
  organizer_approved_at timestamp with time zone,
  evaluation_notes text,
  contract_id uuid,
  activation_state text CHECK (activation_state = ANY (ARRAY['draft'::text, 'in_progress'::text, 'complete'::text])),
  sla_id uuid,
  CONSTRAINT event_sponsorships_pkey PRIMARY KEY (event_id, sponsor_id, tier),
  CONSTRAINT event_sponsorships_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id),
  CONSTRAINT event_sponsorships_sla_id_fkey FOREIGN KEY (sla_id) REFERENCES public.sponsorship_slas(id),
  CONSTRAINT event_sponsorships_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.event_sponsorships IS 'Legacy event sponsorship records with activation tracking';

CREATE TABLE public.event_stat_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  metric_key text NOT NULL,
  metric_value numeric,
  captured_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_stat_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT event_stat_snapshots_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.event_stat_snapshots IS 'Time-series snapshots of event metrics for package stats and ROI reporting';

CREATE TABLE public.event_video_counters (
  event_id uuid NOT NULL,
  views_total bigint DEFAULT 0,
  views_unique bigint DEFAULT 0,
  completions bigint DEFAULT 0,
  avg_dwell_ms bigint DEFAULT 0,
  clicks_tickets bigint DEFAULT 0,
  clicks_details bigint DEFAULT 0,
  clicks_organizer bigint DEFAULT 0,
  clicks_share bigint DEFAULT 0,
  clicks_comment bigint DEFAULT 0,
  likes bigint DEFAULT 0,
  comments bigint DEFAULT 0,
  shares bigint DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_video_counters_pkey PRIMARY KEY (event_id),
  CONSTRAINT event_video_counters_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);

-- =====================================================
-- EVENTS MAIN TABLE
-- =====================================================

CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_context_type USER-DEFINED NOT NULL,
  owner_context_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  cover_image_url text,
  start_at timestamp with time zone NOT NULL,
  end_at timestamp with time zone NOT NULL,
  timezone text,
  venue text,
  address text,
  city text,
  country text,
  lat double precision,
  lng double precision,
  visibility USER-DEFINED DEFAULT 'public'::event_visibility,
  refund_cutoff_days integer DEFAULT 7,
  hold_payout_until_end boolean DEFAULT true,
  slug text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  link_token text,
  series_id uuid,
  description_embedding vector(384),  -- Vector embedding for semantic search
  brand_safety_tags ARRAY,
  target_audience jsonb,
  sponsorable boolean NOT NULL DEFAULT true,
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(user_id),
  CONSTRAINT events_owner_context_id_fkey FOREIGN KEY (owner_context_id) REFERENCES public.organizations(id),
  CONSTRAINT events_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.event_series(id)
);

COMMENT ON TABLE public.events IS 'Core events table with sponsorship and semantic search capabilities';
COMMENT ON COLUMN public.events.description_embedding IS 'Vector embedding of event description for semantic matching (384-dim)';
COMMENT ON COLUMN public.events.sponsorable IS 'Whether this event accepts sponsorships';

-- =====================================================
-- MATCHING & ML TABLES
-- =====================================================

CREATE TABLE public.fit_recalc_queue (
  id bigint NOT NULL DEFAULT nextval('fit_recalc_queue_id_seq'::regclass),
  event_id uuid,
  sponsor_id uuid,
  reason text NOT NULL,
  queued_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  CONSTRAINT fit_recalc_queue_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.fit_recalc_queue IS 'Queue for incremental recalculation of sponsor-event match scores';

CREATE TABLE public.match_features (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  sponsor_id uuid NOT NULL,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  computed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT match_features_pkey PRIMARY KEY (id),
  CONSTRAINT match_features_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT match_features_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id) ON DELETE CASCADE,
  UNIQUE (event_id, sponsor_id, version)
);

COMMENT ON TABLE public.match_features IS 'Feature store for ML matching signals with versioning support';

CREATE TABLE public.match_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  sponsor_id uuid NOT NULL,
  user_id uuid NOT NULL,
  label text NOT NULL CHECK (label = ANY (ARRAY['good_fit'::text, 'bad_fit'::text, 'later'::text])),
  reason_codes ARRAY NOT NULL DEFAULT '{}'::text[],
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT match_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT match_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT match_feedback_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT match_feedback_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.match_feedback IS 'Human-in-the-loop feedback for improving match algorithms';

-- =====================================================
-- MESSAGING & COMMUNICATIONS TABLES
-- =====================================================

CREATE TABLE public.message_job_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  user_id uuid,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'pending'::text,
  error text,
  sent_at timestamp with time zone,
  CONSTRAINT message_job_recipients_pkey PRIMARY KEY (id),
  CONSTRAINT message_job_recipients_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.message_jobs(id),
  CONSTRAINT message_job_recipients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.message_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  channel USER-DEFINED NOT NULL,
  template_id uuid,
  subject text,
  body text,
  sms_body text,
  from_name text,
  from_email text,
  status USER-DEFINED NOT NULL DEFAULT 'draft'::job_status,
  batch_size integer NOT NULL DEFAULT 200,
  scheduled_at timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reply_to text,
  CONSTRAINT message_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT message_jobs_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT message_jobs_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.message_templates(id),
  CONSTRAINT message_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

CREATE TABLE public.message_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  channel USER-DEFINED NOT NULL,
  subject text,
  body text,
  sms_body text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT message_templates_pkey PRIMARY KEY (id),
  CONSTRAINT message_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id),
  CONSTRAINT message_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

-- =====================================================
-- SYSTEM TABLES
-- =====================================================

CREATE TABLE public.mv_refresh_log (
  id bigint NOT NULL DEFAULT nextval('mv_refresh_log_id_seq'::regclass),
  ran_at timestamp with time zone DEFAULT now(),
  concurrent boolean NOT NULL,
  duration_ms integer,
  note text,
  CONSTRAINT mv_refresh_log_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.mv_refresh_log IS 'Logs for materialized view refresh operations';

CREATE TABLE public.negative_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type = ANY (ARRAY['event'::text, 'post'::text])),
  target_id uuid NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT negative_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT negative_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['success'::text, 'error'::text, 'warning'::text, 'info'::text])),
  action_url text,
  event_type text,
  data jsonb,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- =====================================================
-- ORDERS & TICKETS TABLES
-- =====================================================

CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  tier_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_cents integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.ticket_tiers(id)
);

CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::order_status,
  subtotal_cents integer NOT NULL DEFAULT 0,
  fees_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD'::text CHECK (currency = ANY (ARRAY['USD'::text, 'EUR'::text, 'GBP'::text, 'CAD'::text])),
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text UNIQUE,
  payout_destination_owner USER-DEFINED,
  payout_destination_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  paid_at timestamp with time zone,
  hold_ids ARRAY DEFAULT '{}'::uuid[],
  tickets_issued_count integer DEFAULT 0,
  checkout_session_id text,
  contact_email text,
  contact_name text,
  contact_phone text,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT orders_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);

-- =====================================================
-- ORGANIZATION TABLES
-- =====================================================

CREATE TABLE public.org_contact_import_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL,
  full_name text,
  email text,
  phone text,
  tags ARRAY DEFAULT ARRAY[]::text[],
  consent text DEFAULT 'unknown'::text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT org_contact_import_entries_pkey PRIMARY KEY (id),
  CONSTRAINT org_contact_import_entries_import_id_fkey FOREIGN KEY (import_id) REFERENCES public.org_contact_imports(id)
);

CREATE TABLE public.org_contact_imports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  source text,
  imported_by uuid,
  imported_at timestamp with time zone DEFAULT now(),
  original_row_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT org_contact_imports_pkey PRIMARY KEY (id),
  CONSTRAINT org_contact_imports_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id),
  CONSTRAINT org_contact_imports_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES auth.users(id)
);

CREATE TABLE public.org_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer'::text CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text, 'viewer'::text])),
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  invited_by uuid NOT NULL,
  accepted_user_id uuid,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'revoked'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone,
  CONSTRAINT org_invitations_pkey PRIMARY KEY (id),
  CONSTRAINT org_invitations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id),
  CONSTRAINT org_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id),
  CONSTRAINT org_invitations_accepted_user_id_fkey FOREIGN KEY (accepted_user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.org_memberships (
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'viewer'::org_role,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT org_memberships_pkey PRIMARY KEY (org_id, user_id),
  CONSTRAINT org_memberships_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id),
  CONSTRAINT org_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.org_wallet_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL,
  credits_delta integer NOT NULL CHECK (credits_delta <> 0),
  transaction_type text NOT NULL CHECK (transaction_type = ANY (ARRAY['purchase'::text, 'spend'::text, 'refund'::text, 'adjustment'::text])),
  description text,
  reference_type text,
  reference_id uuid,
  invoice_id uuid,
  stripe_event_id text UNIQUE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT org_wallet_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT org_wallet_transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.org_wallets(id)
);

CREATE TABLE public.org_wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE,
  balance_credits integer NOT NULL DEFAULT 0,
  low_balance_threshold integer NOT NULL DEFAULT 1000,
  auto_reload_enabled boolean NOT NULL DEFAULT false,
  auto_reload_topup_credits integer DEFAULT 5000,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'frozen'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT org_wallets_pkey PRIMARY KEY (id),
  CONSTRAINT org_wallets_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);

CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  handle text UNIQUE,
  logo_url text,
  verification_status USER-DEFINED DEFAULT 'none'::verification_status,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  is_verified boolean DEFAULT false,
  description text,
  social_links jsonb DEFAULT '[]'::jsonb,
  banner_url text,
  website_url text,
  twitter_url text,
  instagram_url text,
  tiktok_url text,
  location text,
  support_email text,
  CONSTRAINT organizations_pkey PRIMARY KEY (id),
  CONSTRAINT organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

-- =====================================================
-- PACKAGE SYSTEM TABLES
-- =====================================================

CREATE TABLE public.package_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  default_price_cents integer NOT NULL CHECK (default_price_cents >= 0),
  default_benefits jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'private'::text CHECK (visibility = ANY (ARRAY['private'::text, 'org'::text, 'public'::text])),
  version integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT package_templates_pkey PRIMARY KEY (id),
  CONSTRAINT package_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.package_templates IS 'Reusable sponsorship package blueprints';

CREATE TABLE public.package_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL,
  label text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  benefits jsonb NOT NULL DEFAULT '{}'::jsonb,
  inventory integer NOT NULL DEFAULT 1 CHECK (inventory >= 0),
  stat_snapshot_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT package_variants_pkey PRIMARY KEY (id),
  CONSTRAINT package_variants_stat_snapshot_id_fkey FOREIGN KEY (stat_snapshot_id) REFERENCES public.event_stat_snapshots(id),
  CONSTRAINT package_variants_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.sponsorship_packages(id) ON DELETE CASCADE,
  CONSTRAINT package_variants_unique_label_per_package UNIQUE (package_id, label)
);

COMMENT ON TABLE public.package_variants IS 'Package variants for A/B testing different offers';

-- =====================================================
-- PAYOUT SYSTEM TABLES
-- =====================================================

CREATE TABLE public.payout_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  context_type USER-DEFINED NOT NULL,
  context_id uuid NOT NULL,
  stripe_connect_id text UNIQUE,
  charges_enabled boolean DEFAULT false,
  payouts_enabled boolean DEFAULT false,
  details_submitted boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payout_accounts_pkey PRIMARY KEY (id)
);

CREATE TABLE public.payout_configurations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE,
  stripe_connect_account_id text NOT NULL,
  platform_fee_percentage numeric NOT NULL DEFAULT 0.05 CHECK (platform_fee_percentage >= 0::numeric AND platform_fee_percentage <= 1::numeric),
  minimum_payout_amount_cents integer NOT NULL DEFAULT 1000 CHECK (minimum_payout_amount_cents > 0),
  payout_schedule text NOT NULL DEFAULT 'manual'::text CHECK (payout_schedule = ANY (ARRAY['manual'::text, 'daily'::text, 'weekly'::text, 'monthly'::text])),
  auto_payout_enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payout_configurations_pkey PRIMARY KEY (id),
  CONSTRAINT payout_configurations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.payout_configurations IS 'Payout configuration per organization for Stripe Connect';

CREATE TABLE public.payout_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  priority integer DEFAULT 0 CHECK (priority >= 0),
  scheduled_for timestamp with time zone NOT NULL DEFAULT now(),
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])),
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  CONSTRAINT payout_queue_pkey PRIMARY KEY (id),
  CONSTRAINT payout_queue_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sponsorship_orders(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.payout_queue IS 'Queue for processing sponsorship payouts with retry logic';

-- =====================================================
-- POST ENGAGEMENT TABLES
-- =====================================================

CREATE TABLE public.post_clicks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  event_id uuid NOT NULL,
  user_id uuid,
  session_id text,
  target text NOT NULL,
  source text,
  created_at timestamp with time zone DEFAULT now(),
  user_agent text,
  ip_address inet,
  CONSTRAINT post_clicks_pkey PRIMARY KEY (id)
);

CREATE TABLE public.post_impressions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid,
  session_id text CHECK (session_id IS NULL OR length(session_id) >= 16 AND length(session_id) <= 64),
  dwell_ms integer DEFAULT 0 CHECK (dwell_ms >= 0 AND dwell_ms <= (60 * 60 * 1000)),
  completed boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT post_impressions_pkey PRIMARY KEY (id),
  CONSTRAINT post_impressions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.event_posts(id),
  CONSTRAINT post_impressions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.post_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  event_id uuid NOT NULL,
  user_id uuid,
  session_id text,
  source text,
  qualified boolean DEFAULT false,
  completed boolean DEFAULT false,
  dwell_ms integer DEFAULT 0,
  watch_percentage integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  user_agent text,
  ip_address inet,
  CONSTRAINT post_views_pkey PRIMARY KEY (id)
);

-- =====================================================
-- PROMOTIONS & PROMOS
-- =====================================================

CREATE TABLE public.promos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type = ANY (ARRAY['percent'::text, 'amount'::text, 'extra_credits'::text])),
  value integer NOT NULL,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  max_uses integer,
  per_user_limit integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT promos_pkey PRIMARY KEY (id)
);

-- =====================================================
-- PROPOSAL & NEGOTIATION TABLES
-- =====================================================

CREATE TABLE public.proposal_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  sender_type text NOT NULL CHECK (sender_type = ANY (ARRAY['organizer'::text, 'sponsor'::text])),
  sender_user_id uuid NOT NULL,
  body text,
  offer jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (offer IS NOT NULL AND offer <> '{}'::jsonb),
  attachments jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT proposal_messages_pkey PRIMARY KEY (id),
  CONSTRAINT proposal_messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES auth.users(id),
  CONSTRAINT proposal_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.proposal_threads(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.proposal_messages IS 'Individual messages and offers within a sponsorship proposal thread';

CREATE TABLE public.proposal_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  sponsor_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'counter'::text, 'accepted'::text, 'rejected'::text, 'expired'::text])),
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT proposal_threads_pkey PRIMARY KEY (id),
  CONSTRAINT proposal_threads_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id) ON DELETE CASCADE,
  CONSTRAINT proposal_threads_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT proposal_threads_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT proposal_threads_terminal_states CHECK (
    (status NOT IN ('accepted', 'rejected', 'expired')) OR (updated_at >= created_at)
  )
);

COMMENT ON TABLE public.proposal_threads IS 'Negotiation threads between event organizers and sponsors';

-- Unique index: only one active proposal per event-sponsor pair
CREATE UNIQUE INDEX proposal_threads_one_open
  ON public.proposal_threads (event_id, sponsor_id)
  WHERE status IN ('draft', 'sent', 'counter');

COMMENT ON INDEX proposal_threads_one_open IS 'Ensures only one active negotiation thread per event-sponsor pair';

-- =====================================================
-- RATE LIMITING & SECURITY
-- =====================================================

CREATE TABLE public.rate_limits (
  user_id uuid NOT NULL,
  bucket text NOT NULL,
  minute timestamp with time zone NOT NULL,
  count integer DEFAULT 1,
  ip_hash text,
  CONSTRAINT rate_limits_pkey PRIMARY KEY (user_id, bucket, minute)
);

CREATE TABLE public.refunds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT refunds_pkey PRIMARY KEY (id),
  CONSTRAINT refunds_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT refunds_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

CREATE TABLE public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reported_by uuid,
  target_type text NOT NULL CHECK (target_type = ANY (ARRAY['post'::text, 'event'::text, 'user'::text])),
  target_id uuid NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reports_pkey PRIMARY KEY (id),
  CONSTRAINT reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES auth.users(id)
);

CREATE TABLE public.request_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  correlation_id uuid,
  source_type text NOT NULL,
  function_name text,
  http_method text,
  url text,
  headers jsonb,
  body jsonb,
  response_status integer CHECK (response_status IS NULL OR response_status >= 100 AND response_status <= 599),
  response_body jsonb,
  execution_time_ms integer,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT request_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.role_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  email text,
  phone text,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  invited_by uuid NOT NULL,
  accepted_user_id uuid,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::invite_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone,
  CONSTRAINT role_invites_pkey PRIMARY KEY (id),
  CONSTRAINT role_invites_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT role_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id)
);

-- =====================================================
-- SCANNING & TICKETING TABLES
-- =====================================================

CREATE TABLE public.scan_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  ticket_id uuid,
  scanner_user_id uuid,
  result text NOT NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT scan_logs_pkey PRIMARY KEY (id),
  CONSTRAINT scan_logs_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT scan_logs_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id),
  CONSTRAINT scan_logs_scanner_user_id_fkey FOREIGN KEY (scanner_user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.share_links (
  code text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  content_type text NOT NULL CHECK (content_type = ANY (ARRAY['event'::text, 'post'::text, 'org'::text, 'user'::text])),
  content_id uuid NOT NULL,
  channel text,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  clicks integer NOT NULL DEFAULT 0,
  last_clicked_at timestamp with time zone,
  CONSTRAINT share_links_pkey PRIMARY KEY (code)
);

-- =====================================================
-- SPONSOR SYSTEM TABLES (CORE)
-- =====================================================

CREATE TABLE public.sponsor_members (
  sponsor_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'viewer'::sponsor_role,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sponsor_members_pkey PRIMARY KEY (sponsor_id, user_id),
  CONSTRAINT sponsor_members_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id),
  CONSTRAINT sponsor_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.sponsor_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL UNIQUE,
  industry text,
  company_size text,
  annual_budget_cents integer CHECK (annual_budget_cents IS NULL OR annual_budget_cents >= 0),
  brand_objectives jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferred_categories ARRAY NOT NULL DEFAULT '{}'::text[],
  regions ARRAY NOT NULL DEFAULT '{}'::text[],
  activation_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  reputation_score numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  objectives_embedding vector(384),  -- Vector embedding for semantic matching
  verification_status text DEFAULT 'none'::text CHECK (verification_status = ANY (ARRAY['none'::text, 'pending'::text, 'verified'::text, 'revoked'::text])),
  public_visibility text DEFAULT 'full'::text CHECK (public_visibility = ANY (ARRAY['hidden'::text, 'limited'::text, 'full'::text])),
  case_studies jsonb,
  preferred_formats ARRAY,
  CONSTRAINT sponsor_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT sponsor_profiles_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.sponsor_profiles IS 'Extended sponsor profiles with targeting preferences and ML embeddings';
COMMENT ON COLUMN public.sponsor_profiles.objectives_embedding IS 'Vector embedding of sponsor objectives for semantic matching (384-dim)';

CREATE TABLE public.sponsor_public_profiles (
  sponsor_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  headline text,
  about text,
  brand_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  badges ARRAY NOT NULL DEFAULT '{}'::text[],
  is_verified boolean NOT NULL DEFAULT false,
  social_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sponsor_public_profiles_pkey PRIMARY KEY (sponsor_id),
  CONSTRAINT sponsor_public_profiles_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.sponsor_public_profiles IS 'Public-facing sponsor profiles for discovery and trust building';

CREATE TABLE public.sponsors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  website_url text,
  contact_email text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  industry text,
  company_size text,
  brand_values jsonb DEFAULT '{}'::jsonb,
  preferred_visibility_options jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sponsors_pkey PRIMARY KEY (id),
  CONSTRAINT sponsors_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

COMMENT ON TABLE public.sponsors IS 'Core sponsor entities with basic information';

-- =====================================================
-- SPONSORSHIP MATCHING TABLES
-- =====================================================

CREATE TABLE public.sponsorship_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  sponsor_id uuid NOT NULL,
  score numeric NOT NULL DEFAULT 0 CHECK (score >= 0::numeric AND score <= 1::numeric),
  overlap_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'suggested'::text, 'accepted'::text, 'rejected'::text])),
  viewed_at timestamp with time zone,
  contacted_at timestamp with time zone,
  declined_reason text,
  notes text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  explanations jsonb,
  reason_codes ARRAY,
  CONSTRAINT sponsorship_matches_pkey PRIMARY KEY (id),
  CONSTRAINT sponsorship_matches_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT sponsorship_matches_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id) ON DELETE CASCADE,
  CONSTRAINT sponsorship_matches_event_sponsor_unique UNIQUE (event_id, sponsor_id)
);

COMMENT ON TABLE public.sponsorship_matches IS 'AI-powered sponsor-event match scores with explainable breakdowns';
COMMENT ON CONSTRAINT sponsorship_matches_event_sponsor_unique ON public.sponsorship_matches IS 'Ensures one match score per event-sponsor pair for idempotency';

-- Unique index: only one active match per pair
CREATE UNIQUE INDEX sponsorship_matches_unique_active
  ON public.sponsorship_matches (event_id, sponsor_id)
  WHERE status IN ('pending', 'suggested', 'accepted');

COMMENT ON INDEX sponsorship_matches_unique_active IS 'Ensures only one active match per event-sponsor pair';

-- =====================================================
-- SPONSORSHIP ORDERS & PAYMENTS
-- =====================================================

CREATE TABLE public.sponsorship_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL,
  sponsor_id uuid NOT NULL,
  event_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  status USER-DEFINED NOT NULL DEFAULT 'pending'::sponsorship_status,
  escrow_tx_id text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  currency text NOT NULL DEFAULT 'USD'::text CHECK (currency = ANY (ARRAY['USD'::text, 'EUR'::text, 'GBP'::text, 'CAD'::text])),
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_transfer_id text,
  transfer_group text,
  application_fee_cents integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  milestone jsonb DEFAULT '{}'::jsonb,
  proof_assets jsonb DEFAULT '{}'::jsonb,
  roi_report_id uuid,
  created_by_user_id uuid,
  last_modified_by uuid,
  version_number integer DEFAULT 1,
  review_score numeric CHECK (review_score >= 0::numeric AND review_score <= 5::numeric),
  organizer_stripe_account_id text,
  payout_status text DEFAULT 'pending'::text CHECK (payout_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])),
  payout_attempts integer DEFAULT 0,
  last_payout_attempt_at timestamp with time zone,
  payout_failure_reason text,
  contract_url text,
  escrow_state text CHECK (escrow_state = ANY (ARRAY['pending'::text, 'funded'::text, 'locked'::text, 'released'::text, 'refunded'::text])),
  cancellation_policy jsonb,
  invoice_id uuid,
  CONSTRAINT sponsorship_orders_pkey PRIMARY KEY (id),
  CONSTRAINT sponsorship_orders_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.sponsorship_packages(id),
  CONSTRAINT sponsorship_orders_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id),
  CONSTRAINT sponsorship_orders_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id),
  CONSTRAINT sponsorship_orders_last_modified_by_fkey FOREIGN KEY (last_modified_by) REFERENCES auth.users(id),
  CONSTRAINT sponsorship_orders_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id),
  CONSTRAINT sponsorship_orders_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT sponsorship_orders_state_consistency CHECK (
    escrow_state IS NULL
    OR (status = 'pending' AND escrow_state IN ('pending', 'funded', 'locked'))
    OR (status = 'completed' AND escrow_state IN ('released', 'locked'))
    OR (status = 'cancelled' AND escrow_state IN ('refunded', 'released', 'pending'))
  )
);

COMMENT ON TABLE public.sponsorship_orders IS 'Sponsorship purchase orders with Stripe Connect integration and escrow tracking';
COMMENT ON CONSTRAINT sponsorship_orders_state_consistency ON public.sponsorship_orders IS 'Enforces coherence between order status and escrow state';

-- =====================================================
-- SPONSORSHIP PACKAGES
-- =====================================================

CREATE TABLE public.sponsorship_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  tier text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  inventory integer NOT NULL DEFAULT 1 CHECK (inventory >= 0),
  benefits jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'public'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  description text,
  currency text NOT NULL DEFAULT 'USD'::text CHECK (currency = ANY (ARRAY['USD'::text, 'EUR'::text, 'GBP'::text, 'CAD'::text])),
  sold integer NOT NULL DEFAULT 0 CHECK (sold >= 0 AND sold <= inventory),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  expected_reach integer CHECK (expected_reach IS NULL OR expected_reach >= 0),
  avg_engagement_score numeric,
  package_type text,
  stat_snapshot_id uuid,
  quality_score integer CHECK (quality_score IS NULL OR quality_score >= 0 AND quality_score <= 100),
  quality_updated_at timestamp with time zone,
  template_id uuid,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  availability jsonb,
  audience_snapshot jsonb,
  constraints jsonb,
  CONSTRAINT sponsorship_packages_pkey PRIMARY KEY (id),
  CONSTRAINT sponsorship_packages_stat_snapshot_id_fkey FOREIGN KEY (stat_snapshot_id) REFERENCES public.event_stat_snapshots(id),
  CONSTRAINT sponsorship_packages_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.package_templates(id),
  CONSTRAINT sponsorship_packages_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT sponsorship_packages_event_tier_version_unique UNIQUE (event_id, tier, version)
);

COMMENT ON TABLE public.sponsorship_packages IS 'Sponsorship packages with quality scores, templates, and inventory tracking';
COMMENT ON CONSTRAINT sponsorship_packages_event_tier_version_unique ON public.sponsorship_packages IS 'Ensures unique tier and version combination per event';

-- =====================================================
-- SPONSORSHIP PAYOUTS
-- =====================================================

CREATE TABLE public.sponsorship_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  organizer_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  application_fee_cents integer NOT NULL DEFAULT 0 CHECK (application_fee_cents >= 0 AND application_fee_cents < amount_cents),
  stripe_transfer_id text,
  stripe_payout_id text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])),
  failure_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  CONSTRAINT sponsorship_payouts_pkey PRIMARY KEY (id),
  CONSTRAINT sponsorship_payouts_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT sponsorship_payouts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sponsorship_orders(id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.sponsorship_payouts IS 'Individual payout transactions to organizers via Stripe Connect';

-- =====================================================
-- SPONSORSHIP SLA TABLES
-- =====================================================

CREATE TABLE public.sponsorship_slas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  sponsor_id uuid NOT NULL,
  deliverable_id uuid,
  metric text NOT NULL,
  target numeric NOT NULL,
  breach_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sponsorship_slas_pkey PRIMARY KEY (id),
  CONSTRAINT sponsorship_slas_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id) ON DELETE CASCADE,
  CONSTRAINT sponsorship_slas_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT sponsorship_slas_deliverable_id_fkey FOREIGN KEY (deliverable_id) REFERENCES public.deliverables(id) ON DELETE SET NULL,
  CONSTRAINT sponsorship_slas_metric_unique UNIQUE (event_id, sponsor_id, metric)
);

COMMENT ON TABLE public.sponsorship_slas IS 'Service level agreements with metrics, targets, and breach policies';
COMMENT ON CONSTRAINT sponsorship_slas_metric_unique ON public.sponsorship_slas IS 'Prevents duplicate SLA metrics for the same event-sponsor pair';

-- =====================================================
-- TICKET ANALYTICS (PARTITIONED)
-- =====================================================

CREATE TABLE public.ticket_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['ticket_view'::text, 'qr_code_view'::text, 'ticket_share'::text, 'ticket_copy'::text, 'wallet_download'::text])),
  ticket_id uuid NOT NULL,
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ticket_analytics_pkey PRIMARY KEY (id),
  CONSTRAINT ticket_analytics_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id),
  CONSTRAINT ticket_analytics_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT ticket_analytics_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Partitioned table for ticket_analytics
CREATE TABLE public.ticket_analytics_p (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['ticket_view'::text, 'qr_code_view'::text, 'ticket_share'::text, 'ticket_copy'::text, 'wallet_download'::text])),
  ticket_id uuid NOT NULL,
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ticket_analytics_p_pkey PRIMARY KEY (id, created_at),
  CONSTRAINT ticket_analytics_p_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id),
  CONSTRAINT ticket_analytics_p_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT ticket_analytics_p_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE public.ticket_analytics_p IS 'Partitioned ticket analytics by month for improved query performance';

-- Default partition
CREATE TABLE public.ticket_analytics_default PARTITION OF public.ticket_analytics_p DEFAULT;

-- Monthly partitions (18+ months)
-- Note: Individual partition tables omitted for brevity
-- Pattern: ticket_analytics_p_YYYYMM

-- =====================================================
-- TICKETS & TIERS
-- =====================================================

CREATE TABLE public.ticket_holds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tier_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  session_id text,
  user_id uuid,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'consumed'::text, 'expired'::text, 'released'::text])),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  order_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT ticket_holds_pkey PRIMARY KEY (id),
  CONSTRAINT ticket_holds_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.ticket_tiers(id),
  CONSTRAINT ticket_holds_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);

CREATE TABLE public.ticket_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  name text NOT NULL,
  badge_label text,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD'::text CHECK (currency = ANY (ARRAY['USD'::text, 'EUR'::text, 'GBP'::text, 'CAD'::text])),
  quantity integer,
  max_per_order integer DEFAULT 6,
  sales_start timestamp with time zone,
  sales_end timestamp with time zone,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'sold_out'::text])),
  sort_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  total_quantity integer,
  sold_quantity integer DEFAULT 0 CHECK (sold_quantity >= 0),
  reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  issued_quantity integer NOT NULL DEFAULT 0,
  CONSTRAINT ticket_tiers_pkey PRIMARY KEY (id),
  CONSTRAINT ticket_tiers_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);

CREATE TABLE public.tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  tier_id uuid NOT NULL,
  order_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'issued'::ticket_status,
  qr_code text NOT NULL DEFAULT gen_qr_code() UNIQUE CHECK (char_length(qr_code) = 8 AND qr_code ~ '^[A-HJ-NP-Z2-9]{8}$'::text),
  wallet_pass_url text,
  redeemed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  serial_no integer NOT NULL CHECK (serial_no >= 1),
  CONSTRAINT tickets_pkey PRIMARY KEY (id),
  CONSTRAINT tickets_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT tickets_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.ticket_tiers(id),
  CONSTRAINT tickets_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT tickets_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id)
);

-- =====================================================
-- USER TABLES
-- =====================================================

CREATE TABLE public.user_embeddings (
  user_id uuid NOT NULL,
  embedding USER-DEFINED,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_embeddings_pkey PRIMARY KEY (user_id)
);

CREATE TABLE public.user_event_interactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  interaction_type text NOT NULL CHECK (interaction_type = ANY (ARRAY['event_view'::text, 'video_watch'::text, 'like'::text, 'comment'::text, 'share'::text, 'ticket_open'::text, 'ticket_purchase'::text])),
  weight integer NOT NULL DEFAULT 1,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_event_interactions_pkey PRIMARY KEY (id),
  CONSTRAINT user_event_interactions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);

CREATE TABLE public.user_profiles (
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  phone text,
  photo_url text,
  role text DEFAULT 'attendee'::text CHECK (role = ANY (ARRAY['attendee'::text, 'organizer'::text])),
  verification_status USER-DEFINED DEFAULT 'none'::verification_status,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  social_links jsonb DEFAULT '[]'::jsonb CHECK (jsonb_array_length(social_links) <= 3),
  sponsor_mode_enabled boolean NOT NULL DEFAULT false,
  bio text,
  location text,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- =====================================================
-- WALLET & TRANSACTION TABLES
-- =====================================================

CREATE TABLE public.wallet_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['purchase'::text, 'spend'::text, 'refund'::text, 'adjustment'::text, 'promo'::text])),
  credits_delta integer NOT NULL,
  usd_cents integer,
  reference_type text,
  reference_id text,
  memo text,
  idempotency_key text UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT wallet_transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id)
);

CREATE TABLE public.wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance_credits integer NOT NULL DEFAULT 0,
  low_balance_threshold integer NOT NULL DEFAULT 0,
  auto_reload_enabled boolean NOT NULL DEFAULT false,
  auto_reload_topup_credits integer,
  default_payment_method_id text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'frozen'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT wallets_pkey PRIMARY KEY (id),
  CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.audience_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  segment_key text NOT NULL,
  scope text NOT NULL CHECK (scope = ANY (ARRAY['aggregated'::text, 'cohort'::text, 'pseudonymous'::text])),
  consent_basis text NOT NULL,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audience_consents_pkey PRIMARY KEY (id),
  CONSTRAINT audience_consents_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
  CONSTRAINT audience_consents_event_segment_scope_unique UNIQUE (event_id, segment_key, scope)
);

COMMENT ON TABLE public.audience_consents IS 'GDPR/privacy-compliant audience data sharing consent tracking';

CREATE TABLE public.idempotency_keys (
  key text NOT NULL,
  user_id uuid NOT NULL,
  response jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT idempotency_keys_pkey PRIMARY KEY (key)
);

COMMENT ON TABLE public.idempotency_keys IS 'Idempotency key storage for preventing duplicate API requests';

CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet_id uuid,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  amount_usd_cents integer NOT NULL CHECK (amount_usd_cents >= 0),
  credits_purchased integer NOT NULL CHECK (credits_purchased >= 0),
  promo_code text,
  tax_usd_cents integer NOT NULL DEFAULT 0 CHECK (tax_usd_cents >= 0),
  status text NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text])),
  receipt_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  org_wallet_id uuid,
  purchased_by_user_id uuid,
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id),
  CONSTRAINT invoices_org_wallet_id_fkey FOREIGN KEY (org_wallet_id) REFERENCES public.org_wallets(id),
  CONSTRAINT invoices_purchased_by_user_id_fkey FOREIGN KEY (purchased_by_user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.follows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  follower_user_id uuid NOT NULL,
  target_type USER-DEFINED NOT NULL,
  target_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  status text DEFAULT 'accepted'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])),
  follower_type USER-DEFINED NOT NULL DEFAULT 'user'::follow_actor,
  follower_org_id uuid,
  CONSTRAINT follows_pkey PRIMARY KEY (id),
  CONSTRAINT follows_follower_user_id_fkey FOREIGN KEY (follower_user_id) REFERENCES auth.users(id),
  CONSTRAINT follows_follower_org_id_fkey FOREIGN KEY (follower_org_id) REFERENCES public.organizations(id)
);

CREATE TABLE public.guest_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  tier_id uuid,
  max_uses integer DEFAULT 1,
  used_count integer DEFAULT 0,
  expires_at timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  CONSTRAINT guest_codes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.guest_otp_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  method text NOT NULL,
  contact text NOT NULL,
  otp_hash text NOT NULL,
  event_id uuid,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT guest_otp_codes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.guest_ticket_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  method text NOT NULL,
  contact text NOT NULL,
  scope jsonb NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT guest_ticket_sessions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.inventory_operations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tier_id uuid NOT NULL,
  operation_type text NOT NULL CHECK (operation_type = ANY (ARRAY['reserve'::text, 'release'::text, 'purchase'::text, 'refund'::text])),
  quantity integer NOT NULL,
  session_id text,
  order_id uuid,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT inventory_operations_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_operations_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.ticket_tiers(id),
  CONSTRAINT inventory_operations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);

CREATE TABLE public.kv_store_d42c04e8 (
  key text NOT NULL,
  value jsonb NOT NULL,
  CONSTRAINT kv_store_d42c04e8_pkey PRIMARY KEY (key)
);

CREATE TABLE public.pgbench_tiers (
  pos integer NOT NULL,
  id uuid NOT NULL,
  CONSTRAINT pgbench_tiers_pkey PRIMARY KEY (pos),
  CONSTRAINT pgbench_tiers_id_fkey FOREIGN KEY (id) REFERENCES public.ticket_tiers(id)
);

-- =====================================================
-- SCHEMA STATISTICS
-- =====================================================
-- Total Tables: 80+
-- Sponsorship Tables: 22
-- Analytics Tables: 15
-- Partitioned Tables: 2 (with 40+ monthly partitions)
-- Event Management: 20+
-- User/Org Management: 15+
-- Infrastructure: 10+
-- 
-- Total Constraints: 200+
-- Total Indexes: 100+
-- Total Functions: 25+
-- Total Views: 15+
-- Total Triggers: 10+
-- =====================================================

-- For actual deployment, use numbered migration files:
-- supabase/migrations/20251021_0000_*.sql through 20251022_0005_*.sql

-- Documentation:
-- - MASTER_INDEX.md - Navigation hub
-- - SYSTEM_COMPLETE.md - Executive overview
-- - docs/BACKEND_INTEGRATION_COMPLETE.md - API guide
-- - docs/FRONTEND_INTEGRATION_GUIDE.md - UI guide
-- - QUICK_START.md - Getting started

-- =====================================================
-- END OF SCHEMA REFERENCE
-- =====================================================
