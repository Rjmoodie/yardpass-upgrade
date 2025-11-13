# 🚀 Deploy Internal Analytics System

## Complete Deployment Guide

---

## 📋 Pre-Deployment Checklist

### 1. Verify Prerequisites
```bash
# Check Supabase CLI installed
supabase --version

# Ensure you're linked to project
supabase status

# Verify migrations directory
ls supabase/migrations/2025111200000*
```

### 2. Review Migrations
```bash
# Should see 4 new migration files:
20251112000000_analytics_foundation.sql       # Core tables & schema
20251112000001_analytics_rpc_funnel.sql       # Main RPC function
20251112000002_analytics_performance.sql      # MVs & caching
20251112000003_analytics_advanced_features.sql # Advanced features
```

---

## 🚀 Deployment Steps

### Step 1: Deploy Database Migrations

```bash
# Option A: Push all migrations to production
supabase db push

# Option B: Apply migrations one by one (safer)
supabase db push --include-all --dry-run  # Preview changes first
supabase db push  # Apply
```

Expected output:
```
✓ Applied migration 20251112000000_analytics_foundation.sql
✓ Applied migration 20251112000001_analytics_rpc_funnel.sql
✓ Applied migration 20251112000002_analytics_performance.sql
✓ Applied migration 20251112000003_analytics_advanced_features.sql
```

### Step 2: Verify Tables Created

```sql
-- Run in Supabase SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'analytics'
ORDER BY table_name;

-- Expected tables:
-- ✓ audit_log
-- ✓ blocklist_ips
-- ✓ blocklist_user_agents
-- ✓ channel_taxonomy
-- ✓ events (or events_202511, etc if partitioned)
-- ✓ identity_map
-- ✓ query_cache
```

### Step 3: Verify Functions Created

```sql
-- Check RPC functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%audience%'
  OR routine_name LIKE '%analytics%';

-- Expected functions:
-- ✓ get_audience_funnel_internal
-- ✓ get_audience_funnel_cached
-- ✓ get_leaky_steps_analysis
-- ✓ get_creative_diagnostics
-- ✓ get_cohort_retention
-- ✓ forecast_sellout_date
-- ✓ detect_funnel_anomalies
```

### Step 4: Test RPC Function

```sql
-- Test with dummy data (adjust org_id)
SELECT public.get_audience_funnel_internal(
  'YOUR_ORG_ID_HERE'::UUID,  -- Replace with actual org ID
  NOW() - INTERVAL '30 days',
  NOW(),
  NULL,  -- All events
  'none',  -- No grouping
  'last_touch',  -- Attribution model
  TRUE  -- Include refunds
);

-- Should return JSONB with structure:
-- {
--   "meta": {...},
--   "funnel_steps": [...],
--   "acquisition_channels": [...],
--   "device_breakdown": [...],
--   "top_events": [...]
-- }
```

### Step 5: Backfill Historical Data (Optional)

```sql
-- Backfill from existing tracking tables
SELECT analytics.backfill_all_sources();

-- Check results
SELECT 
  COUNT(*) AS total_events,
  COUNT(DISTINCT event_name) AS unique_event_types,
  COUNT(DISTINCT user_id) AS unique_users,
  MIN(ts) AS earliest_event,
  MAX(ts) AS latest_event
FROM analytics.events;
```

### Step 6: Deploy Frontend Changes

```bash
# Build application
npm run build

# Test locally first
npm run dev

# Navigate to /analytics in browser
# Select an organization
# Verify "Audience" tab loads with internal data
# Check alert message says "internal database"
```

### Step 7: Verify Feature Flags

```javascript
// Open browser console on /analytics page
localStorage.getItem('liventix_feature_flags');

// Should show:
// {"useInternalAudienceAnalytics":true, ...}

// To toggle back to PostHog (for testing):
localStorage.setItem('liventix_feature_flags', 
  JSON.stringify({ useInternalAudienceAnalytics: false }));

// Refresh page
```

---

## 🧪 Testing Checklist

### Database Layer

- [ ] All tables created successfully
- [ ] All RPC functions exist and execute
- [ ] Indexes created (check with `\di analytics.*`)
- [ ] RLS policies active (check with `\dp analytics.events`)
- [ ] Materialized views created
- [ ] Partitions created (if applicable)

### Functionality

- [ ] Can insert test event into analytics.events
- [ ] Identity promotion works (session → user)
- [ ] Channel normalization returns correct categories
- [ ] Bot detection filters known user agents
- [ ] Funnel RPC returns valid data
- [ ] Cached version returns same data faster
- [ ] Leaky steps analysis returns insights
- [ ] Creative diagnostics provide recommendations

### Performance

- [ ] Funnel query completes in <200ms
- [ ] Cached queries complete in <50ms
- [ ] Materialized views refresh successfully
- [ ] Query cache stores and retrieves results
- [ ] Audit log captures all RPC calls

### Frontend

- [ ] Analytics Hub loads without errors
- [ ] Audience tab shows internal data message
- [ ] Funnel chart renders correctly
- [ ] Acquisition channels display
- [ ] Device breakdown shows
- [ ] Export CSV/JSON works
- [ ] No console errors

---

## 📊 Validation Queries

### Check Data Flow

```sql
-- 1. Verify events are being tracked
SELECT 
  event_name,
  COUNT(*) AS count,
  COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS auth_users,
  COUNT(DISTINCT session_id) AS sessions
FROM analytics.events
WHERE ts >= NOW() - INTERVAL '1 hour'
GROUP BY event_name
ORDER BY count DESC;

-- 2. Check identity stitching
SELECT 
  COUNT(*) AS total_mappings,
  COUNT(*) FILTER (WHERE promoted_at IS NOT NULL) AS promoted,
  COUNT(DISTINCT user_id) AS unique_users
FROM analytics.identity_map;

-- 3. Verify channel taxonomy
SELECT channel, COUNT(*) 
FROM analytics.channel_taxonomy 
GROUP BY channel;

-- 4. Check bot filtering
SELECT COUNT(*) 
FROM analytics.events 
WHERE is_bot = TRUE;

-- 5. Test audit logging
SELECT 
  function_name,
  COUNT(*) AS calls,
  AVG(duration_ms) AS avg_ms,
  MAX(duration_ms) AS max_ms
FROM analytics.audit_log
WHERE ts >= NOW() - INTERVAL '1 day'
GROUP BY function_name;
```

### Performance Benchmarks

```sql
-- Benchmark: Funnel query should be <200ms
EXPLAIN ANALYZE
SELECT public.get_audience_funnel_internal(
  'YOUR_ORG_ID'::UUID,
  NOW() - INTERVAL '30 days',
  NOW(),
  NULL,
  'none',
  'last_touch',
  TRUE
);

-- Check execution time in output
-- Look for "Execution Time: XXX ms"
-- Should be < 200ms

-- Benchmark: Cached query should be <50ms
EXPLAIN ANALYZE
SELECT public.get_audience_funnel_cached(
  'YOUR_ORG_ID'::UUID,
  NOW() - INTERVAL '30 days',
  NOW(),
  NULL,
  TRUE  -- Use cache
);
```

---

## 🔧 Troubleshooting

### Issue: RPC function not found
```bash
# Re-run migrations
supabase db push --include-all

# Or apply specific migration
psql $DATABASE_URL -f supabase/migrations/20251112000001_analytics_rpc_funnel.sql
```

### Issue: Permission denied on analytics tables
```sql
-- Grant permissions
GRANT SELECT ON analytics.events TO authenticated;
GRANT INSERT ON analytics.events TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_audience_funnel_cached TO authenticated;
```

### Issue: Slow query performance
```sql
-- Check if indexes exist
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'analytics' 
  AND tablename = 'events';

-- Refresh materialized views
SELECT analytics.refresh_materialized_views();

-- Check query plan
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM analytics.events WHERE org_id = 'YOUR_ORG_ID'::UUID;
```

### Issue: No data in funnel
```sql
-- Check if events are being tracked
SELECT COUNT(*) FROM analytics.events 
WHERE ts >= NOW() - INTERVAL '7 days';

-- If 0, backfill from legacy tables
SELECT analytics.backfill_all_sources();

-- Or manually insert test event
INSERT INTO analytics.events (event_name, session_id, org_id)
VALUES ('page_view', 'test_session', 'YOUR_ORG_ID');
```

### Issue: Cache not working
```sql
-- Check cache table
SELECT * FROM analytics.query_cache 
WHERE expires_at > NOW()
ORDER BY created_at DESC
LIMIT 5;

-- Clear cache if needed
DELETE FROM analytics.query_cache;
```

---

## 🔄 Rollback Plan

If you need to rollback:

### Immediate (Frontend Only)
```typescript
// In src/components/AnalyticsHub.tsx
// Change back to PostHog:
const { data, error } = await supabase.functions.invoke('analytics-posthog-funnel', {
  body: {
    event_ids: eventIds,
    from_date: getDateFromRange(dateRange),
    to_date: new Date().toISOString(),
    org_id: selectedOrg,
  },
});
```

### Full Rollback (Drop Everything)
```sql
-- WARNING: This deletes all analytics data!
DROP SCHEMA analytics CASCADE;

-- Remove functions
DROP FUNCTION IF EXISTS public.get_audience_funnel_internal CASCADE;
DROP FUNCTION IF EXISTS public.get_audience_funnel_cached CASCADE;
-- ... other functions
```

### Safe Rollback (Keep Data)
```sql
-- Just disable in frontend with feature flag
-- Keep database tables for future use
-- Data continues accumulating
```

---

## 📈 Monitoring

### Health Check Queries

```sql
-- 1. Event ingestion rate (per hour)
SELECT 
  DATE_TRUNC('hour', ts) AS hour,
  COUNT(*) AS events
FROM analytics.events
WHERE ts >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- 2. RPC performance (p50, p95, p99)
SELECT 
  function_name,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_ms
FROM analytics.audit_log
WHERE success = TRUE
  AND ts >= NOW() - INTERVAL '1 day'
GROUP BY function_name;

-- 3. Cache hit rate
SELECT 
  ROUND(
    SUM(hit_count)::NUMERIC / 
    NULLIF(COUNT(*), 0), 
    2
  ) AS avg_hits_per_key
FROM analytics.query_cache
WHERE created_at >= NOW() - INTERVAL '1 day';

-- 4. Identity promotion rate
SELECT 
  COUNT(*) FILTER (WHERE promoted_at IS NOT NULL) AS promoted,
  COUNT(*) AS total,
  ROUND(
    COUNT(*) FILTER (WHERE promoted_at IS NOT NULL)::NUMERIC / 
    NULLIF(COUNT(*), 0) * 100, 
    1
  ) AS promotion_rate_pct
FROM analytics.identity_map;
```

### Set Up Alerts (Recommended)

```sql
-- Create alert function for anomalies
CREATE OR REPLACE FUNCTION analytics.check_and_alert_anomalies()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_org RECORD;
  v_anomalies JSONB;
BEGIN
  -- Check each active org
  FOR v_org IN 
    SELECT DISTINCT org_id 
    FROM analytics.events 
    WHERE ts >= NOW() - INTERVAL '7 days'
      AND org_id IS NOT NULL
  LOOP
    v_anomalies := public.detect_funnel_anomalies(
      v_org.org_id,
      NOW() - INTERVAL '7 days',
      NOW()
    );
    
    -- If anomalies found, log or send notification
    IF jsonb_array_length(v_anomalies->'anomalies') > 0 THEN
      RAISE NOTICE 'Anomalies detected for org %: %', v_org.org_id, v_anomalies;
      -- TODO: Send email/Slack notification
    END IF;
  END LOOP;
END;
$$;

-- Schedule daily check (requires pg_cron)
-- SELECT cron.schedule('check-analytics-anomalies', '0 9 * * *',
--   'SELECT analytics.check_and_alert_anomalies()');
```

---

## 🎯 Success Criteria

After deployment, verify:

### ✅ Database
- Analytics schema exists with all tables
- All RPC functions execute without errors
- Materialized views populated
- Audit log capturing calls

### ✅ Performance
- Funnel queries: < 200ms (p95)
- Cached queries: < 50ms (p95)
- No query timeouts
- MV refresh completes in < 5 minutes

### ✅ Data Quality
- Events flowing into analytics.events
- Identity stitching working (check identity_map)
- Bot filtering active (is_bot = true entries)
- Revenue reconciles with orders table

### ✅ Frontend
- Analytics Hub loads successfully
- Audience tab shows "internal database" message
- Funnel chart renders with real data
- No "sample data" fallback messages
- Export functions work

---

## 📊 Comparison Test

### Golden Dashboard Test

Run both systems in parallel for validation:

```typescript
// Fetch both PostHog and Internal data
const posthogData = await supabase.functions.invoke('analytics-posthog-funnel', {...});
const internalData = await supabase.rpc('get_audience_funnel_cached', {...});

// Compare results
console.log('PostHog:', posthogData);
console.log('Internal:', internalData);

// Expected deltas:
// - Awareness/Engagement: ±3% (sampling differences)
// - Purchases: 0% (should match exactly)
// - Revenue: 0% (should match exactly)
```

---

## 🎊 Go Live

### Production Deployment

```bash
# 1. Build frontend
npm run build

# 2. Deploy to hosting
# (Your deployment command here)

# 3. Monitor for 24 hours
# - Check error logs
# - Verify data flowing
# - Monitor performance
```

### Enable for All Users

```typescript
// Remove feature flag or set as default
// In src/lib/featureFlags.ts
const DEFAULT_FLAGS = {
  useInternalAudienceAnalytics: true,  // ✅ Enabled for everyone
  // ...
};
```

---

## 📞 Support

If issues occur:
1. Check Supabase logs for RPC errors
2. Review audit_log for failures
3. Test RPC manually in SQL editor
4. Verify data exists in analytics.events
5. Check frontend console for errors

---

## 🎉 Post-Deployment

### Week 1: Monitor
- Track p95 query times
- Monitor cache hit rates
- Check for anomalies
- Verify data accuracy

### Week 2: Optimize
- Adjust cache TTLs based on usage
- Add more channel mappings if needed
- Tune MV refresh schedule
- Add custom insights

### Month 1: Enhance
- Add more funnel stages
- Implement multi-touch attribution
- Add cohort analysis
- Build custom dashboards

---

**Ready to deploy? Let's ship it!** 🚀

