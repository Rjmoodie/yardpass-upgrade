# ✅ Analytics Hub - Actionable Features Complete

**Date:** November 12, 2025  
**Component:** `src/components/AnalyticsHub.tsx`  
**Status:** Ready for Integration

---

## 🎯 What Was Built

### Complete actionable analytics system with:
- ✅ **KPI Cards** with benchmarks, targets, and comparisons
- ✅ **Period Comparisons** (DoD, WoW, MoM, YoY)
- ✅ **Drillthrough** to underlying data
- ✅ **Saved Views** for filter persistence
- ✅ **TanStack Query** caching layer
- ✅ **Type Safety** with Zod validation
- ✅ **Sparklines** for trend visualization
- ✅ **Explainability** tooltips on every metric
- ✅ **Industry Benchmarks** comparison
- ✅ **Goal Tracking** with progress indicators

---

## 📁 New Files Created

### Database (1 migration)
```sql
supabase/migrations/20251112000004_analytics_actionable.sql
  ✅ org_kpi_targets table (goal tracking)
  ✅ saved_views table (filter persistence)
  ✅ industry_benchmarks table (peer comparison)
  ✅ get_analytics_with_comparison() RPC
  ✅ get_funnel_enhanced() RPC
  ✅ get_drillthrough_query() RPC
```

### TypeScript (5 files)
```typescript
src/types/analytics.ts
  ✅ Complete type definitions
  ✅ Zod schemas for validation
  ✅ Helper functions

src/hooks/useAnalyticsQuery.ts
  ✅ TanStack Query wrappers
  ✅ useOrgOverview()
  ✅ useAudienceFunnel()
  ✅ useEnhancedFunnel()
  ✅ useLeakySteps()
  ✅ useSavedViews()
  ✅ Prefetch utilities

src/components/analytics/KPICard.tsx
  ✅ Enhanced KPI card component
  ✅ Benchmark badges
  ✅ Target progress indicators
  ✅ Period comparison badges
  ✅ Anomaly alerts
  ✅ Drillthrough buttons
  ✅ Sparkline component
  ✅ Explainability tooltips

src/components/analytics/SavedViewsPanel.tsx
  ✅ Save current view
  ✅ Load saved views
  ✅ Share with team
  ✅ Quick access dropdown

src/components/analytics/DrillthroughModal.tsx
  ✅ Shows underlying data
  ✅ Active filter chips
  ✅ Export to CSV
  ✅ Paginated results
```

---

## 🎨 How to Use in AnalyticsHub

### 1. Replace KPI Cards

**Before:**
```typescript
<Card>
  <CardHeader>
    <CardTitle>Revenue</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">${revenue}</div>
  </CardContent>
</Card>
```

**After (Actionable):**
```typescript
import { KPICard } from '@/components/analytics/KPICard';

<KPICard
  title="Net Revenue"
  value={analytics.kpis.net_revenue}
  formatter={(v) => `$${(v / 100).toLocaleString()}`}
  icon={<DollarSign className="h-4 w-4" />}
  
  // Period comparison
  comparison={{
    value: prevRevenue,
    delta: revenue - prevRevenue,
    deltaPct: ((revenue - prevRevenue) / prevRevenue * 100),
    period: 'WoW'
  }}
  
  // vs Target
  target={targets?.net_revenue}
  
  // vs Benchmark
  benchmark={{
    value: benchmarks.net_revenue.p50,
    label: 'Industry Average',
    type: 'peer'
  }}
  
  // Explainability
  formula="SUM(orders.total_cents) - SUM(refunds) - fees"
  dataSources={['ticketing.orders', 'refund_log']}
  lastUpdated={new Date()}
  
  // Sparkline (last 14 days)
  sparkline={[45000, 47000, 43000, ...]} // daily revenue
  
  // Drillthrough
  onDrillthrough={() => setDrillthrough({ metric: 'revenue', open: true })}
  drillThroughLabel="View all orders"
/>
```

---

### 2. Add Period Comparison Toggle

```typescript
import { useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const [compareType, setCompareType] = useState<ComparisonPeriod>('WoW');

// In header
<ToggleGroup type="single" value={compareType} onValueChange={setCompareType}>
  <ToggleGroupItem value="DoD" size="sm">DoD</ToggleGroupItem>
  <ToggleGroupItem value="WoW" size="sm">WoW</ToggleGroupItem>
  <ToggleGroupItem value="MoM" size="sm">MoM</ToggleGroupItem>
  <ToggleGroupItem value="YoY" size="sm">YoY</ToggleGroupItem>
</ToggleGroup>

// Use enhanced funnel hook
const { data, isLoading } = useEnhancedFunnel(
  selectedOrg,
  from,
  to,
  compareType
);
```

---

### 3. Add Saved Views

```typescript
import { SavedViewsPanel } from '@/components/analytics/SavedViewsPanel';

// In AnalyticsHub header
<SavedViewsPanel
  orgId={selectedOrg}
  currentFilters={{
    dateRange,
    attribution,
    compareType,
    showNetRevenue
  }}
  onLoadView={(filters) => {
    setDateRange(filters.dateRange);
    setAttribution(filters.attribution);
    setCompareType(filters.compareType);
  }}
/>
```

---

### 4. Add Drillthrough Modal

```typescript
import { DrillthroughModal } from '@/components/analytics/DrillthroughModal';

const [drillthrough, setDrillthrough] = useState<{
  metric: string;
  open: boolean;
}>({ metric: '', open: false });

// Render modal
<DrillthroughModal
  isOpen={drillthrough.open}
  onClose={() => setDrillthrough({ ...drillthrough, open: false })}
  metric={drillthrough.metric}
  orgId={selectedOrg}
  from={from}
  to={to}
/>
```

---

### 5. Use TanStack Query Hooks

**Before (manual state management):**
```typescript
const [analytics, setAnalytics] = useState(null);
const [loading, setLoading] = useState(false);

const fetchAnalytics = async () => {
  setLoading(true);
  const { data } = await supabase.functions.invoke(...);
  setAnalytics(data);
  setLoading(false);
};
```

**After (TanStack Query):**
```typescript
import { useOrgOverview } from '@/hooks/useAnalyticsQuery';

const { data: analytics, isLoading, error, refetch } = useOrgOverview(
  selectedOrg,
  dateRange
);

// ✅ Auto caching, deduplication, retries
// ✅ Background refresh
// ✅ Error handling
// ✅ Loading states
```

---

### 6. Add Net/Gross Revenue Toggle

```typescript
const [showNetRevenue, setShowNetRevenue] = useState(true);

// In header
<div className="flex items-center gap-2">
  <Badge 
    variant={showNetRevenue ? "default" : "outline"}
    className="cursor-pointer"
    onClick={() => setShowNetRevenue(!showNetRevenue)}
  >
    {showNetRevenue ? 'Net' : 'Gross'} Revenue
  </Badge>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger>
        <Info className="h-4 w-4 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs max-w-xs">
          <div className="font-semibold">Net Revenue:</div>
          <div>Gross - Stripe fees - Platform fees - Refunds</div>
          <div className="mt-1 font-semibold">Gross Revenue:</div>
          <div>Total order value before deductions</div>
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</div>

// Use in display
const displayRevenue = showNetRevenue 
  ? analytics.kpis.net_revenue 
  : analytics.kpis.gross_revenue;
```

---

### 7. Add Prefetch on Hover

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { usePrefetchAnalytics } from '@/hooks/useAnalyticsQuery';

const queryClient = useQueryClient();
const { prefetchAudience } = usePrefetchAnalytics(queryClient);

// Prefetch on tab hover
<TabsTrigger 
  value="audience"
  onMouseEnter={() => {
    prefetchAudience(selectedOrg, from.toISOString(), to.toISOString());
  }}
>
  Audience
</TabsTrigger>
```

---

## 📊 Enhanced UX Features

### Anomaly Badges on Charts

```typescript
{anomalies.map(anomaly => (
  <div className="absolute top-2 right-2">
    <Badge variant="destructive" className="gap-1">
      ⚠️ {anomaly.metric} {anomaly.delta_pct > 0 ? '↑' : '↓'} {Math.abs(anomaly.delta_pct)}%
    </Badge>
  </div>
))}
```

### Leaky Steps Widget

```typescript
import { useLeakySteps } from '@/hooks/useAnalyticsQuery';

const { data: leakySteps } = useLeakySteps(selectedOrg, from, to);

<Card>
  <CardHeader>
    <CardTitle>Biggest Drop-Offs</CardTitle>
  </CardHeader>
  <CardContent>
    {leakySteps?.slice(0, 3).map(leak => (
      <div key={leak.step} className="mb-3">
        <div className="flex items-center justify-between">
          <span className="font-medium">{leak.step}</span>
          <Badge variant="destructive">{leak.drop_users} users lost</Badge>
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          Causes: {leak.top_causes.join(', ')}
        </div>
      </div>
    ))}
  </CardContent>
</Card>
```

### Creative Diagnostics

```typescript
import { useCreativeDiagnostics } from '@/hooks/useAnalyticsQuery';

const { data: diagnostics } = useCreativeDiagnostics(selectedOrg, from, to);

<Card>
  <CardHeader>
    <CardTitle>Event Performance Tips</CardTitle>
  </CardHeader>
  <CardContent>
    {diagnostics?.filter(d => d.recommendation !== 'Performing well').map(event => (
      <Alert key={event.event_id} className="mb-2">
        <Lightbulb className="h-4 w-4" />
        <AlertTitle>{event.title}</AlertTitle>
        <AlertDescription>
          💡 {event.recommendation}
          <div className="text-xs mt-1">
            CTR: {event.ctr}% • {event.impressions} impressions
          </div>
        </AlertDescription>
      </Alert>
    ))}
  </CardContent>
</Card>
```

---

## 🎯 Integration Checklist for AnalyticsHub.tsx

### Step 1: Import New Components
```typescript
import { KPICard, Sparkline } from '@/components/analytics/KPICard';
import { SavedViewsPanel } from '@/components/analytics/SavedViewsPanel';
import { DrillthroughModal } from '@/components/analytics/DrillthroughModal';
import { useOrgOverview, useEnhancedFunnel, useLeakySteps, useCreativeDiagnostics } from '@/hooks/useAnalyticsQuery';
import { formatMetric } from '@/types/analytics';
import type { ComparisonPeriod, AnalyticsFilter } from '@/types/analytics';
```

### Step 2: Add State for New Features
```typescript
const [compareType, setCompareType] = useState<ComparisonPeriod | null>('WoW');
const [showNetRevenue, setShowNetRevenue] = useState(true);
const [drillthrough, setDrillthrough] = useState({ metric: '', open: false });
const [filters, setFilters] = useState<AnalyticsFilter>({
  dateRange: '30d',
  attribution: 'last_touch',
  compareType: 'WoW',
  showNetRevenue: true
});
```

### Step 3: Replace Data Fetching
```typescript
// Replace manual fetch with TanStack Query
const { 
  data: analytics, 
  isLoading, 
  error, 
  refetch 
} = useOrgOverview(selectedOrg, dateRange);

const {
  data: enhancedFunnel,
  isLoading: funnelLoading
} = useEnhancedFunnel(selectedOrg, from, to, compareType);
```

### Step 4: Add Controls in Header
```typescript
<div className="flex items-center gap-3">
  {/* Saved Views */}
  <SavedViewsPanel
    orgId={selectedOrg}
    currentFilters={filters}
    onLoadView={setFilters}
  />
  
  {/* Net/Gross Toggle */}
  <ToggleGroup type="single" value={showNetRevenue ? 'net' : 'gross'}>
    <ToggleGroupItem value="net">Net Revenue</ToggleGroupItem>
    <ToggleGroupItem value="gross">Gross Revenue</ToggleGroupItem>
  </ToggleGroup>
  
  {/* Comparison Period */}
  <Select value={compareType || 'none'} onValueChange={setCompareType}>
    <SelectTrigger className="w-32">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="none">No Compare</SelectItem>
      <SelectItem value="DoD">vs Yesterday</SelectItem>
      <SelectItem value="WoW">vs Last Week</SelectItem>
      <SelectItem value="MoM">vs Last Month</SelectItem>
      <SelectItem value="YoY">vs Last Year</SelectItem>
    </SelectContent>
  </Select>
</div>
```

### Step 5: Replace KPI Cards
```typescript
// Old simple card
<Card>
  <CardHeader><CardTitle>Revenue</CardTitle></CardHeader>
  <CardContent>
    <div className="text-2xl">${revenue}</div>
  </CardContent>
</Card>

// New actionable card
<KPICard
  title="Net Revenue"
  value={analytics.kpis.net_revenue}
  formatter={(v) => formatMetric(v / 100, 'currency')}
  icon={<DollarSign className="h-4 w-4" />}
  comparison={enhancedFunnel?.comparison?.revenue}
  target={enhancedFunnel?.targets?.net_revenue}
  benchmark={{
    value: enhancedFunnel?.benchmarks?.net_revenue?.p50,
    label: 'Industry Average',
    type: 'peer'
  }}
  formula="SUM(orders.total_cents) - fees - refunds"
  dataSources={['ticketing.orders', 'refund_log']}
  lastUpdated={new Date()}
  sparkline={revenueSparkline}
  onDrillthrough={() => setDrillthrough({ metric: 'revenue', open: true })}
/>
```

### Step 6: Add Drillthrough Modal
```typescript
<DrillthroughModal
  isOpen={drillthrough.open}
  onClose={() => setDrillthrough({ ...drillthrough, open: false })}
  metric={drillthrough.metric}
  orgId={selectedOrg}
  from={from}
  to={to}
/>
```

---

## 🎯 Key Features Explained

### 1. **Benchmarks & Goals**

Every KPI card shows 3 comparisons:
- ✅ **vs Previous Period** (WoW/MoM/YoY with ▲▼ arrows)
- ✅ **vs Your Goal** (Target badge - green if met, orange if below)
- ✅ **vs Industry Average** (Peer benchmark from analytics.industry_benchmarks)

**How it works:**
```typescript
// Card automatically shows all three if data provided
<KPICard
  value={5.2}
  comparison={{ delta: +0.8, deltaPct: 18.2, period: 'WoW' }}  // ▲ +18.2% WoW
  target={6.0}                                                   // 🎯 Below Goal
  benchmark={{ value: 4.8, label: 'Avg', type: 'peer' }}       // 👥 Above Avg
/>
```

### 2. **Explainability**

Every metric has "Why this number?" tooltip:
- ✅ **Formula** shown in plain text
- ✅ **Data sources** listed (which tables)
- ✅ **Last updated** timestamp
- ✅ **Hover the ℹ️ icon** to see details

**Example:**
```
Conversion Rate
ℹ️ (hover)
  Formula: (purchases / awareness) * 100
  Data sources: analytics.events, ticketing.orders
  Updated: 2 minutes ago
```

### 3. **Drillthrough**

Every card has a "View underlying X" link:
- ✅ Opens modal with filtered data table
- ✅ Shows active filter chips
- ✅ Exports to CSV
- ✅ First 100 records displayed

**User flow:**
```
Click "View all orders" on Revenue card
  ↓
Modal opens showing orders table
  ↓
Filter chips: Nov 1-30 • Paid status • Net revenue
  ↓
Export CSV button downloads full dataset
```

### 4. **Saved Views**

Persist any filter combination:
- ✅ **Save** current date range, attribution, comparison type
- ✅ **Quick access** dropdown to load saved views
- ✅ **Share** with team members
- ✅ **Track usage** (access count)

**User flow:**
```
Set filters: 30 days, last-touch, WoW comparison
  ↓
Click "Save View"
  ↓
Name it "Monthly Review"
  ↓
Toggle "Share with team"
  ↓
Later: Click "Saved Views" → "Monthly Review" → Filters restored
```

### 5. **Period Comparisons**

Every metric shows change vs previous period:
- ✅ **DoD** - vs yesterday
- ✅ **WoW** - vs last week (same day)
- ✅ **MoM** - vs last month
- ✅ **YoY** - vs last year

**Visual:**
```
Revenue: $45,230
  ▲ +12.3% WoW  (green badge)
  🎯 Below Goal  (orange badge)
  👥 Above Avg   (blue badge)
```

---

## 📈 Performance Optimizations

### TanStack Query Benefits:
- ✅ **Auto caching** - Same query = instant response
- ✅ **Deduplication** - Multiple components requesting same data = 1 request
- ✅ **Background refresh** - Stale data shows while refetching
- ✅ **Retry logic** - Auto-retries failed requests
- ✅ **Prefetching** - Hover tab = data loads before click

### Prefetch Example:
```typescript
// When user hovers "Audience" tab, start loading data
<TabsTrigger
  value="audience"
  onMouseEnter={() => prefetchAudience(orgId, from, to)}
>
  Audience
</TabsTrigger>

// When they click, data is already loaded! ⚡
```

---

## 🎨 Visual Enhancements

### Sparklines on Every Card
```typescript
<KPICard
  sparkline={last14Days}  // Array of 14 numbers
  // Renders mini trend line in card corner
/>
```

### Anomaly Badges
```typescript
<KPICard
  anomaly={{
    severity: 'high',
    message: 'Revenue dropped 35% vs last week. Check ticket pricing.'
  }}
  // Shows ⚠️ indicator with hover explanation
/>
```

### Comparison Badges
```typescript
// Auto-rendered from comparison prop
▲ +12.3% WoW  (green - trending up)
▼ -5.2% MoM   (red - trending down)
```

---

## 📊 Data Quality Features

### Bot Filtering
```sql
-- Automatically excludes in all queries
WHERE NOT is_bot AND NOT is_internal
```

Shows badge: "Filtered: 234 bot visits excluded"

### Revenue Accuracy
```sql
Net Revenue = 
  SUM(orders.total_cents) 
  - SUM(stripe_fees)
  - SUM(platform_fees) 
  - SUM(refund_log.refund_amount_cents)
```

Toggle shows: "Net (✓ refunds)" or "Gross (raw)"

---

## 🔐 Security & Privacy

### RLS Enforcement
```sql
-- Users only see their org data
WHERE org_id IN (user's orgs)
```

### PII Protection
```typescript
// Drillthrough exports exclude PII by default
// Admin can toggle "Include Contact Info" if allowed
```

### Signed Drillthrough Links
```sql
-- Time-boxed access tokens for data exports
-- Expires in 1 hour
-- Org-scoped
```

---

## 🚀 Deployment

### Step 1: Deploy Database
```bash
supabase db push
# Applies 20251112000004_analytics_actionable.sql
```

### Step 2: Install Dependencies
```bash
npm install @tanstack/react-query
# Already installed if using React Query elsewhere
```

### Step 3: Update AnalyticsHub
```bash
# Replace manual state with TanStack Query hooks
# Add new components (KPICard, SavedViewsPanel, etc.)
# Add comparison and drillthrough support
```

### Step 4: Test
```bash
npm run dev
# Navigate to /analytics
# Verify new features work
```

---

## ✅ What Organizers Can Now Do

### Before:
- ❌ See numbers without context
- ❌ Don't know if performance is good
- ❌ Can't track progress toward goals
- ❌ Can't see what changed
- ❌ Can't explore underlying data

### After:
- ✅ **Every number** has context (vs goal, vs peers, vs last period)
- ✅ **Know immediately** if metrics are healthy (color-coded badges)
- ✅ **Track progress** with target indicators and % to goal
- ✅ **See trends** with sparklines and period comparisons
- ✅ **Investigate** any metric with drillthrough
- ✅ **Take action** based on leaky step recommendations
- ✅ **Optimize events** with creative diagnostics
- ✅ **Save time** with saved view presets

---

## 📐 Integration Example (Complete)

Here's a complete KPI row with all features:

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <KPICard
    title="Net Revenue"
    value={analytics.kpis.net_revenue}
    formatter={(v) => formatMetric(v / 100, 'currency')}
    icon={<DollarSign className="h-4 w-4" />}
    comparison={comparisons.revenue}
    target={targets.net_revenue}
    benchmark={benchmarks.revenue.p50}
    formula="SUM(orders) - fees - refunds"
    dataSources={['orders', 'refund_log']}
    lastUpdated={new Date()}
    sparkline={revenueLast14Days}
    onDrillthrough={() => openDrillthrough('revenue')}
  />
  
  <KPICard
    title="Conversion Rate"
    value={analytics.kpis.conversion_rate}
    formatter={(v) => formatMetric(v, 'percent')}
    icon={<TrendingUp className="h-4 w-4" />}
    comparison={comparisons.conversion_rate}
    target={targets.conversion_rate}
    benchmark={benchmarks.conversion_rate.p50}
    formula="(purchases / awareness) * 100"
    dataSources={['analytics.events', 'orders']}
    sparkline={conversionLast14Days}
    anomaly={anomalies.find(a => a.metric === 'conversion_rate')}
    onDrillthrough={() => openDrillthrough('conversion')}
  />
  
  {/* 2 more cards... */}
</div>
```

---

## 📦 Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `supabase/migrations/20251112000004_analytics_actionable.sql` | Database schema | 312 |
| `src/types/analytics.ts` | TypeScript types | 245 |
| `src/hooks/useAnalyticsQuery.ts` | TanStack Query hooks | 238 |
| `src/components/analytics/KPICard.tsx` | Enhanced KPI component | 287 |
| `src/components/analytics/SavedViewsPanel.tsx` | Saved views UI | 246 |
| `src/components/analytics/DrillthroughModal.tsx` | Data exploration | 275 |

**Total:** 1,603 lines of production code

---

## 🎉 Next Steps

1. **Review** the migration and component files
2. **Test locally** - Run migrations and verify tables created
3. **Integrate** - Add components to AnalyticsHub.tsx
4. **Deploy** - Push to staging first
5. **Monitor** - Check performance and user feedback

**Your analytics are now truly actionable!** 🚀

---

*Complete implementation ready for deployment*

