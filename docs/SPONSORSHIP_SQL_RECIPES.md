# Sponsorship System SQL Recipes

Quick reference for common sponsorship system queries and operations.

## Table of Contents
- [Match Management](#match-management)
- [Analytics & Reporting](#analytics--reporting)
- [Data Maintenance](#data-maintenance)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

---

## Match Management

### Get Top Sponsor Matches for Event

```sql
SELECT
  s.name AS sponsor_name,
  s.logo_url,
  sm.score,
  sm.overlap_metrics->>'budget_fit' AS budget_fit,
  sm.overlap_metrics->'audience_overlap'->>'categories' AS category_match,
  sm.status,
  sm.viewed_at,
  sm.contacted_at
FROM sponsorship_matches sm
JOIN sponsors s ON s.id = sm.sponsor_id
WHERE sm.event_id = 'YOUR_EVENT_ID'
  AND sm.score > 0.5
ORDER BY sm.score DESC
LIMIT 20;
```

### Get Top Event Opportunities for Sponsor

```sql
SELECT
  e.title AS event_title,
  e.start_at,
  e.category,
  sm.score,
  vps.tickets_sold,
  vps.engagement_score,
  COUNT(sp.id) AS available_packages,
  MIN(sp.price_cents) AS min_price_cents
FROM sponsorship_matches sm
JOIN events e ON e.id = sm.event_id
LEFT JOIN v_event_performance_summary vps ON vps.event_id = e.id
LEFT JOIN sponsorship_packages sp ON sp.event_id = e.id
  AND sp.is_active = true
  AND (sp.inventory - sp.sold) > 0
WHERE sm.sponsor_id = 'YOUR_SPONSOR_ID'
  AND sm.score > 0.5
  AND e.visibility = 'public'
  AND e.start_at > now()
GROUP BY e.id, e.title, e.start_at, e.category, sm.score, vps.tickets_sold, vps.engagement_score
ORDER BY sm.score DESC;
```

### Mark Match as Viewed

```sql
UPDATE sponsorship_matches
SET
  viewed_at = now(),
  status = 'suggested'
WHERE event_id = 'EVENT_ID'
  AND sponsor_id = 'SPONSOR_ID'
  AND viewed_at IS NULL;
```

### Accept/Reject Match

```sql
-- Accept
UPDATE sponsorship_matches
SET
  status = 'accepted',
  contacted_at = COALESCE(contacted_at, now()),
  notes = 'Sponsor responded positively'
WHERE event_id = 'EVENT_ID' AND sponsor_id = 'SPONSOR_ID';

-- Reject
UPDATE sponsorship_matches
SET
  status = 'rejected',
  declined_reason = 'Budget constraints',
  notes = 'Will reach out next quarter'
WHERE event_id = 'EVENT_ID' AND sponsor_id = 'SPONSOR_ID';
```

### Bulk Update Match Status

```sql
-- Mark all high-scoring matches as suggested
UPDATE sponsorship_matches
SET status = 'suggested'
WHERE score > 0.7
  AND status = 'pending'
  AND viewed_at IS NULL;
```

---

## Analytics & Reporting

### Sponsorship Funnel by Event

```sql
SELECT
  e.title,
  COUNT(*) FILTER (WHERE sm.status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE sm.viewed_at IS NOT NULL) AS viewed,
  COUNT(*) FILTER (WHERE sm.contacted_at IS NOT NULL) AS contacted,
  COUNT(*) FILTER (WHERE sm.status = 'accepted') AS accepted,
  COUNT(*) FILTER (WHERE sm.status = 'rejected') AS rejected,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE sm.status = 'accepted') /
    NULLIF(COUNT(*) FILTER (WHERE sm.viewed_at IS NOT NULL), 0),
    2
  ) AS conversion_rate_pct
FROM events e
LEFT JOIN sponsorship_matches sm ON sm.event_id = e.id
WHERE e.start_at > now() - interval '3 months'
GROUP BY e.id, e.title
ORDER BY conversion_rate_pct DESC NULLS LAST;
```

### Sponsor Engagement Report

```sql
SELECT
  s.name,
  COUNT(*) AS total_matches,
  COUNT(*) FILTER (WHERE sm.viewed_at IS NOT NULL) AS viewed_matches,
  COUNT(*) FILTER (WHERE sm.status = 'accepted') AS accepted_matches,
  AVG(sm.score) AS avg_match_score,
  MAX(sm.viewed_at) AS last_activity
FROM sponsors s
JOIN sponsorship_matches sm ON sm.sponsor_id = s.id
GROUP BY s.id, s.name
ORDER BY accepted_matches DESC, avg_match_score DESC;
```

### Revenue Potential by Match Score

```sql
SELECT
  CASE
    WHEN sm.score >= 0.8 THEN 'Excellent (0.8+)'
    WHEN sm.score >= 0.6 THEN 'Good (0.6-0.8)'
    WHEN sm.score >= 0.4 THEN 'Fair (0.4-0.6)'
    ELSE 'Poor (<0.4)'
  END AS match_quality,
  COUNT(*) AS match_count,
  COUNT(*) FILTER (WHERE sm.status = 'accepted') AS accepted_count,
  SUM(so.amount_cents) FILTER (WHERE so.status = 'paid') / 100.0 AS total_revenue_usd,
  AVG(so.amount_cents) FILTER (WHERE so.status = 'paid') / 100.0 AS avg_order_value_usd
FROM sponsorship_matches sm
LEFT JOIN sponsorship_orders so ON so.sponsor_id = sm.sponsor_id AND so.event_id = sm.event_id
GROUP BY match_quality
ORDER BY MIN(sm.score) DESC;
```

### Top Performing Event Categories

```sql
SELECT
  e.category,
  COUNT(DISTINCT e.id) AS event_count,
  COUNT(sm.id) AS total_matches,
  AVG(sm.score) AS avg_match_score,
  COUNT(*) FILTER (WHERE sm.status = 'accepted') AS accepted_matches,
  SUM(so.amount_cents) FILTER (WHERE so.status = 'paid') / 100.0 AS total_revenue_usd
FROM events e
LEFT JOIN sponsorship_matches sm ON sm.event_id = e.id
LEFT JOIN sponsorship_orders so ON so.event_id = e.id AND so.status = 'paid'
WHERE e.start_at > now() - interval '6 months'
GROUP BY e.category
ORDER BY total_revenue_usd DESC NULLS LAST;
```

### Sponsor ROI Summary

```sql
SELECT
  s.name AS sponsor_name,
  COUNT(DISTINCT so.id) AS sponsorships_count,
  SUM(so.amount_cents) / 100.0 AS total_spend_usd,
  AVG(es.roi_summary->>'impression_count')::integer AS avg_impressions,
  AVG(es.roi_summary->>'engagement_rate')::numeric AS avg_engagement_rate,
  AVG(es.roi_summary->>'brand_lift')::numeric AS avg_brand_lift
FROM sponsors s
JOIN sponsorship_orders so ON so.sponsor_id = s.id
LEFT JOIN event_sponsorships es ON es.sponsor_id = s.id AND es.event_id = so.event_id
WHERE so.status = 'paid'
  AND so.created_at > now() - interval '12 months'
GROUP BY s.id, s.name
ORDER BY total_spend_usd DESC;
```

---

## Data Maintenance

### Refresh Event Insights

```sql
-- Single event
INSERT INTO event_audience_insights (
  event_id,
  attendee_count,
  avg_dwell_time_ms,
  engagement_score,
  ticket_conversion_rate,
  updated_at
)
SELECT
  'YOUR_EVENT_ID' AS event_id,
  COUNT(DISTINCT t.owner_user_id) AS attendee_count,
  AVG(pv.dwell_ms) AS avg_dwell_time_ms,
  AVG(CASE WHEN pv.completed THEN 1.0 ELSE pv.watch_percentage / 100.0 END) AS engagement_score,
  COUNT(DISTINCT o.id)::numeric / NULLIF(COUNT(DISTINCT ei.user_id), 0) AS ticket_conversion_rate,
  now() AS updated_at
FROM events e
LEFT JOIN tickets t ON t.event_id = e.id
LEFT JOIN post_views pv ON pv.event_id = e.id
LEFT JOIN orders o ON o.event_id = e.id AND o.status IN ('paid', 'fulfilled')
LEFT JOIN event_impressions ei ON ei.event_id = e.id
WHERE e.id = 'YOUR_EVENT_ID'
ON CONFLICT (event_id) DO UPDATE SET
  attendee_count = EXCLUDED.attendee_count,
  avg_dwell_time_ms = EXCLUDED.avg_dwell_time_ms,
  engagement_score = EXCLUDED.engagement_score,
  ticket_conversion_rate = EXCLUDED.ticket_conversion_rate,
  updated_at = EXCLUDED.updated_at;
```

### Queue Specific Match for Recalc

```sql
INSERT INTO fit_recalc_queue (event_id, sponsor_id, reason)
VALUES ('EVENT_ID', 'SPONSOR_ID', 'manual_trigger')
ON CONFLICT (event_id, sponsor_id) DO UPDATE SET
  reason = 'manual_trigger',
  queued_at = now(),
  processed_at = NULL;
```

### Clean Up Old Queue Items

```sql
-- Delete processed items older than 7 days
DELETE FROM fit_recalc_queue
WHERE processed_at IS NOT NULL
  AND processed_at < now() - interval '7 days';
```

### Archive Old Matches

```sql
-- Create archive table (one-time)
CREATE TABLE IF NOT EXISTS sponsorship_matches_archive (LIKE sponsorship_matches INCLUDING ALL);

-- Move old rejected matches to archive
WITH moved AS (
  DELETE FROM sponsorship_matches
  WHERE status = 'rejected'
    AND updated_at < now() - interval '6 months'
  RETURNING *
)
INSERT INTO sponsorship_matches_archive
SELECT * FROM moved;
```

### Update Sponsor Reputation Score

```sql
UPDATE sponsor_profiles sp
SET reputation_score = subq.score
FROM (
  SELECT
    sm.sponsor_id,
    (
      0.4 * (COUNT(*) FILTER (WHERE sm.status = 'accepted')::numeric / NULLIF(COUNT(*), 0)) +
      0.3 * AVG(sm.score) +
      0.3 * (COUNT(*) FILTER (WHERE es.organizer_approved_at IS NOT NULL)::numeric / NULLIF(COUNT(*) FILTER (WHERE sm.status = 'accepted'), 0))
    ) AS score
  FROM sponsorship_matches sm
  LEFT JOIN event_sponsorships es ON es.sponsor_id = sm.sponsor_id
  GROUP BY sm.sponsor_id
) subq
WHERE sp.sponsor_id = subq.sponsor_id;
```

---

## Performance Optimization

### Analyze Match Distribution

```sql
SELECT
  ROUND(score, 1) AS score_bucket,
  COUNT(*) AS match_count,
  COUNT(*) FILTER (WHERE status = 'accepted') AS accepted_count
FROM sponsorship_matches
GROUP BY score_bucket
ORDER BY score_bucket DESC;
```

### Find Missing Indexes

```sql
-- Check for sequential scans on large tables
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  seq_tup_read / seq_scan AS avg_seq_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND tablename IN ('sponsorship_matches', 'sponsor_profiles', 'event_audience_insights')
  AND seq_scan > 100
ORDER BY seq_tup_read DESC;
```

### Refresh Materialized View

```sql
-- Concurrent refresh (doesn't block reads)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sponsor_event_fit_scores;

-- Check last refresh time
SELECT
  schemaname,
  matviewname,
  pg_size_pretty(pg_relation_size(schemaname||'.'||matviewname)) AS size,
  (SELECT max(captured_at) FROM mv_sponsor_event_fit_scores) AS last_refresh
FROM pg_matviews
WHERE schemaname = 'public' AND matviewname LIKE 'mv_%';
```

### Vacuum and Analyze

```sql
-- Vacuum specific tables
VACUUM ANALYZE sponsorship_matches;
VACUUM ANALYZE sponsor_profiles;
VACUUM ANALYZE event_audience_insights;

-- Check bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  n_dead_tup AS dead_tuples,
  n_live_tup AS live_tuples,
  ROUND(100 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND tablename IN ('sponsorship_matches', 'fit_recalc_queue')
ORDER BY dead_tuples DESC;
```

---

## Troubleshooting

### Check Queue Health

```sql
SELECT
  COUNT(*) AS pending_count,
  MIN(queued_at) AS oldest_pending,
  MAX(queued_at) AS newest_pending,
  AVG(EXTRACT(EPOCH FROM (now() - queued_at))) AS avg_age_seconds
FROM fit_recalc_queue
WHERE processed_at IS NULL;
```

### Find Stale Insights

```sql
-- Events with outdated or missing insights
SELECT
  e.id,
  e.title,
  e.start_at,
  eai.updated_at AS insights_updated_at,
  EXTRACT(EPOCH FROM (now() - eai.updated_at)) / 3600 AS hours_since_update
FROM events e
LEFT JOIN event_audience_insights eai ON eai.event_id = e.id
WHERE e.start_at > now() - interval '3 months'
  AND (eai.updated_at IS NULL OR eai.updated_at < now() - interval '24 hours')
ORDER BY e.start_at DESC;
```

### Identify Low-Quality Matches

```sql
-- Matches with zero overlap in key dimensions
SELECT
  sm.event_id,
  sm.sponsor_id,
  sm.score,
  sm.overlap_metrics->>'budget_fit' AS budget_fit,
  sm.overlap_metrics->'audience_overlap'->>'categories' AS category_match,
  sm.overlap_metrics->'audience_overlap'->>'geo' AS geo_match
FROM sponsorship_matches sm
WHERE sm.score > 0.5
  AND (
    (sm.overlap_metrics->'audience_overlap'->>'categories')::numeric = 0
    OR (sm.overlap_metrics->'audience_overlap'->>'geo')::numeric = 0
  )
ORDER BY sm.score DESC
LIMIT 20;
```

### Debug Missing Sponsor Profiles

```sql
-- Sponsors without profiles
SELECT
  s.id,
  s.name,
  s.created_at,
  u.email AS creator_email
FROM sponsors s
LEFT JOIN sponsor_profiles sp ON sp.sponsor_id = s.id
LEFT JOIN auth.users u ON u.id = s.created_by
WHERE sp.id IS NULL
ORDER BY s.created_at DESC;
```

### Check Edge Function Logs

```sql
-- Query Supabase request logs (if logged to DB)
SELECT
  created_at,
  function_name,
  response_status,
  response_body,
  execution_time_ms
FROM request_logs
WHERE function_name IN ('sponsorship-recalc', 'sponsorship-score-onchange')
  AND created_at > now() - interval '1 hour'
ORDER BY created_at DESC;
```

### Force Recalculation for Event

```sql
-- 1. Queue all sponsors for this event
INSERT INTO fit_recalc_queue (event_id, sponsor_id, reason)
SELECT
  'YOUR_EVENT_ID',
  sp.sponsor_id,
  'force_recalc'
FROM sponsor_profiles sp
ON CONFLICT (event_id, sponsor_id) DO UPDATE SET
  reason = 'force_recalc',
  queued_at = now(),
  processed_at = NULL;

-- 2. Verify queue
SELECT COUNT(*) FROM fit_recalc_queue
WHERE event_id = 'YOUR_EVENT_ID' AND processed_at IS NULL;

-- 3. Manually trigger worker or wait for cron
SELECT
  net.http_post(
    url:='https://your-project.supabase.co/functions/v1/sponsorship-recalc',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
```

---

## Useful Aggregations

### Score Distribution by Industry

```sql
SELECT
  sp.industry,
  COUNT(*) AS match_count,
  AVG(sm.score) AS avg_score,
  MAX(sm.score) AS max_score,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sm.score) AS median_score
FROM sponsorship_matches sm
JOIN sponsor_profiles sp ON sp.sponsor_id = sm.sponsor_id
WHERE sm.score > 0
GROUP BY sp.industry
ORDER BY avg_score DESC;
```

### Geographic Coverage

```sql
SELECT
  region,
  COUNT(DISTINCT sp.sponsor_id) AS sponsor_count,
  COUNT(DISTINCT sm.event_id) AS event_count,
  AVG(sm.score) AS avg_match_score
FROM sponsor_profiles sp
CROSS JOIN UNNEST(sp.regions) AS region
LEFT JOIN sponsorship_matches sm ON sm.sponsor_id = sp.sponsor_id
GROUP BY region
ORDER BY sponsor_count DESC;
```

### Time-to-Contact Analysis

```sql
SELECT
  CASE
    WHEN EXTRACT(EPOCH FROM (sm.contacted_at - sm.viewed_at)) < 3600 THEN '< 1 hour'
    WHEN EXTRACT(EPOCH FROM (sm.contacted_at - sm.viewed_at)) < 86400 THEN '1-24 hours'
    WHEN EXTRACT(EPOCH FROM (sm.contacted_at - sm.viewed_at)) < 604800 THEN '1-7 days'
    ELSE '> 7 days'
  END AS time_to_contact,
  COUNT(*) AS match_count,
  COUNT(*) FILTER (WHERE sm.status = 'accepted') AS accepted_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE sm.status = 'accepted') / COUNT(*), 2) AS acceptance_rate
FROM sponsorship_matches sm
WHERE sm.viewed_at IS NOT NULL AND sm.contacted_at IS NOT NULL
GROUP BY time_to_contact
ORDER BY MIN(EXTRACT(EPOCH FROM (sm.contacted_at - sm.viewed_at)));
```

---

## Export & Reporting

### CSV Export: Top Matches

```sql
COPY (
  SELECT
    e.title AS event,
    s.name AS sponsor,
    sm.score,
    sm.overlap_metrics->>'budget_fit' AS budget_fit,
    sm.overlap_metrics->'audience_overlap'->>'categories' AS category_match,
    sm.status,
    sm.viewed_at,
    sm.contacted_at
  FROM sponsorship_matches sm
  JOIN events e ON e.id = sm.event_id
  JOIN sponsors s ON s.id = sm.sponsor_id
  WHERE sm.score > 0.6
  ORDER BY sm.score DESC
) TO '/tmp/top_matches.csv' WITH CSV HEADER;
```

### JSON Export: Event Package Stats

```sql
SELECT jsonb_agg(
  jsonb_build_object(
    'event_title', event_title,
    'package_count', package_count,
    'total_revenue', total_revenue_usd,
    'avg_engagement', avg_engagement_score
  )
) AS report
FROM (
  SELECT
    e.title AS event_title,
    COUNT(sp.id) AS package_count,
    SUM(so.amount_cents) FILTER (WHERE so.status = 'paid') / 100.0 AS total_revenue_usd,
    AVG(sp.avg_engagement_score) AS avg_engagement_score
  FROM events e
  LEFT JOIN sponsorship_packages sp ON sp.event_id = e.id
  LEFT JOIN sponsorship_orders so ON so.package_id = sp.id
  WHERE e.start_at > now() - interval '3 months'
  GROUP BY e.id, e.title
) subq;
```

---

## Admin Utilities

### Reset All Matches for Testing

```sql
-- WARNING: Destructive operation
TRUNCATE TABLE sponsorship_matches;
TRUNCATE TABLE fit_recalc_queue;

-- Re-queue all possible combinations
INSERT INTO fit_recalc_queue (event_id, sponsor_id, reason)
SELECT eai.event_id, sp.sponsor_id, 'reset'
FROM event_audience_insights eai
CROSS JOIN sponsor_profiles sp;
```

### Batch Update Package Quality Scores

```sql
UPDATE sponsorship_packages sp
SET
  quality_score = LEAST(100, GREATEST(0, ROUND(
    30 * COALESCE(sp.avg_engagement_score, 0) +
    30 * (sp.sold::numeric / NULLIF(sp.inventory, 0)) +
    40 * COALESCE(vps.conversion_rate, 0)
  ))),
  quality_updated_at = now()
FROM v_event_performance_summary vps
WHERE vps.event_id = sp.event_id;
```

---

**Pro Tips:**
- Always test queries on a subset first (add `LIMIT 10`)
- Use `EXPLAIN ANALYZE` to check query performance
- Create backups before bulk updates
- Monitor queue size during bulk operations
- Use transactions for multi-step operations

