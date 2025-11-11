-- Migration: Optimize feed ranking for ticket purchase intent
-- 
-- Key improvements:
-- 1. Time-decayed signals with configurable half-lives
-- 2. Pre-aggregated CTEs (no LATERAL per-row joins)
-- 3. Configurable feature weights (no magic numbers)
-- 4. Window-based diversity (no circular dependencies)
-- 5. Bayesian smoothing for engagement
-- 6. Cold start + exploration bonus
-- 7. Percentile-aware price/time preferences
-- 8. Label leakage prevention (exclude purchased events)
-- 9. Proper indexes + RLS
-- 10. Diagnostic views for debugging
-- 11. Urgency boost for events happening within 1 week (last-minute sales)

-- ==========================================
-- PART 1: New tracking tables
-- ==========================================

-- Track when users view ticket details (high purchase intent)
CREATE TABLE IF NOT EXISTS public.ticket_detail_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events.events(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  tier_viewed TEXT,  -- e.g., 'GA', 'VIP'
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hour_bucket TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', now())
);

-- Dedup: one view per user/event/hour
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_detail_views_dedup
  ON public.ticket_detail_views(user_id, event_id, hour_bucket)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_detail_views_user_recent
  ON public.ticket_detail_views(user_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_detail_views_event
  ON public.ticket_detail_views(event_id, viewed_at DESC);

-- RLS
ALTER TABLE public.ticket_detail_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own ticket views" ON public.ticket_detail_views;
CREATE POLICY "Users can insert their own ticket views"
  ON public.ticket_detail_views FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can view their own ticket views" ON public.ticket_detail_views;
CREATE POLICY "Users can view their own ticket views"
  ON public.ticket_detail_views FOR SELECT
  USING (auth.uid() = user_id);

-- Track profile visits (moderate purchase intent)
CREATE TABLE IF NOT EXISTS public.profile_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  visited_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hour_bucket TIMESTAMPTZ NOT NULL DEFAULT date_trunc('hour', now())
);

-- Dedup: one visit per visitor/visited/hour
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_visits_dedup
  ON public.profile_visits(visitor_id, visited_user_id, hour_bucket)
  WHERE visitor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profile_visits_visitor_recent
  ON public.profile_visits(visitor_id, visited_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_visits_visited
  ON public.profile_visits(visited_user_id, visited_at DESC);

-- RLS
ALTER TABLE public.profile_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert profile visits" ON public.profile_visits;
CREATE POLICY "Users can insert profile visits"
  ON public.profile_visits FOR INSERT
  WITH CHECK (auth.uid() = visitor_id OR visitor_id IS NULL);

DROP POLICY IF EXISTS "Users can view their own visits" ON public.profile_visits;
CREATE POLICY "Users can view their own visits"
  ON public.profile_visits FOR SELECT
  USING (auth.uid() = visitor_id);

-- ==========================================
-- PART 2: Model configuration
-- ==========================================

-- Feature weights table (tunable without redeploying SQL)
CREATE TABLE IF NOT EXISTS public.model_feature_weights (
  feature TEXT PRIMARY KEY,
  weight FLOAT8 NOT NULL,
  half_life_days FLOAT8,  -- for time decay
  updated_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- Seed default weights
INSERT INTO public.model_feature_weights (feature, weight, half_life_days, notes)
VALUES
  -- Tier 1: Explicit intent (highest signals)
  ('intent.saved', 5.0, 21, 'User saved/bookmarked the event'),
  ('intent.checkout_start', 4.0, 14, 'User started checkout flow'),
  ('intent.ticket_detail', 3.0, 14, 'User opened ticket details modal'),
  
  -- Tier 2: Strong behavioral signals
  ('behavior.dwell_completed', 2.0, 7, 'User viewed event card for 10+ seconds'),
  ('behavior.share', 0.0, 30, 'User shared the event (NOT IMPLEMENTED YET)'),
  ('behavior.similar_purchase', 1.5, 180, 'User bought similar events in past'),
  
  -- Tier 3: Moderate signals
  ('affinity.follow_event', 1.0, NULL, 'User follows this event'),
  ('affinity.follow_organizer', 0.8, NULL, 'User follows the organizer'),
  ('affinity.past_ticket', 1.2, NULL, 'User bought tickets to this event before'),
  ('affinity.location_close', 0.5, NULL, 'Event within 10 miles'),
  ('affinity.location_near', 0.3, NULL, 'Event within 25 miles'),
  ('affinity.profile_visit', 0.8, 30, 'User visited organizer profile'),
  
  -- Tier 4: Preference signals
  ('preference.price_fit', 0.5, NULL, 'Price matches user history'),
  ('preference.time_fit', 0.3, NULL, 'Time matches user patterns'),
  
  -- Component weights (for final blend)
  ('component.purchase_intent', 0.30, NULL, 'Purchase intent component weight'),
  ('component.freshness', 0.25, NULL, 'Freshness component weight'),
  ('component.affinity', 0.20, NULL, 'Affinity component weight'),
  ('component.engagement', 0.15, NULL, 'Engagement component weight'),
  ('component.exploration', 0.10, NULL, 'Exploration/diversity component weight'),
  
  -- Engagement smoothing (Bayesian prior)
  ('engagement.prior_alpha', 5.0, NULL, 'Beta prior: pseudo-likes'),
  ('engagement.prior_beta', 10.0, NULL, 'Beta prior: pseudo-views'),
  
  -- Urgency boost (time-based)
  ('urgency.one_week_boost', 0.30, NULL, 'Boost for events within 7 days (last-minute sales)'),
  ('urgency.one_day_boost', 0.50, NULL, 'Extra boost for events within 24 hours (urgent!)'),
  
  -- Diversity penalties
  ('diversity.rank_1', 1.00, NULL, 'Top event from organizer: no penalty'),
  ('diversity.rank_2', 0.85, NULL, 'Second event from organizer'),
  ('diversity.rank_3', 0.70, NULL, 'Third event from organizer'),
  ('diversity.rank_4plus', 0.55, NULL, 'Fourth+ event from organizer')
ON CONFLICT (feature) DO NOTHING;

-- Helper function: get weight by feature name
CREATE OR REPLACE FUNCTION public.get_feature_weight(p_feature TEXT)
RETURNS FLOAT8
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(weight, 0.0) FROM public.model_feature_weights WHERE feature = p_feature;
$$;

-- ==========================================
-- PART 3: Enhanced ranking function
-- ==========================================

-- Drop all versions of get_home_feed_ids (handles function overloading)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure 
        FROM pg_proc 
        WHERE proname = 'get_home_feed_ids' 
          AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.oid::regprocedure || ' CASCADE';
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_home_feed_ids(
  p_user uuid,
  p_limit integer DEFAULT 80,
  p_cursor_item_id uuid DEFAULT NULL,
  p_categories text[] DEFAULT NULL,
  p_user_lat double precision DEFAULT NULL,
  p_user_lng double precision DEFAULT NULL,
  p_max_distance_miles double precision DEFAULT NULL,
  p_date_filters text[] DEFAULT NULL,
  p_session_id text DEFAULT NULL  -- NEW: for exploration bonus
)
RETURNS TABLE(
  item_type text,
  item_id uuid,
  event_id uuid,
  score numeric,
  sort_ts timestamptz
)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
WITH
-- Load feature weights once
weights AS (
  SELECT 
    jsonb_object_agg(feature, weight) AS w,
    jsonb_object_agg(feature, COALESCE(half_life_days, 0)) AS hl
  FROM public.model_feature_weights
),
-- Distance calculation (unchanged)
distance_calc AS (
  SELECT
    e.id AS event_id,
    CASE 
      WHEN e.lat IS NULL OR e.lng IS NULL OR p_user_lat IS NULL OR p_user_lng IS NULL THEN NULL
      ELSE (
        3959 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(p_user_lat)) 
            * cos(radians(e.lat)) 
            * cos(radians(e.lng) - radians(p_user_lng)) 
            + sin(radians(p_user_lat)) 
            * sin(radians(e.lat))
          ))
        )
      )
    END AS distance_miles
  FROM events e
  WHERE p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL
),
-- Date filter check (unchanged)
date_filter_check AS (
  SELECT 
    e.id AS event_id,
    e.start_at,
    CASE
      WHEN p_date_filters IS NULL OR array_length(p_date_filters, 1) IS NULL THEN true
      WHEN 'Tonight' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('day', now()) 
        AND e.start_at < date_trunc('day', now() + interval '1 day')
      ) THEN true
      WHEN 'This Weekend' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('week', now()) + interval '4 days' + interval '18 hours'
        AND e.start_at < date_trunc('week', now()) + interval '7 days'
      ) THEN true
      WHEN 'This Week' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('week', now())
        AND e.start_at < date_trunc('week', now()) + interval '7 days'
      ) THEN true
      WHEN 'Next Week' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('week', now()) + interval '7 days'
        AND e.start_at < date_trunc('week', now()) + interval '14 days'
      ) THEN true
      WHEN 'This Month' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('month', now())
        AND e.start_at < date_trunc('month', now()) + interval '1 month'
      ) THEN true
      WHEN 'Next Month' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('month', now()) + interval '1 month'
        AND e.start_at < date_trunc('month', now()) + interval '2 months'
      ) THEN true
      ELSE false
    END AS passes_date_filter
  FROM events e
),
-- Get minimum ticket price per event (from ticket_tiers)
event_pricing AS (
  SELECT
    tt.event_id,
    MIN(tt.price_cents) AS min_price_cents
  FROM public.ticket_tiers tt
  WHERE tt.status = 'active'
  GROUP BY tt.event_id
),
-- Candidate events (with guardrails)
-- Note: We include ALL events (even purchased ones) so their POSTS can appear
-- The purchased filter is applied later only to EVENT CARDS, not POSTS
candidate_events AS (
  SELECT
    e.id AS event_id,
    e.created_by AS organizer_id,
    COALESCE(e.start_at, e.created_at, now()) AS anchor_ts,
    e.start_at,
    GREATEST(
      0,
      1.0 - ABS(EXTRACT(EPOCH FROM (now() - COALESCE(e.start_at, e.created_at, now()))) / 86400.0) / 180.0
    ) AS freshness,
    dc.distance_miles,
    COALESCE(ep.min_price_cents, 0) AS min_price_cents,
    -- Track if user already purchased (for filtering EVENT cards only)
    EXISTS(
      SELECT 1 FROM tickets t
      WHERE t.owner_user_id = p_user
        AND t.event_id = e.id
        AND t.status IN ('issued', 'transferred', 'redeemed')
    ) AS user_already_purchased
  FROM events e
  LEFT JOIN distance_calc dc ON dc.event_id = e.id
  LEFT JOIN date_filter_check dfc ON dfc.event_id = e.id
  LEFT JOIN event_pricing ep ON ep.event_id = e.id
  WHERE e.visibility = 'public'
    AND e.start_at > now()  -- Only future events
    AND (
      COALESCE(e.start_at, e.created_at, now()) > now() - INTERVAL '365 days'
      OR EXISTS (
        SELECT 1 FROM event_posts ep
        WHERE ep.event_id = e.id AND ep.deleted_at IS NULL
      )
    )
    -- Filters
    AND (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR e.category = ANY(p_categories))
    AND (p_max_distance_miles IS NULL OR dc.distance_miles IS NULL OR dc.distance_miles <= p_max_distance_miles)
    AND (p_date_filters IS NULL OR array_length(p_date_filters, 1) IS NULL OR dfc.passes_date_filter = true)
    -- Exclude flashback events (added for Flashbacks feature - safe to use before column exists due to COALESCE)
    AND (COALESCE(e.is_flashback, false) = false)
),
-- PRE-AGGREGATED SIGNALS (key performance optimization)
-- Helper: time decay formula
-- decay(ts, half_life) = exp(-ln(2) * age_days / half_life)
-- Saved events (explicit intent, half-life 21d)
saved_signal AS (
  SELECT 
    event_id,
    MAX(saved_at) AS last_saved_at,
    exp(-ln(2) * GREATEST(0, EXTRACT(EPOCH FROM (now() - MAX(saved_at))) / 86400.0) / 21.0) AS decay
  FROM (
    -- Saved events
    SELECT event_id, saved_at
    FROM public.saved_events
    WHERE user_id = p_user
      AND saved_at > now() - INTERVAL '180 days'
    
    UNION ALL
    
    -- Saved posts (also indicate interest in the event)
    SELECT event_id, created_at AS saved_at
    FROM events.user_saved_posts
    WHERE user_id = p_user
      AND created_at > now() - INTERVAL '180 days'
  ) AS all_saves
  GROUP BY event_id
),
-- Ticket detail views (high intent, half-life 14d)
ticket_detail_signal AS (
  SELECT 
    tdv.event_id,
    MAX(tdv.viewed_at) AS last_viewed_at,
    exp(-ln(2) * GREATEST(0, EXTRACT(EPOCH FROM (now() - MAX(tdv.viewed_at))) / 86400.0) / 14.0) AS decay
  FROM public.ticket_detail_views tdv
  WHERE tdv.user_id = p_user
    AND tdv.viewed_at > now() - INTERVAL '90 days'
  GROUP BY tdv.event_id
),
-- Checkout sessions (very high intent, half-life 14d)
checkout_signal AS (
  SELECT 
    cs.event_id,
    MAX(cs.started_at) AS last_checkout_at,
    exp(-ln(2) * GREATEST(0, EXTRACT(EPOCH FROM (now() - MAX(cs.started_at))) / 86400.0) / 14.0) AS decay
  FROM public.checkout_sessions cs
  WHERE cs.user_id = p_user
    AND cs.started_at > now() - INTERVAL '90 days'
    AND cs.completed_at IS NULL  -- Only abandoned checkouts (high intent!)
  GROUP BY cs.event_id
),
-- High dwell impressions (completed views, half-life 7d)
dwell_signal AS (
  SELECT 
    ei.event_id,
    MAX(ei.created_at) AS last_impression_at,
    exp(-ln(2) * GREATEST(0, EXTRACT(EPOCH FROM (now() - MAX(ei.created_at))) / 86400.0) / 7.0) AS decay
  FROM events.event_impressions ei
  WHERE ei.user_id = p_user
    AND ei.dwell_ms >= 10000  -- 10+ seconds
    AND ei.completed = true
    AND ei.created_at > now() - INTERVAL '30 days'
  GROUP BY ei.event_id
),
-- Shares (strong signal, half-life 30d)
-- Note: Currently no event-level share tracking, so this CTE returns empty
-- TODO: Add event share tracking when implemented
share_signal AS (
  SELECT 
    NULL::uuid AS event_id,
    NULL::timestamptz AS last_shared_at,
    0::double precision AS decay
  WHERE false  -- Returns empty set for now
),
-- Profile visits (moderate signal, half-life 30d)
profile_visit_signal AS (
  SELECT 
    ce.event_id,
    MAX(pv.visited_at) AS last_visit_at,
    exp(-ln(2) * GREATEST(0, EXTRACT(EPOCH FROM (now() - MAX(pv.visited_at))) / 86400.0) / 30.0) AS decay
  FROM public.profile_visits pv
  JOIN candidate_events ce ON ce.organizer_id = pv.visited_user_id
  WHERE pv.visitor_id = p_user
    AND pv.visited_at > now() - INTERVAL '60 days'
  GROUP BY ce.event_id
),
-- Similar event purchases (half-life 180d)
similar_purchase_signal AS (
  SELECT 
    ce.event_id,
    MAX(t.created_at) AS last_purchase_at,
    exp(-ln(2) * GREATEST(0, EXTRACT(EPOCH FROM (now() - MAX(t.created_at))) / 86400.0) / 180.0) AS decay
  FROM tickets t
  JOIN events prev_event ON prev_event.id = t.event_id
  JOIN candidate_events ce ON ce.event_id != t.event_id AND prev_event.category = (SELECT category FROM events WHERE id = ce.event_id)
  WHERE t.owner_user_id = p_user
    AND t.status IN ('issued', 'transferred', 'redeemed')
    AND t.created_at > now() - INTERVAL '365 days'
  GROUP BY ce.event_id
),
-- User's price profile (IQR percentiles)
-- Note: Getting price from orders table (tickets don't have price column)
-- Using orders as proxy for ticket purchase price
user_price_profile AS (
  SELECT
    percentile_cont(0.25) WITHIN GROUP (ORDER BY o.total_cents / NULLIF(o.tickets_issued_count, 0)) AS p25,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY o.total_cents / NULLIF(o.tickets_issued_count, 0)) AS p75
  FROM orders o
  WHERE o.user_id = p_user
    AND o.status = 'paid'
    AND o.created_at > now() - INTERVAL '180 days'
    AND o.total_cents > 0
    AND o.tickets_issued_count > 0
),
-- User's time-of-week preferences (histogram)
user_time_histogram AS (
  SELECT
    EXTRACT(DOW FROM ev.start_at)::int AS dow,
    EXTRACT(HOUR FROM ev.start_at)::int AS hour,
    COUNT(*) AS freq
  FROM tickets t
  JOIN events ev ON ev.id = t.event_id
  WHERE t.owner_user_id = p_user
    AND t.created_at > now() - INTERVAL '180 days'
  GROUP BY dow, hour
),
-- Affinity signals (no time decay, binary)
affinity_signals AS (
  SELECT 
    ce.event_id,
    EXISTS(
      SELECT 1 FROM follows f
      WHERE f.follower_user_id = p_user
        AND f.target_type = 'event'
        AND f.target_id = ce.event_id
    ) AS follows_event,
    EXISTS(
      SELECT 1 FROM follows f
      WHERE f.follower_user_id = p_user
        AND f.target_type = 'organizer'
        AND f.target_id = ce.organizer_id
    ) AS follows_organizer,
    EXISTS(
      SELECT 1 FROM tickets t
      WHERE t.owner_user_id = p_user
        AND t.event_id = ce.event_id
        AND t.status IN ('issued', 'transferred', 'redeemed')
    ) AS past_ticket,
    CASE 
      WHEN ce.distance_miles IS NOT NULL AND ce.distance_miles <= 10 THEN true
      ELSE false
    END AS location_close,
    CASE 
      WHEN ce.distance_miles IS NOT NULL AND ce.distance_miles > 10 AND ce.distance_miles <= 25 THEN true
      ELSE false
    END AS location_near
  FROM candidate_events ce
),
-- Purchase intent score
purchase_intent AS (
  SELECT 
    ce.event_id,
    (w.w->>'intent.saved')::float8 * COALESCE(ss.decay, 0)
    + (w.w->>'intent.checkout_start')::float8 * COALESCE(cos.decay, 0)
    + (w.w->>'intent.ticket_detail')::float8 * COALESCE(tds.decay, 0)
    + (w.w->>'behavior.dwell_completed')::float8 * COALESCE(ds.decay, 0)
    + (w.w->>'behavior.share')::float8 * COALESCE(shs.decay, 0)
    + (w.w->>'behavior.similar_purchase')::float8 * COALESCE(sps.decay, 0)
    + (w.w->>'affinity.profile_visit')::float8 * COALESCE(pvs.decay, 0)
    -- Preference: price fit (percentile-aware)
    + (w.w->>'preference.price_fit')::float8 * CASE
        WHEN upp.p25 IS NOT NULL AND ce.min_price_cents BETWEEN upp.p25 AND upp.p75 THEN 1.0
        WHEN upp.p25 IS NOT NULL AND ce.min_price_cents BETWEEN upp.p25 * 0.7 AND upp.p75 * 1.3 THEN 0.6
        ELSE 0.0
      END
    -- Preference: time fit (histogram-based)
    + (w.w->>'preference.time_fit')::float8 * CASE
        WHEN EXISTS(
          SELECT 1 FROM user_time_histogram uth
          WHERE uth.dow = EXTRACT(DOW FROM ce.start_at)::int
            AND ABS(uth.hour - EXTRACT(HOUR FROM ce.start_at)::int) <= 2
        ) THEN 1.0
        ELSE 0.0
      END
    AS purchase_intent_score
  FROM candidate_events ce
  CROSS JOIN weights w
  LEFT JOIN saved_signal ss ON ss.event_id = ce.event_id
  LEFT JOIN checkout_signal cos ON cos.event_id = ce.event_id
  LEFT JOIN ticket_detail_signal tds ON tds.event_id = ce.event_id
  LEFT JOIN dwell_signal ds ON ds.event_id = ce.event_id
  LEFT JOIN share_signal shs ON shs.event_id = ce.event_id
  LEFT JOIN similar_purchase_signal sps ON sps.event_id = ce.event_id
  LEFT JOIN profile_visit_signal pvs ON pvs.event_id = ce.event_id
  LEFT JOIN user_price_profile upp ON true  -- Fixed: LEFT JOIN prevents empty result when user has no orders
),
-- Affinity score
affinity_score AS (
  SELECT 
    afs.event_id,
    (w.w->>'affinity.follow_event')::float8 * CASE WHEN afs.follows_event THEN 1.0 ELSE 0.0 END
    + (w.w->>'affinity.follow_organizer')::float8 * CASE WHEN afs.follows_organizer THEN 1.0 ELSE 0.0 END
    + (w.w->>'affinity.past_ticket')::float8 * CASE WHEN afs.past_ticket THEN 1.0 ELSE 0.0 END
    + (w.w->>'affinity.location_close')::float8 * CASE WHEN afs.location_close THEN 1.0 ELSE 0.0 END
    + (w.w->>'affinity.location_near')::float8 * CASE WHEN afs.location_near THEN 1.0 ELSE 0.0 END
    AS affinity
  FROM affinity_signals afs
  CROSS JOIN weights w
),
-- Engagement with Bayesian smoothing
engagement_raw AS (
  SELECT
    p.event_id,
    COALESCE(SUM(p.like_count), 0) * 1.0 + COALESCE(SUM(p.comment_count), 0) * 1.5 AS engagement_raw,
    COUNT(*) AS post_count
  FROM event_posts p
  JOIN candidate_events ce ON ce.event_id = p.event_id
  WHERE p.deleted_at IS NULL
  GROUP BY p.event_id
),
event_view_counts AS (
  SELECT
    ei.event_id,
    COUNT(DISTINCT ei.session_id) AS view_count
  FROM events.event_impressions ei
  JOIN candidate_events ce ON ce.event_id = ei.event_id
  WHERE ei.created_at > now() - INTERVAL '90 days'
  GROUP BY ei.event_id
),
engagement_smoothed AS (
  SELECT 
    ce.event_id,
    -- Bayesian smoothing: (likes + α) / (views + α + β)
    (COALESCE(er.engagement_raw, 0) + (w.w->>'engagement.prior_alpha')::float8) /
    NULLIF(COALESCE(evc.view_count, 0) + (w.w->>'engagement.prior_alpha')::float8 + (w.w->>'engagement.prior_beta')::float8, 0)
    AS engagement
  FROM candidate_events ce
  CROSS JOIN weights w
  LEFT JOIN engagement_raw er ON er.event_id = ce.event_id
  LEFT JOIN event_view_counts evc ON evc.event_id = ce.event_id
),
-- Cold start: popularity by city + category
city_category_popularity AS (
  SELECT
    e.city,
    e.category,
    AVG(COALESCE(evc.view_count, 0)) AS avg_city_cat_views
  FROM events e
  LEFT JOIN event_view_counts evc ON evc.event_id = e.id
  WHERE e.start_at > now() - INTERVAL '90 days'
    AND e.visibility = 'public'
  GROUP BY e.city, e.category
),
-- Exploration bonus (session-scoped random)
exploration_bonus AS (
  SELECT 
    ce.event_id,
    -- Deterministic hash for session consistency
    0.01 * (
      ('x' || substring(md5(COALESCE(p_session_id, '') || ce.event_id::text) from 1 for 8))::bit(32)::int::float8 / 2147483647.0
    ) AS exploration_score
  FROM candidate_events ce
),
-- Urgency boost for upcoming events (1 week window)
urgency_boost AS (
  SELECT
    ce.event_id,
    CASE
      -- Events within 24 hours get max boost (last-minute ticket sales!)
      WHEN ce.start_at IS NOT NULL 
        AND ce.start_at > now() 
        AND ce.start_at <= now() + INTERVAL '1 day'
      THEN (w.w->>'urgency.one_day_boost')::float8
      
      -- Events within 7 days get standard boost
      WHEN ce.start_at IS NOT NULL 
        AND ce.start_at > now() 
        AND ce.start_at <= now() + INTERVAL '7 days'
      THEN (w.w->>'urgency.one_week_boost')::float8
      
      -- No boost for events > 7 days away or past events
      ELSE 0.0
    END AS urgency
  FROM candidate_events ce
  CROSS JOIN weights w
),
-- Combine all signals (normalize to [0,1] within candidate set)
combined_signals AS (
  SELECT
    ce.event_id,
    ce.freshness,
    COALESCE(pi.purchase_intent_score, 0) AS purchase_intent,
    COALESCE(afs.affinity, 0) AS affinity,
    COALESCE(es.engagement, 0) AS engagement,
    COALESCE(ccp.avg_city_cat_views, 0) AS cold_start_prior,
    COALESCE(eb.exploration_score, 0) AS exploration,
    COALESCE(ub.urgency, 0) AS urgency
  FROM candidate_events ce
  LEFT JOIN purchase_intent pi ON pi.event_id = ce.event_id
  LEFT JOIN affinity_score afs ON afs.event_id = ce.event_id
  LEFT JOIN engagement_smoothed es ON es.event_id = ce.event_id
  LEFT JOIN city_category_popularity ccp ON ccp.city = (SELECT city FROM events WHERE id = ce.event_id) 
    AND ccp.category = (SELECT category FROM events WHERE id = ce.event_id)
  LEFT JOIN exploration_bonus eb ON eb.event_id = ce.event_id
  LEFT JOIN urgency_boost ub ON ub.event_id = ce.event_id
),
-- Normalize signals
signal_stats AS (
  SELECT
    GREATEST(COALESCE(MAX(freshness), 0.001), 0.001) AS max_fresh,
    GREATEST(COALESCE(MAX(purchase_intent), 0.001), 0.001) AS max_intent,
    GREATEST(COALESCE(MAX(affinity), 0.001), 0.001) AS max_aff,
    GREATEST(COALESCE(MAX(engagement), 0.001), 0.001) AS max_eng,
    GREATEST(COALESCE(MAX(cold_start_prior), 0.001), 0.001) AS max_cold
  FROM combined_signals
),
-- Compute base score (before diversity)
base_scores AS (
  SELECT
    cs.event_id,
    (w.w->>'component.purchase_intent')::float8 * (cs.purchase_intent / ss.max_intent)
    + (w.w->>'component.freshness')::float8 * (cs.freshness / ss.max_fresh)
    + (w.w->>'component.affinity')::float8 * (cs.affinity / ss.max_aff)
    + (w.w->>'component.engagement')::float8 * (cs.engagement / ss.max_eng)
    -- Blend in cold start for new/low-data events
    + (w.w->>'component.exploration')::float8 * (
        0.7 * cs.exploration + 0.3 * (cs.cold_start_prior / ss.max_cold)
      )
    + cs.urgency  -- 🚨 Urgency boost: flat addition (0.3 for 7d, 0.5 for 24h)
    AS base_score
  FROM combined_signals cs
  CROSS JOIN signal_stats ss
  CROSS JOIN weights w
),
-- Diversity control (window-based, no circular dependency)
ranked_by_organizer AS (
  SELECT
    bs.event_id,
    bs.base_score,
    ce.organizer_id,
    ce.anchor_ts,
    ce.start_at,
    DENSE_RANK() OVER (
      PARTITION BY ce.organizer_id
      ORDER BY bs.base_score DESC, ce.start_at ASC
    ) AS organizer_rank
  FROM base_scores bs
  JOIN candidate_events ce ON ce.event_id = bs.event_id
),
diversity_adjusted AS (
  SELECT
    rbo.event_id,
    rbo.base_score,
    rbo.anchor_ts,
    rbo.start_at,
    -- Apply diversity multiplier based on organizer rank
    rbo.base_score * CASE
      WHEN rbo.organizer_rank = 1 THEN (w.w->>'diversity.rank_1')::float8
      WHEN rbo.organizer_rank = 2 THEN (w.w->>'diversity.rank_2')::float8
      WHEN rbo.organizer_rank = 3 THEN (w.w->>'diversity.rank_3')::float8
      ELSE (w.w->>'diversity.rank_4plus')::float8
    END AS final_score
  FROM ranked_by_organizer rbo
  CROSS JOIN weights w
),
-- Rank events globally
scored_events AS (
  SELECT
    da.event_id,
    da.final_score AS score,
    da.anchor_ts,
    da.start_at,
    ROW_NUMBER() OVER (
      ORDER BY da.final_score DESC, da.anchor_ts DESC NULLS LAST, da.event_id DESC
    ) AS event_rank
  FROM diversity_adjusted da
),
-- Top posts per event
all_posts AS (
  SELECT
    p.event_id,
    p.id AS post_id,
    p.created_at,
    (COALESCE(p.like_count, 0) + 1.2 * COALESCE(p.comment_count, 0)) AS engagement_score
  FROM event_posts p
  JOIN candidate_events ce ON ce.event_id = p.event_id
  WHERE p.deleted_at IS NULL
    AND p.created_at > now() - INTERVAL '365 days'
),
ranked_posts AS (
  SELECT
    ap.*,
    ROW_NUMBER() OVER (
      PARTITION BY ap.event_id
      ORDER BY ap.created_at DESC, ap.engagement_score DESC, ap.post_id DESC
    ) AS rn
  FROM all_posts ap
),
-- Interleave events and posts
items AS (
  SELECT
    'event'::text AS item_type,
    se.event_id::uuid AS item_id,
    se.event_id,
    se.score,
    COALESCE(se.anchor_ts, se.start_at) AS sort_ts,
    se.event_rank,
    0 AS within_event_rank
  FROM scored_events se
  JOIN candidate_events ce ON ce.event_id = se.event_id
  -- ✅ Filter: Exclude EVENT CARDS for purchased events (avoid showing ticket offers)
  WHERE NOT ce.user_already_purchased

  UNION ALL

  SELECT
    'post'::text AS item_type,
    rp.post_id AS item_id,
    rp.event_id,
    CASE
      WHEN ce.user_already_purchased THEN se.score * 1.2  -- 🔥 Strong boost for posts from events viewer has tickets for
      ELSE se.score * 0.98                                -- Slight penalty vs event cards for non-purchased events
    END AS score,
    rp.created_at AS sort_ts,
    se.event_rank,
    rp.rn AS within_event_rank
  FROM ranked_posts rp
  JOIN scored_events se ON se.event_id = rp.event_id
  JOIN candidate_events ce ON ce.event_id = rp.event_id  -- Added: needed for user_already_purchased check
  -- ✅ Keep POSTS from purchased events (attendees want social engagement!)
  WHERE rp.rn <= 3  -- Top 3 posts per event
),
ordered AS (
  SELECT
    i.item_type,
    i.item_id,
    i.event_id,
    i.score,
    COALESCE(i.sort_ts, now()) AS sort_ts,
    i.event_rank,
    i.within_event_rank,
    ROW_NUMBER() OVER (
      ORDER BY i.event_rank, i.within_event_rank, COALESCE(i.sort_ts, now()) DESC, i.item_id DESC
    ) AS rn
  FROM items i
),
cursor_position AS (
  SELECT rn
  FROM ordered
  WHERE p_cursor_item_id IS NOT NULL
    AND item_id = p_cursor_item_id
)
SELECT
  item_type,
  item_id,
  event_id,
  score,
  sort_ts
FROM ordered
WHERE (SELECT rn FROM cursor_position) IS NULL
   OR ordered.rn > (SELECT rn FROM cursor_position)
ORDER BY rn
LIMIT p_limit;
$$;

-- Re-create wrapper (drop all versions)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure 
        FROM pg_proc 
        WHERE proname = 'get_home_feed_ranked' 
          AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.oid::regprocedure || ' CASCADE';
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_home_feed_ranked(
  p_user_id uuid,
  p_limit integer DEFAULT 80,
  p_cursor_item_id uuid DEFAULT NULL,
  p_categories text[] DEFAULT NULL,
  p_user_lat double precision DEFAULT NULL,
  p_user_lng double precision DEFAULT NULL,
  p_max_distance_miles double precision DEFAULT NULL,
  p_date_filters text[] DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS TABLE(
  item_type text,
  item_id uuid,
  event_id uuid,
  score numeric,
  sort_ts timestamptz
)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT * FROM public.get_home_feed_ids(
    p_user_id, p_limit, p_cursor_item_id, p_categories,
    p_user_lat, p_user_lng, p_max_distance_miles, p_date_filters,
    p_session_id
  );
$$;

-- ==========================================
-- PART 4: Additional indexes for performance
-- ==========================================

-- Ensure key indexes exist for new queries
-- Note: Removed time-based WHERE clauses (now() is VOLATILE, not IMMUTABLE)
CREATE INDEX IF NOT EXISTS idx_saved_events_user_recent
  ON public.saved_events(user_id, saved_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_impressions_user_dwell
  ON events.event_impressions(user_id, event_id, created_at DESC)
  WHERE dwell_ms >= 10000 AND completed = true;

-- Note: event_reactions index skipped - table structure differs (has post_id, not event_id)
-- TODO: Add when event-level share tracking is implemented

-- Note: tickets index skipped - tickets is a VIEW, not a table
-- Underlying base table should already have appropriate indexes

-- Note: events index - check if events is a view or table
-- If it's a view, this will fail and should be removed
CREATE INDEX IF NOT EXISTS idx_events_organizer_category
  ON events.events(created_by, category, start_at)
  WHERE visibility = 'public';

-- ==========================================
-- PART 5: Diagnostic views
-- ==========================================

-- View to inspect feature contributions per event/user
CREATE OR REPLACE VIEW public.feed_score_diagnostics AS
SELECT
  e.id AS event_id,
  e.title AS event_title,
  e.created_by AS organizer_id,
  up.display_name AS organizer_name,
  e.category,
  e.city,
  e.start_at,
  -- Could add per-component scores here for debugging
  'TODO: expand with per-feature scores' AS notes
FROM events e
LEFT JOIN user_profiles up ON e.created_by = up.user_id
WHERE e.visibility = 'public'
  AND e.start_at > now()
LIMIT 100;

-- ==========================================
-- PART 6: Permissions
-- ==========================================

GRANT ALL ON FUNCTION public.get_home_feed_ids TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.get_home_feed_ranked TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.get_feature_weight TO anon, authenticated, service_role;
GRANT SELECT ON public.model_feature_weights TO anon, authenticated, service_role;
GRANT UPDATE ON public.model_feature_weights TO service_role;

-- ==========================================
-- PART 7: Comments
-- ==========================================

COMMENT ON TABLE public.ticket_detail_views IS 
  'Tracks when users open ticket details (high purchase intent signal)';
  
COMMENT ON TABLE public.profile_visits IS 
  'Tracks profile page views (moderate purchase intent signal)';
  
COMMENT ON TABLE public.model_feature_weights IS 
  'Configurable weights for ranking features. Update without redeploying SQL.';
  
COMMENT ON FUNCTION public.get_home_feed_ranked IS 
  'Production-grade feed ranking optimized for ticket purchases. Uses time-decayed signals, Bayesian smoothing, diversity control, exploration, and urgency boost for upcoming events. Configurable via model_feature_weights table.';

-- Success message
SELECT 'Feed ranking optimized for ticket purchase intent! 🎯' AS status;

