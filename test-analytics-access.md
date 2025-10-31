# Analytics Dashboard - Quick Access Guide

## 🚀 Access the Dashboard

### Direct URL
```
http://localhost:8080/campaign-analytics
```

### URL Parameters (Optional)
```
http://localhost:8080/campaign-analytics?campaignId=3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec
```

---

## 📊 Dashboard Features

### KPI Cards
- **Total Spend**: 0.5 credits ($0.50) currently
- **Impressions**: Number of ad views
- **Clicks**: Number of CTA clicks
- **CTR**: Click-through rate percentage

### Time Series Chart
- View spend trends over time
- Filter by date range (7d, 30d, custom)
- Built with Recharts

### Creative Breakdown
- See which creatives perform best
- Sort by impressions, clicks, CTR
- Identify top performers

### Viewability Metrics
- % of viewable impressions
- Average dwell time
- Visibility percentage

---

## 🔍 Test Data Available

Your campaign already has:
- **Campaign ID**: `3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec`
- **Current Spend**: 0.5 credits
- **Impressions**: 1 viewable impression
- **Budget**: 10,000 credits

---

## 🎯 How to Populate with More Data

### Generate Test Impressions
1. Open feed: `http://localhost:8080`
2. Scroll to promoted ad
3. Let it display 1+ seconds
4. Repeat with different sessions/users

### Generate Test Clicks
1. Click "Learn More" button on promoted ad
2. Each click is attributed to prior impression

### View Updated Analytics
1. Refresh analytics dashboard
2. Or manually refresh materialized view:

```sql
-- In Supabase SQL Editor:
SELECT public.refresh_analytics();
```

---

## 🔗 Add Navigation Link

### In Your Organizer Dashboard
Add a link/button to the analytics:

```tsx
import { Link } from 'react-router-dom';

<Link to="/campaign-analytics">
  📊 View Analytics
</Link>
```

### Or with Campaign ID
```tsx
<Link to={`/campaign-analytics?campaignId=${campaignId}`}>
  📊 View Campaign Analytics
</Link>
```

---

## 📈 Analytics V2 Views (Backend)

The dashboard queries these views directly:

### 1. `public.analytics_campaign_daily`
Daily rollup of campaign metrics:
```sql
SELECT * FROM public.analytics_campaign_daily
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY day DESC;
```

### 2. `public.analytics_creative_daily`
Per-creative performance:
```sql
SELECT * FROM public.analytics_creative_daily
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY day DESC, impressions DESC;
```

### 3. `public.analytics_viewability_campaign`
Viewability metrics:
```sql
SELECT * FROM public.analytics_viewability_campaign
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';
```

### 4. `public.analytics_attribution_campaign`
Attribution breakdown:
```sql
SELECT * FROM public.analytics_attribution_campaign
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';
```

### 5. `public.analytics_campaign_daily_mv` (Materialized)
Fast cached version for performance:
```sql
SELECT * FROM public.analytics_campaign_daily_mv
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';
```

---

## 🔄 Refresh Analytics Data

### Manual Refresh
```sql
SELECT public.refresh_analytics();
```

### Automatic Refresh (Optional)
Set up a cron job in Supabase Dashboard:
1. Go to Database → Cron Jobs
2. Create new job
3. Schedule: `*/5 * * * *` (every 5 minutes)
4. SQL: `SELECT public.refresh_analytics();`

---

## 🎨 Customize the Dashboard

### Files to Edit

**Main Dashboard Page:**
```
src/analytics/CampaignAnalyticsPage.tsx
```

**Individual Components:**
```
src/analytics/components/MetricsBar.tsx          - KPI cards
src/analytics/components/TimeSeriesChart.tsx     - Spend chart
src/analytics/components/ViewabilityCard.tsx     - Viewability metrics
src/analytics/components/AttributionPie.tsx      - Pie chart
src/analytics/components/CreativeTable.tsx       - Creative breakdown
src/analytics/components/PacingCard.tsx          - Budget pacing
```

**Data Fetching:**
```
src/analytics/api/queries.ts    - API calls
src/analytics/hooks/useAnalytics.ts - React hook
```

---

## 🐛 Troubleshooting

### Dashboard shows no data
1. Check materialized view is populated:
   ```sql
   SELECT COUNT(*) FROM public.analytics_campaign_daily_mv;
   ```

2. Manually refresh:
   ```sql
   SELECT public.refresh_analytics();
   ```

3. Check campaign has impressions:
   ```sql
   SELECT COUNT(*) FROM campaigns.ad_impressions
   WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';
   ```

### 404 Error on analytics views
Views should be in `public` schema. Verify:
```sql
SELECT schemaname, viewname 
FROM pg_views 
WHERE viewname LIKE 'analytics_%';
```

### Slow loading
The materialized view should make it fast. If slow:
```sql
-- Check if matview has unique index
SELECT indexname FROM pg_indexes 
WHERE tablename = 'analytics_campaign_daily_mv';

-- Should see: idx_acdmv_campaign_day_unique
```

---

## ✅ Quick Test

1. **Navigate to dashboard:**
   ```
   http://localhost:8080/campaign-analytics
   ```

2. **You should see:**
   - Spend: $0.50 (0.5 credits)
   - 1 impression
   - Beautiful charts with Recharts
   - Date range selector

3. **Generate more data:**
   - View ad 2 more times → 1.5 credits total
   - Click ad → increase CTR
   - Refresh dashboard → see updates

---

## 🎉 You're Ready!

The analytics dashboard is fully functional and ready to use!

**Access it now:** `http://localhost:8080/campaign-analytics`



