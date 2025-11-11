# 📊 Feed Performance SLO Runbook
**Ticket:** PERF-010  
**Created:** November 9, 2025  
**Owner:** Backend/DevOps Team  

---

## 🎯 Service Level Objective (SLO)

**Target:** P95 feed query execution time < 500ms  
**Alert:** If P95 > 500ms for 5+ consecutive minutes  
**Monitoring:** PostHog + Supabase Edge Function logs  

---

## 📈 PostHog Dashboard Setup

### **Step 1: Create Feed Performance Insight**

1. Go to PostHog → Insights → New Insight
2. Configure:
   - **Event:** `feed_query_performance`
   - **Metric:** Percentile (P95) of `duration_ms`
   - **Group by:** `has_filters` (true/false)
   - **Time range:** Last 24 hours
   - **Refresh:** Every 5 minutes

3. Save as: **"Feed Query Performance (P95)"**

### **Step 2: Create SLO Breach Alert**

1. Go to Insight → Alerts → New Alert
2. Configure:
   - **Condition:** When P95 of `duration_ms` > 500
   - **For:** 5 consecutive checks (5 minutes)
   - **Send to:** Slack webhook or email
   - **Include:** Link to detailed logs

### **Step 3: Create Performance Dashboard**

Create dashboard with these insights:

**A. Feed Query P95 (last 24h)**
```
Event: feed_query_performance
Metric: P95(duration_ms)
Breakdown: has_filters
Chart: Line graph
```

**B. SLO Compliance Rate**
```
Event: feed_query_performance  
Metric: % where slo_met = true
Chart: Number with trend
Target: >95% compliance
```

**C. Breach Distribution**
```
Event: feed_query_performance
Filter: slo_met = false
Metric: Count
Breakdown: has_filters, is_first_page
Chart: Bar chart
```

**D. Query Duration Histogram**
```
Event: feed_query_performance
Metric: Count
Bins: 0-100ms, 100-250ms, 250-500ms, 500-1000ms, 1000ms+
Chart: Histogram
```

---

## 🚨 SLO Breach Response Runbook

### **When Alert Fires:**

**1. Acknowledge Alert (1 minute)**
- Check Slack/email alert
- Acknowledge in incident management tool
- Note start time

**2. Quick Assessment (2 minutes)**
Check PostHog dashboard:
- Is it affecting all queries or specific patterns?
- Check "Breach Distribution" - which filters are slow?
- Check "SLO Compliance Rate" - what % affected?

**3. Check Supabase Logs (3 minutes)**
Go to Supabase Dashboard → Edge Functions → home-feed → Logs

Look for:
```
🚨 [SLO BREACH] Feed query exceeded 500ms target
```

Note the `query_params`:
- User type (anonymous vs authenticated)
- Filters applied (categories, location, dates)
- Cursor pagination (first page vs later pages)

**4. Identify Pattern (5 minutes)**

**Common causes:**

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| Only with `has_location: true` | Geo distance calc slow | Increase `p_max_distance_miles` |
| Only with `has_categories: true` | Category filter issue | Check category index |
| Only for authenticated users | User affinity calc expensive | Add user to exclusion list temporarily |
| All queries slow | Database CPU/memory issue | Scale database |
| Only first page | Cold start / cache miss | Pre-warm cache |

**5. Immediate Mitigation (10 minutes)**

**Option A: Temporary Filter Bypass (if specific filter is slow)**
```sql
-- Temporarily disable slow component in get_home_feed_ranked
-- Example: Reduce urgency boost weight
UPDATE public.model_feature_weights 
SET weight = 0 
WHERE feature = 'urgency.one_week_boost';
```

**Option B: Increase Cache TTL (if cache misses)**
```typescript
// In Edge Function: Increase cache TTL temporarily
const CACHE_TTL_GUEST = 60; // Was 30, double it
```

**Option C: Add Query Timeout**
```typescript
// In Edge Function: Add timeout to prevent long queries
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Query timeout')), 3000)
);
const { data } = await Promise.race([
  supabase.rpc('get_home_feed_ranked', rpcArgs),
  timeoutPromise
]);
```

**6. Root Cause Analysis (30 minutes)**

**A. Run EXPLAIN ANALYZE**
```sql
-- In Supabase SQL Editor
EXPLAIN ANALYZE
SELECT * FROM public.get_home_feed_ranked(
  p_user := '00000000-0000-0000-0000-000000000000'::uuid,
  p_limit := 30,
  p_categories := ARRAY['music']::text[]
);
```

Look for:
- Seq Scan (should use indexes)
- Nested Loop (might need JOIN optimization)
- CTE materialization (might need optimization)

**B. Check pg_stat_statements**
```sql
-- Find slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%get_home_feed_ranked%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**C. Check Database Resources**
- CPU usage (should be <70%)
- Memory usage (should be <80%)
- Connection count (should be <80% of max)

**7. Long-Term Fix (1-2 hours)**

Based on root cause:

**Scenario A: Expensive CTE**
```sql
-- Create materialized view for expensive aggregations
CREATE MATERIALIZED VIEW feed_user_affinities AS
SELECT user_id, event_id, affinity_score, updated_at
FROM ... -- Expensive affinity calc
;

-- Refresh every 15 minutes
CREATE OR REPLACE FUNCTION refresh_feed_affinities()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY feed_user_affinities;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh
SELECT cron.schedule('refresh-feed-affinities', '*/15 * * * *', 'SELECT refresh_feed_affinities()');
```

**Scenario B: Missing Index**
```sql
-- Add missing index discovered in EXPLAIN
CREATE INDEX CONCURRENTLY idx_missing_index 
ON table_name(columns);
```

**Scenario C: Too Much Data**
```sql
-- Add Redis cache layer (15-30s TTL)
-- Cache results keyed by filters + user affinity tier
```

---

## 📊 Monitoring Best Practices

### **Daily Review (5 minutes)**
- Check P95 trend (should be stable)
- Review breach count (should be <5% of queries)
- Check for new patterns in slow queries

### **Weekly Review (15 minutes)**
- Analyze breach distribution by filter type
- Identify users with consistently slow queries
- Review capacity planning (is DB scaling needed?)

### **Monthly Review (30 minutes)**
- Adjust SLO target if needed (based on user experience)
- Review and update feature weights in `model_feature_weights`
- Plan optimizations for next sprint

---

## 🔧 Escalation Path

**Severity Levels:**

| Level | Condition | Response Time | Action |
|-------|-----------|---------------|--------|
| **P3 - Low** | P95 500-750ms, <10% breach | 24 hours | Log for next sprint |
| **P2 - Medium** | P95 750-1000ms, 10-25% breach | 4 hours | Investigate & mitigate |
| **P1 - High** | P95 >1000ms, >25% breach | 1 hour | Immediate escalation |
| **P0 - Critical** | All queries failing | 15 minutes | War room, fallback |

**Escalation Contacts:**
- P3: Backend lead (async Slack)
- P2: Backend lead (page)
- P1: Backend lead + CTO (page)
- P0: War room (all hands)

---

## 📝 Known Issues & Workarounds

### **Issue 1: Geolocation Timeout**
**Symptom:** Feed slow when "Near Me" filter active but geolocation denied  
**Fix:** Timeout reduced to 1s (PERF-010)  
**Workaround:** Skip geolocation if denied previously

### **Issue 2: First Page Slower**
**Symptom:** First page load slower than pagination  
**Cause:** Cold start + complex ranking  
**Workaround:** Pre-warm cache on user login

### **Issue 3: Category Filter Slow**
**Symptom:** Specific categories take longer  
**Cause:** Uneven data distribution  
**Fix:** Add per-category index if needed

---

## 🎯 Success Metrics

**Good Performance:**
- ✅ P50 < 200ms
- ✅ P95 < 500ms  
- ✅ P99 < 1000ms
- ✅ >95% SLO compliance
- ✅ <2% query failures

**Needs Investigation:**
- ⚠️ P95 > 500ms
- ⚠️ <90% SLO compliance
- ⚠️ >5% query failures
- ⚠️ Trending slower over time

**Critical Issues:**
- 🚨 P95 > 1000ms
- 🚨 <80% SLO compliance
- 🚨 >10% query failures
- 🚨 Complete outage

---

## 📞 Additional Resources

**Supabase Logs:**
- Dashboard → Edge Functions → home-feed → Logs
- Look for `[SLO BREACH]` or `[SLO OK]` messages

**PostHog Dashboard:**
- Project → Dashboards → "Feed Performance SLO"

**Database:**
- Dashboard → Database → Query Performance
- Check `pg_stat_statements` for slow queries

**Slack:**
- #engineering-alerts (automated alerts)
- #backend-team (escalations)

---

**This runbook ensures fast response to performance degradation!** 📊

