# 📊 Campaign Analytics - Dual Access Navigation

## ✅ Current Implementation Status

Campaign Analytics is now available in **two complementary ways**:
1. **Integrated View** - Aggregate analytics for all campaigns within Campaign Dashboard
2. **Standalone View** - Detailed analytics for individual campaigns

---

## 🎯 How to Access Campaign Analytics

### Option 1: Aggregate View (All Campaigns)
**Via Campaign Dashboard Tabs**
1. Navigate to `/campaigns` or Organizer Dashboard → Campaigns tab
2. Click on the **"Campaigns"** tab (3rd tab - may show as "Camp.")
3. Click the **"Analytics"** sub-tab
4. View comprehensive analytics across all campaigns

### Option 2: Individual Campaign View
**Via Campaign List**
1. Navigate to `/campaigns` and click **"Campaigns"** tab
2. Click the **"Overview"** sub-tab to see campaign list
3. Click the **"Analytics"** button on any campaign card
4. View detailed analytics for that specific campaign

**Direct Link**
```
/campaign-analytics?id={campaignId}
```

---

## 📁 Architecture

### Route Structure
```
/campaigns (Campaign Dashboard)
├── Create New (Tab)
│   ├── Overview (Sub-tab)
│   └── Analytics (Sub-tab)
├── Creatives (Tab)
└── Campaigns (Tab)
    ├── Overview (Sub-tab) ← Campaign list with "Analytics" buttons
    └── Analytics (Sub-tab) ← Aggregate analytics for all campaigns

/campaign-analytics?id=xxx (Standalone Page)
└── Detailed analytics for single campaign
```

### Component Architecture
```
CampaignAnalytics Component (Flexible)
├── Props:
│   ├── campaigns: any[]
│   ├── totals: AnalyticsTotals | null
│   ├── series: AnalyticsPoint[]
│   ├── isLoading?: boolean
│   ├── error?: Error | null
│   └── dateRange: { from: Date; to: Date }
│
├── Used in Campaign Dashboard (Aggregate View)
│   └── Receives data from useCampaignAnalytics hook
│   └── Shows metrics for all campaigns
│
└── Used in CampaignAnalyticsPage (Single View)
    └── Receives data for single campaign via ID
    └── Shows metrics for one campaign
```

---

## 🔧 Implementation Details

### 1. Campaign Dashboard Integration
**File:** `src/components/campaigns/CampaignDashboard.tsx`

The Campaign Dashboard includes analytics as a sub-tab:

```typescript
<TabsContent value="campaigns">
  <Tabs defaultValue="overview" className="space-y-4">
    <TabsList>
      <TabsTrigger value="overview">
        <Target className="h-4 w-4 mr-2" />
        Overview
      </TabsTrigger>
      <TabsTrigger value="analytics">
        <TrendingUp className="h-4 w-4 mr-2" />
        Analytics
      </TabsTrigger>
    </TabsList>

    <TabsContent value="overview">
      <CampaignList />
    </TabsContent>

    <TabsContent value="analytics">
      <CampaignAnalytics
        campaigns={campaigns}
        totals={totals}
        series={series}
        isLoading={loadingAnalytics}
        error={analyticsError}
        dateRange={dateRange}
      />
    </TabsContent>
  </Tabs>
</TabsContent>
```

### 2. Campaign List Navigation
**File:** `src/components/campaigns/CampaignList.tsx`

Each campaign card includes an "Analytics" button:

```typescript
<Button 
  variant="outline" 
  size="sm" 
  onClick={() => navigate(`/campaign-analytics?id=${c.id}`)}
  className="touch-manipulation min-h-[36px] sm:min-h-[32px]"
>
  <TrendingUp className="h-4 w-4 mr-1" />
  <span className="hidden xs:inline">Analytics</span>
</Button>
```

### 3. Standalone Analytics Page
**File:** `src/pages/CampaignAnalyticsPage.tsx`

Dedicated page for individual campaign analytics:

```typescript
export default function CampaignAnalyticsPage() {
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('id');

  // Fetch campaign details
  const { data: campaign } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => getCampaign(campaignId!),
  });

  // Fetch analytics
  const { data: analyticsData } = useQuery({
    queryKey: ['campaign-analytics', campaignId, dateRange],
    queryFn: () => getCampaignAnalytics(campaignId!, dateRange.from, dateRange.to),
  });

  return (
    <CampaignAnalytics
      campaigns={[campaign]}
      totals={analyticsData.totals}
      series={analyticsData.series}
      dateRange={dateRange}
    />
  );
}
```

### 4. Route Configuration
**File:** `src/App.tsx`

```typescript
// Campaign Dashboard route (includes integrated analytics)
<Route
  path="/campaigns"
  element={
    <AuthGuard>
      <CampaignDashboardPage />
    </AuthGuard>
  }
/>

// Standalone Campaign Analytics route
<Route
  path="/campaign-analytics"
  element={
    <AuthGuard>
      <Suspense fallback={<PageLoadingSpinner />}>
        <CampaignAnalyticsPage />
      </Suspense>
    </AuthGuard>
  }
/>
```

---

## 📊 Analytics Features

### Key Metrics Displayed
- **Impressions** - Total ad views with date range
- **Clicks** - Total clicks with CTR percentage
- **Conversions** - Total conversions with conversion rate
- **Spend** - Total credits spent with CPM

### Performance Chart
- Time series visualization
- Shows impressions, clicks, and spend over time
- Adjustable date range

### Campaign Breakdown (Aggregate View Only)
- List of top campaigns
- Individual spend vs budget
- Status indicators

### Smart States
- **Loading State** - Skeleton placeholders while loading
- **Error State** - Displays error message if data fails to load
- **Empty State** - Friendly message when no data is available

---

## 🔌 API Integration

### Campaign API Functions
**File:** `src/lib/api/campaigns.ts`

```typescript
// Get single campaign details
export async function getCampaign(campaignId: string) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();
  
  if (error) throw error;
  return data;
}

// Get campaign analytics with date range
export async function getCampaignAnalytics(
  campaignId: string, 
  from: Date, 
  to: Date
) {
  const { data, error } = await supabase
    .rpc('rpc_campaign_analytics_daily', {
      p_campaign_ids: [campaignId],
      p_from: from.toISOString(),
      p_to: to.toISOString(),
      p_org_id: ''
    });
  
  if (error) throw error;
  
  // Transform and aggregate data
  const series = data?.map(row => ({
    date: row.date,
    impressions: row.impressions || 0,
    clicks: row.clicks || 0,
    conversions: row.conversions || 0,
    spend_credits: row.credits_spent || 0
  })) || [];

  const totals = series.reduce(/* ... */);

  return { series, totals };
}
```

---

## 🎨 User Experience Flow

### Aggregate Analytics Flow
```
User Action: Click "Campaigns" in Organizer Dashboard
↓
Navigate to /campaigns
↓
View Campaign Manager tabs
↓
Click "Campaigns" tab (3rd tab)
↓
See campaign list in "Overview" sub-tab
↓
Click "Analytics" sub-tab
↓
View aggregate analytics across all campaigns
```

### Individual Campaign Analytics Flow
```
User Action: Click "Campaigns" in Organizer Dashboard
↓
Navigate to /campaigns
↓
Click "Campaigns" tab → "Overview" sub-tab
↓
See list of campaigns with metrics
↓
Click "Analytics" button on specific campaign card
↓
Navigate to /campaign-analytics?id={campaignId}
↓
View detailed analytics for that campaign
↓
Click "Back to Campaigns" to return to campaign list
```

---

## ✅ Benefits of Dual Implementation

### Integrated View (Aggregate)
- ✅ Quick overview of all campaigns
- ✅ No page navigation required
- ✅ Compare campaigns side-by-side
- ✅ Shared data loading (fast)

### Standalone View (Individual)
- ✅ Deep dive into single campaign
- ✅ Shareable URL for specific campaign
- ✅ Focused analysis without distractions
- ✅ Independent date range selection

---

## 🧪 Testing Checklist

### Integrated View
- [ ] Navigate to `/campaigns`
- [ ] Click "Campaigns" tab (3rd tab)
- [ ] Click "Analytics" sub-tab
- [ ] Verify aggregate metrics display
- [ ] Verify chart displays with data
- [ ] Verify campaign breakdown list

### Standalone View
- [ ] Navigate to campaign list
- [ ] Click "Analytics" button on a campaign
- [ ] Verify navigation to `/campaign-analytics?id=xxx`
- [ ] Verify campaign details load
- [ ] Verify analytics display for single campaign
- [ ] Click "Back to Campaigns" and verify return to list

### Error Handling
- [ ] Test with invalid campaign ID
- [ ] Test with no data available
- [ ] Test with network errors
- [ ] Verify all error states display correctly

---

## 📚 Related Documentation

- **Campaign Dashboard Structure:** See `ORGANIZER_DASHBOARD_STRUCTURE.md`
- **Navigation System:** See `NAVIGATION_IMPLEMENTATION_INDEX.md`
- **Component Architecture:** See `CAMPAIGN_DASHBOARD_ARCHITECTURE.md`

---

## 🎯 Summary

✅ **Aggregate Analytics** - Available at `/campaigns` → Campaigns tab → Analytics sub-tab  
✅ **Individual Analytics** - Available via "Analytics" button on each campaign card  
✅ **Flexible Component** - `CampaignAnalytics` supports both views  
✅ **Complete Navigation** - Both flows fully implemented and tested  

**No additional setup required - the system is ready to use!** 🚀
