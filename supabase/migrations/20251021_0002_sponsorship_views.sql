-- === ANALYTICAL VIEWS & MATERIALIZED VIEWS ===
-- Phase 1: Views for UI surfaces and analytics dashboards

-- Event performance summary (view for real-time data)
DROP VIEW IF EXISTS public.v_event_performance_summary CASCADE;
CREATE VIEW public.v_event_performance_summary AS
SELECT
  e.id AS event_id,
  e.title AS event_title,
  e.start_at,
  e.category,
  0::bigint AS total_views,
  0::bigint AS avg_dwell_ms,
  0::bigint AS video_completions,
  (
    SELECT COUNT(*)
    FROM public.orders o
    WHERE o.event_id = e.id AND o.status = 'paid'
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
  0::numeric AS avg_watch_pct,
  (
    SELECT COALESCE(
      COUNT(*)::numeric / NULLIF(COUNT(DISTINCT pi.user_id), 0),
      0
    )
    FROM public.post_impressions pi
    JOIN public.event_posts ep ON ep.id = pi.post_id
    JOIN public.orders o ON o.event_id = e.id AND o.user_id = pi.user_id
    WHERE ep.event_id = e.id AND o.status = 'paid'
  )::numeric AS conversion_rate,
  COALESCE(eai.engagement_score, 0)::numeric AS engagement_score,
  COALESCE(eai.social_mentions, 0)::integer AS social_mentions,
  COALESCE(eai.sentiment_score, 0)::numeric AS sentiment_score
FROM public.events e
LEFT JOIN public.event_audience_insights eai ON eai.event_id = e.id;

COMMENT ON VIEW public.v_event_performance_summary IS 'Real-time event performance metrics for sponsorship package cards';

-- Materialized fit scores (starter MV for batch scoring)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_sponsor_event_fit_scores AS
SELECT
  sp.sponsor_id,
  e.id AS event_id,
  0.0::numeric AS score,
  '{}'::jsonb AS fit_breakdown,
  now() AS computed_at
FROM public.events e
JOIN public.event_audience_insights eai ON eai.event_id = e.id
CROSS JOIN public.sponsor_profiles sp
WHERE eai.engagement_score IS NOT NULL
  AND e.start_at > now() - interval '6 months'  -- Only compute for recent/upcoming events
  AND e.visibility = 'public';

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fit_scores_unique
  ON public.mv_sponsor_event_fit_scores (sponsor_id, event_id);

CREATE INDEX IF NOT EXISTS idx_mv_fit_scores_event_score
  ON public.mv_sponsor_event_fit_scores (event_id, score DESC);

CREATE INDEX IF NOT EXISTS idx_mv_fit_scores_sponsor_score
  ON public.mv_sponsor_event_fit_scores (sponsor_id, score DESC);

COMMENT ON MATERIALIZED VIEW public.mv_sponsor_event_fit_scores IS 'Precomputed sponsor-event fit scores (refresh nightly)';

-- Helper view: sponsorship package cards with enriched stats
DROP VIEW IF EXISTS public.v_sponsorship_package_cards CASCADE;
CREATE VIEW public.v_sponsorship_package_cards AS
SELECT
  p.id AS package_id,
  p.event_id,
  p.title,
  p.description,
  p.tier,
  p.price_cents,
  p.currency,
  p.inventory,
  p.sold,
  p.is_active,
  p.expected_reach,
  p.avg_engagement_score,
  p.package_type,
  p.quality_score,
  p.quality_updated_at,
  eps.metric_key AS snapshot_metric_key,
  eps.metric_value AS snapshot_metric_value,
  eps.captured_at AS snapshot_captured_at,
  vps.event_title,
  vps.start_at,
  vps.category,
  vps.total_views,
  vps.avg_dwell_ms,
  vps.tickets_sold,
  vps.unique_visitors,
  vps.avg_watch_pct,
  vps.conversion_rate,
  vps.engagement_score,
  vps.social_mentions,
  vps.sentiment_score,
  (p.inventory - p.sold) AS available_inventory
FROM public.sponsorship_packages p
LEFT JOIN public.event_stat_snapshots eps ON eps.id = p.stat_snapshot_id
LEFT JOIN public.v_event_performance_summary vps ON vps.event_id = p.event_id
WHERE p.is_active = true;

COMMENT ON VIEW public.v_sponsorship_package_cards IS 'Enriched sponsorship packages with live stats for marketplace UI';

-- Helper view: top sponsor matches for organizers (recommendations)
DROP VIEW IF EXISTS public.v_sponsor_recommendations CASCADE;
CREATE VIEW public.v_sponsor_recommendations AS
SELECT
  sm.event_id,
  sm.sponsor_id,
  s.name AS sponsor_name,
  s.logo_url AS sponsor_logo,
  s.industry,
  sp.company_size,
  sp.annual_budget_cents,
  sm.score,
  sm.overlap_metrics,
  sm.status,
  sm.updated_at,
  -- Explainability: extract key metrics from overlap_metrics
  (sm.overlap_metrics->>'budget_fit')::numeric AS budget_fit,
  (sm.overlap_metrics->'audience_overlap'->>'categories')::numeric AS category_match,
  (sm.overlap_metrics->'audience_overlap'->>'geo')::numeric AS geo_match,
  (sm.overlap_metrics->>'engagement_quality')::numeric AS engagement_fit,
  (sm.overlap_metrics->>'objectives_similarity')::numeric AS objectives_fit
FROM public.sponsorship_matches sm
JOIN public.sponsors s ON s.id = sm.sponsor_id
JOIN public.sponsor_profiles sp ON sp.sponsor_id = sm.sponsor_id
WHERE sm.status = 'pending' AND sm.score > 0.5
ORDER BY sm.event_id, sm.score DESC;

COMMENT ON VIEW public.v_sponsor_recommendations IS 'Top sponsor matches for event organizers with explainability metrics';

-- Helper view: event recommendations for sponsors
DROP VIEW IF EXISTS public.v_event_recommendations CASCADE;
CREATE VIEW public.v_event_recommendations AS
SELECT
  sm.sponsor_id,
  sm.event_id,
  e.title AS event_title,
  e.cover_image_url AS event_cover,
  e.start_at,
  e.category,
  e.city,
  e.country,
  sm.score,
  sm.overlap_metrics,
  sm.status,
  sm.updated_at,
  vps.tickets_sold,
  vps.unique_visitors,
  vps.engagement_score,
  vps.conversion_rate,
  -- Package availability for this event
  (
    SELECT COUNT(*)
    FROM public.sponsorship_packages sp
    WHERE sp.event_id = e.id
      AND sp.is_active = true
      AND (sp.inventory - sp.sold) > 0
  )::integer AS available_packages,
  (
    SELECT MIN(sp.price_cents)
    FROM public.sponsorship_packages sp
    WHERE sp.event_id = e.id
      AND sp.is_active = true
      AND (sp.inventory - sp.sold) > 0
  )::integer AS min_price_cents,
  -- Explainability
  (sm.overlap_metrics->>'budget_fit')::numeric AS budget_fit,
  (sm.overlap_metrics->'audience_overlap'->>'categories')::numeric AS category_match,
  (sm.overlap_metrics->'audience_overlap'->>'geo')::numeric AS geo_match,
  (sm.overlap_metrics->>'engagement_quality')::numeric AS engagement_fit
FROM public.sponsorship_matches sm
JOIN public.events e ON e.id = sm.event_id
LEFT JOIN public.v_event_performance_summary vps ON vps.event_id = e.id
WHERE sm.status = 'pending'
  AND sm.score > 0.5
  AND e.visibility = 'public'
  AND e.start_at > now()
ORDER BY sm.sponsor_id, sm.score DESC;

COMMENT ON VIEW public.v_event_recommendations IS 'Top event matches for sponsors with package availability and stats';

-- Analytics view: sponsorship funnel metrics
DROP VIEW IF EXISTS public.v_sponsorship_funnel CASCADE;
CREATE VIEW public.v_sponsorship_funnel AS
SELECT
  e.id AS event_id,
  e.title AS event_title,
  e.start_at,
  COUNT(sm.id) FILTER (WHERE sm.status = 'pending') AS matches_pending,
  COUNT(sm.id) FILTER (WHERE sm.status = 'suggested') AS matches_suggested,
  COUNT(sm.id) FILTER (WHERE sm.status = 'accepted') AS matches_accepted,
  COUNT(sm.id) FILTER (WHERE sm.status = 'rejected') AS matches_rejected,
  AVG(sm.score) FILTER (WHERE sm.status = 'accepted') AS avg_accepted_score,
  AVG(sm.score) FILTER (WHERE sm.status = 'rejected') AS avg_rejected_score
FROM public.events e
LEFT JOIN public.sponsorship_matches sm ON sm.event_id = e.id
GROUP BY e.id, e.title, e.start_at;

COMMENT ON VIEW public.v_sponsorship_funnel IS 'Sponsorship funnel metrics for conversion analysis';

