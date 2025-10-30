# 📊 Analytics V2 Upgrade Plan

## 🔍 Current State (What We Built Today)

### ✅ Already Working:
1. **Ad Tracking System**
   - `campaigns.ad_impressions` - tracking views
   - `campaigns.ad_clicks` - tracking clicks
   - `campaigns.ad_conversions` - tracking conversions
   - `campaigns.ad_spend_ledger` - billing audit trail

2. **Basic Analytics RPCs**
   - `public.rpc_campaign_analytics_daily` - daily metrics
   - `public.rpc_creative_analytics_rollup` - creative performance

3. **Frontend**
   - `useCampaignAnalytics` - React hook
   - `useCreativeRollup` - React hook
   - Campaign Manager tab (basic)

4. **Billing**
   - CPM billing with fractional accumulation
   - Wallet integration
   - $5 CPM (500 credits per 1,000 impressions)

---

## 🆚 V2 System Comparison

| Feature | Current (V1) | Proposed (V2) | Action |
|---------|-------------|---------------|---------|
| **Data Model** | Direct aggregations | Calendar spine + views | ✅ **UPGRADE** - Better zero-filling |
| **Views** | None | 6 analytics views | ✅ **ADD** - Better separation |
| **Materialized Views** | None | `analytics_campaign_daily_mv` | ✅ **ADD** - Performance boost |
| **Viewability** | Basic (pct_visible, dwell) | Comprehensive metrics | ✅ **ENHANCE** - Add aggregations |
| **Attribution** | None | Last-click vs View-through | ✅ **ADD** - New feature |
| **Edge Function** | Basic ad-events | Unified analytics API | ⚠️ **OPTIONAL** - We have working RPCs |
| **Frontend Components** | Basic | Polished Recharts | ✅ **UPGRADE** - Better UX |
| **Refresh Jobs** | None | pg_cron scheduled | ✅ **ADD** - Keep data fresh |
| **Budget Pacing** | None | Visual progress | ✅ **ADD** - Nice feature |

---

## 🎯 Upgrade Strategy

### Phase 1: Backend Foundation (1-2 hours)
**Goal:** Add V2 SQL layer without breaking current system

#### Step 1.1: Schema Compatibility Fixes
**Issue:** V2 expects `clicked_at` column, we have `created_at`

```sql
-- Option A: Add alias column (safest)
ALTER TABLE campaigns.ad_clicks 
ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ 
GENERATED ALWAYS AS (created_at) STORED;

-- Option B: Modify V2 queries to use created_at (simpler)
-- We'll do Option B
```

#### Step 1.2: Deploy V2 Views
```bash
# Create new migration
supabase/migrations/20251027000000_analytics_v2_views.sql
```

**Contains:**
1. ✅ `util.calendar_day` table + seed
2. ✅ `campaigns.analytics_campaign_daily` view
3. ✅ `campaigns.analytics_creative_daily` view
4. ✅ `campaigns.analytics_viewability_campaign` view
5. ✅ `campaigns.analytics_attribution_campaign` view
6. ✅ `campaigns.analytics_campaign_daily_mv` materialized view
7. ✅ `campaigns.refresh_analytics()` function
8. ✅ RLS policies

**Modifications needed:**
- Replace `clicked_at` with `created_at`
- Use existing `campaigns.ad_spend_ledger` structure
- Handle our `org_wallet_id` column

---

### Phase 2: RPC Migration (30 mins)
**Goal:** Keep existing RPCs OR migrate to V2 pattern

#### Decision Point: 
**Option A:** Keep current RPCs (they work!)
- ✅ No breaking changes
- ✅ Frontend already integrated
- ❌ Less elegant than V2 views

**Option B:** Deprecate RPCs, use V2 views directly
- ✅ Cleaner architecture
- ✅ Better caching with matviews
- ⚠️ Need to update frontend hooks

**RECOMMENDATION: Option B** - V2 views are superior

```typescript
// Old: useCampaignAnalytics.ts calls RPC
await supabase.rpc("rpc_campaign_analytics_daily", {...});

// New: Query view directly
await supabase
  .from("analytics_campaign_daily_mv")
  .select("*")
  .eq("campaign_id", campaignId)
  .gte("day", from)
  .lte("day", to);
```

---

### Phase 3: Frontend Upgrade (2-3 hours)
**Goal:** Replace basic analytics with V2 polished components

#### Step 3.1: Install Dependencies
```bash
npm install recharts
```

#### Step 3.2: Copy V2 Structure
```
src/
  analytics/              # NEW folder
    api/
      getClient.ts        # Use existing supabase client
      queries.ts          # Update to use views
      types.ts            # V2 types
    hooks/
      useDateRange.ts     # NEW
      useAnalytics.ts     # Replaces useCampaignAnalytics
    components/
      MetricsBar.tsx      # NEW - Top KPI cards
      PacingCard.tsx      # NEW - Budget tracker
      TimeSeriesChart.tsx # NEW - Line/bar combo
      BarBreakdown.tsx    # NEW - Creative bars
      AttributionPie.tsx  # NEW - Attribution split
      CreativeTable.tsx   # NEW - Leaderboard
      ViewabilityCard.tsx # NEW - Viewability stats
    CampaignAnalyticsPage.tsx # Main dashboard
```

#### Step 3.3: Update Routing
```typescript
// Add route in your router
{
  path: "/campaign-analytics",
  element: <CampaignAnalyticsPage />
}
```

---

### Phase 4: Edge Function (Optional, 30 mins)
**Goal:** Add caching layer if needed

**Skip if:**
- Current RPC performance is good
- You're using matviews (they're already cached)

**Add if:**
- You want response caching (30s)
- You want to consolidate 4+ queries into 1 endpoint
- You want custom auth logic

---

### Phase 5: Refresh Jobs (15 mins)
**Goal:** Keep materialized views fresh

#### Option A: pg_cron (if available)
```sql
SELECT cron.schedule(
  'analytics_refresh_5min', 
  '*/5 * * * *', 
  $$SELECT campaigns.refresh_analytics();$$
);
```

#### Option B: Supabase Edge Function + Cron
```typescript
// supabase/functions/refresh-analytics/index.ts
import { createClient } from '@supabase/supabase-js';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  const { error } = await supabase.rpc('refresh_analytics');
  
  return new Response(
    JSON.stringify({ success: !error, error }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

Set up cron trigger in Supabase Dashboard: every 5 minutes

---

## 📋 Implementation Checklist

### Pre-Migration
- [ ] Backup current database
- [ ] Document current analytics usage
- [ ] Test V2 queries against your schema

### Migration Steps

#### Backend (Database)
- [ ] 1. Create `util` schema and `calendar_day` table
- [ ] 2. Seed calendar with last 365 days
- [ ] 3. Deploy V2 analytics views (adapted for our schema)
- [ ] 4. Create materialized view
- [ ] 5. Test views return correct data
- [ ] 6. Grant RLS permissions
- [ ] 7. Create refresh function
- [ ] 8. Set up refresh job (cron or Edge Function)

#### Frontend (React)
- [ ] 9. Install `recharts` dependency
- [ ] 10. Create `/src/analytics` folder structure
- [ ] 11. Copy V2 API utilities (adapted)
- [ ] 12. Copy V2 hooks
- [ ] 13. Copy V2 components
- [ ] 14. Create `CampaignAnalyticsPage.tsx`
- [ ] 15. Add route to router
- [ ] 16. Update Campaign Manager to link to new page
- [ ] 17. Test all charts render
- [ ] 18. Test date range switching

#### Optional
- [ ] 19. Create unified analytics Edge Function
- [ ] 20. Add response caching
- [ ] 21. Deprecate old RPC functions
- [ ] 22. Remove old analytics code

---

## 🔧 Schema Adaptation Script

Here's the adapted V2 migration for YOUR schema:

```sql
-- File: supabase/migrations/20251027000000_analytics_v2_views.sql

-- ===================================================================
-- ANALYTICS V2 VIEWS - Adapted for YardPass Schema
-- ===================================================================

-- 1. Calendar spine
CREATE SCHEMA IF NOT EXISTS util;
CREATE TABLE IF NOT EXISTS util.calendar_day(
  day DATE PRIMARY KEY
);

-- Seed last 365 days
INSERT INTO util.calendar_day(day)
SELECT d::DATE
FROM generate_series((NOW() - INTERVAL '365 days')::DATE, NOW()::DATE, INTERVAL '1 day') d
ON CONFLICT DO NOTHING;

-- 2. Campaign daily analytics
CREATE OR REPLACE VIEW campaigns.analytics_campaign_daily AS
SELECT
  c.id AS campaign_id,
  cal.day,
  COALESCE(i.impressions, 0) AS impressions,
  COALESCE(cl.clicks, 0) AS clicks,
  COALESCE(cv.conversions, 0) AS conversions,
  COALESCE(cv.value_cents, 0) AS conversion_value_cents,
  COALESCE(sp.spend_credits, 0) AS spend_credits
FROM campaigns.campaigns c
CROSS JOIN util.calendar_day cal
LEFT JOIN (
  SELECT campaign_id, created_at::DATE AS day, COUNT(*) AS impressions
  FROM campaigns.ad_impressions
  GROUP BY 1, 2
) i ON i.campaign_id = c.id AND i.day = cal.day
LEFT JOIN (
  SELECT campaign_id, created_at::DATE AS day, COUNT(*) AS clicks
  FROM campaigns.ad_clicks
  GROUP BY 1, 2
) cl ON cl.campaign_id = c.id AND cl.day = cal.day
LEFT JOIN (
  SELECT 
    COALESCE(clicks.campaign_id, imps.campaign_id) AS campaign_id,
    conv.occurred_at::DATE AS day,
    COUNT(*) AS conversions,
    SUM(COALESCE(conv.value_cents, 0)) AS value_cents
  FROM campaigns.ad_conversions conv
  LEFT JOIN campaigns.ad_clicks clicks ON clicks.id = conv.click_id
  LEFT JOIN campaigns.ad_impressions imps ON imps.id = conv.impression_id
  GROUP BY 1, 2
) cv ON cv.campaign_id = c.id AND cv.day = cal.day
LEFT JOIN (
  SELECT campaign_id, occurred_at::DATE AS day, SUM(credits_charged) AS spend_credits
  FROM campaigns.ad_spend_ledger
  GROUP BY 1, 2
) sp ON sp.campaign_id = c.id AND sp.day = cal.day
WHERE cal.day >= COALESCE(c.start_date::DATE, '2024-01-01')
  AND cal.day <= COALESCE(c.end_date::DATE, NOW()::DATE + 30);

-- 3. Creative daily analytics
CREATE OR REPLACE VIEW campaigns.analytics_creative_daily AS
SELECT
  cr.id AS creative_id,
  cr.campaign_id,
  cal.day,
  COALESCE(i.impressions, 0) AS impressions,
  COALESCE(cl.clicks, 0) AS clicks,
  COALESCE(cv.conversions, 0) AS conversions,
  COALESCE(sp.spend_credits, 0) AS spend_credits
FROM campaigns.ad_creatives cr
CROSS JOIN util.calendar_day cal
LEFT JOIN (
  SELECT creative_id, created_at::DATE AS day, COUNT(*) AS impressions
  FROM campaigns.ad_impressions
  WHERE creative_id IS NOT NULL
  GROUP BY 1, 2
) i ON i.creative_id = cr.id AND i.day = cal.day
LEFT JOIN (
  SELECT creative_id, created_at::DATE AS day, COUNT(*) AS clicks
  FROM campaigns.ad_clicks
  WHERE creative_id IS NOT NULL
  GROUP BY 1, 2
) cl ON cl.creative_id = cr.id AND cl.day = cal.day
LEFT JOIN (
  SELECT 
    COALESCE(clicks.creative_id, imps.creative_id) AS creative_id,
    conv.occurred_at::DATE AS day,
    COUNT(*) AS conversions
  FROM campaigns.ad_conversions conv
  LEFT JOIN campaigns.ad_clicks clicks ON clicks.id = conv.click_id
  LEFT JOIN campaigns.ad_impressions imps ON imps.id = conv.impression_id
  WHERE COALESCE(clicks.creative_id, imps.creative_id) IS NOT NULL
  GROUP BY 1, 2
) cv ON cv.creative_id = cr.id AND cv.day = cal.day
LEFT JOIN (
  SELECT creative_id, occurred_at::DATE AS day, SUM(credits_charged) AS spend_credits
  FROM campaigns.ad_spend_ledger
  WHERE creative_id IS NOT NULL
  GROUP BY 1, 2
) sp ON sp.creative_id = cr.id AND sp.day = cal.day
WHERE cal.day >= '2024-01-01'
  AND cal.day <= NOW()::DATE;

-- 4. Viewability metrics
CREATE OR REPLACE VIEW campaigns.analytics_viewability_campaign AS
SELECT
  campaign_id,
  COUNT(*) AS impressions,
  AVG(COALESCE(pct_visible, 0))::NUMERIC(6,2) AS avg_pct_visible,
  AVG(COALESCE(dwell_ms, 0))::NUMERIC(10,2) AS avg_dwell_ms,
  AVG(CASE WHEN viewable THEN 1 ELSE 0 END)::NUMERIC(5,4) AS viewability_rate
FROM campaigns.ad_impressions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1;

-- 5. Attribution
CREATE OR REPLACE VIEW campaigns.analytics_attribution_campaign AS
WITH attr AS (
  SELECT
    COALESCE(ac.click_id IS NOT NULL, FALSE) AS is_click,
    CASE 
      WHEN ac.click_id IS NOT NULL THEN 'last_click_7d'
      WHEN ac.impression_id IS NOT NULL THEN 'view_through_1d'
      ELSE 'none' 
    END AS model,
    COALESCE(cl.campaign_id, im.campaign_id) AS campaign_id,
    ac.value_cents,
    ac.occurred_at::DATE AS day
  FROM campaigns.ad_conversions ac
  LEFT JOIN campaigns.ad_clicks cl ON cl.id = ac.click_id
  LEFT JOIN campaigns.ad_impressions im ON im.id = ac.impression_id
)
SELECT 
  campaign_id,
  day,
  SUM(CASE WHEN model = 'last_click_7d' THEN 1 ELSE 0 END) AS click_conversions,
  SUM(CASE WHEN model = 'view_through_1d' THEN 1 ELSE 0 END) AS vt_conversions,
  SUM(COALESCE(value_cents, 0)) AS total_value_cents
FROM attr
WHERE campaign_id IS NOT NULL
GROUP BY 1, 2;

-- 6. Materialized view for performance
DROP MATERIALIZED VIEW IF EXISTS campaigns.analytics_campaign_daily_mv CASCADE;
CREATE MATERIALIZED VIEW campaigns.analytics_campaign_daily_mv AS
  SELECT * FROM campaigns.analytics_campaign_daily;

CREATE INDEX idx_acdmv_campaign_day 
  ON campaigns.analytics_campaign_daily_mv(campaign_id, day DESC);

-- 7. Refresh function
CREATE OR REPLACE FUNCTION campaigns.refresh_analytics() 
RETURNS VOID
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY campaigns.analytics_campaign_daily_mv;
END $$;

-- 8. Grants
GRANT SELECT ON campaigns.analytics_campaign_daily TO authenticated, anon;
GRANT SELECT ON campaigns.analytics_creative_daily TO authenticated, anon;
GRANT SELECT ON campaigns.analytics_viewability_campaign TO authenticated, anon;
GRANT SELECT ON campaigns.analytics_attribution_campaign TO authenticated, anon;
GRANT SELECT ON campaigns.analytics_campaign_daily_mv TO authenticated, anon;
GRANT EXECUTE ON FUNCTION campaigns.refresh_analytics() TO authenticated;

COMMENT ON VIEW campaigns.analytics_campaign_daily IS 'V2: Daily campaign metrics with calendar spine';
COMMENT ON VIEW campaigns.analytics_creative_daily IS 'V2: Daily creative performance';
COMMENT ON VIEW campaigns.analytics_viewability_campaign IS 'V2: Viewability quality metrics (30d rolling)';
COMMENT ON VIEW campaigns.analytics_attribution_campaign IS 'V2: Attribution model breakdown';
COMMENT ON MATERIALIZED VIEW campaigns.analytics_campaign_daily_mv IS 'V2: Cached daily metrics for performance';
```

---

## ⚠️ Breaking Changes

### What Will Break:
1. ❌ Current `useCampaignAnalytics` hook (uses old RPC)
2. ❌ Current `useCreativeRollup` hook (uses old RPC)
3. ❌ Any direct calls to `rpc_campaign_analytics_daily`

### What Won't Break:
1. ✅ Ad tracking (impressions, clicks)
2. ✅ Billing system
3. ✅ Edge Function (ad-events)
4. ✅ Feed integration
5. ✅ Campaign Manager (just update to link to new analytics page)

---

## 🧪 Testing Plan

### Unit Tests
```typescript
// Test V2 queries return data
describe('Analytics V2', () => {
  it('fetches daily metrics', async () => {
    const data = await fetchCampaignDaily(campaignId, range);
    expect(data).toHaveLength(7); // 7 days
    expect(data[0]).toHaveProperty('impressions');
  });
  
  it('handles zero days', async () => {
    const data = await fetchCampaignDaily(emptyCampaignId, range);
    expect(data.every(d => d.impressions === 0)).toBe(true);
  });
});
```

### Integration Tests
1. ✅ Calendar spine fills gaps correctly
2. ✅ Matview refresh works
3. ✅ Charts render without errors
4. ✅ Date range switching updates data
5. ✅ Attribution pie shows correct split
6. ✅ Viewability card displays metrics

---

## 📈 Performance Expectations

### Before (V1)
- RPC query time: ~200-500ms
- No caching
- Direct aggregations on every request

### After (V2)
- Matview query time: ~20-50ms (10x faster)
- Cached via materialized view
- Refresh every 5 minutes (stale data acceptable)

---

## 🚀 Deployment Timeline

### Day 1: Backend (2-3 hours)
- [ ] Morning: Deploy V2 views migration
- [ ] Morning: Verify views return correct data
- [ ] Afternoon: Set up matview refresh job
- [ ] Afternoon: Test performance

### Day 2: Frontend (3-4 hours)
- [ ] Morning: Install dependencies, copy V2 code
- [ ] Morning: Adapt API queries
- [ ] Afternoon: Integrate components
- [ ] Afternoon: Test end-to-end
- [ ] Evening: Deploy to staging

### Day 3: Polish & Deploy (2 hours)
- [ ] Morning: Fix any bugs
- [ ] Morning: Add loading states
- [ ] Afternoon: Deploy to production
- [ ] Afternoon: Monitor for issues

---

## 💡 Recommendations

### Must Do:
1. ✅ Deploy V2 views (huge quality improvement)
2. ✅ Use materialized view (10x performance boost)
3. ✅ Upgrade frontend components (better UX)
4. ✅ Set up refresh job (keep data fresh)

### Nice to Have:
- Attribution modeling (if you track conversions)
- Edge Function caching (if performance is critical)
- Custom date picker (beyond 7/14/30d presets)

### Can Skip:
- Edge Function (if RPCs work fine)
- Advanced viewability (if basic metrics sufficient)

---

## 🎯 Success Criteria

### Backend
- [ ] All V2 views return data
- [ ] Matview refreshes without errors
- [ ] Query performance <50ms
- [ ] No breaking changes to existing tracking

### Frontend
- [ ] Dashboard loads in <2s
- [ ] Charts render correctly
- [ ] Date range switching works
- [ ] All metrics display (no NaN or undefined)
- [ ] Mobile responsive

### Business
- [ ] Advertisers can see viewability metrics
- [ ] Attribution data informs optimization
- [ ] Budget pacing visible at a glance
- [ ] Creative performance informs A/B tests

---

## 📞 Next Steps

1. **Review this plan** - Any concerns or questions?
2. **Approve approach** - Option B (V2 views) vs Option A (keep RPCs)?
3. **Start Phase 1** - Deploy backend views
4. **Test thoroughly** - Verify data accuracy
5. **Deploy frontend** - Upgrade components

Want me to start implementing Phase 1 (backend views)? I can create the adapted migration file and deployment script right now! 🚀


