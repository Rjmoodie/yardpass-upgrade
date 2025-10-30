# Campaign Analytics API Fix - Complete ✅

## Problem
The standalone Campaign Analytics page (`/campaign-analytics?id=xxx`) was failing with a **400 Bad Request** error when calling the `rpc_campaign_analytics_daily` RPC function.

### Error Details
```
POST https://yieslxnrfeqchbcmgavz.supabase.co/rest/v1/rpc/rpc_campaign_analytics_daily 400 (Bad Request)
```

### Root Cause
The `getCampaignAnalytics` function in `src/lib/api/campaigns.ts` was passing an **empty string** for the required `p_org_id` parameter:

```typescript
// ❌ BEFORE (Broken)
p_org_id: '' // Will need org context
```

---

## Solution

### 1. Updated API Function Signature
**File:** `src/lib/api/campaigns.ts`

Added `orgId` as a required parameter:

```typescript
// ✅ AFTER (Fixed)
export async function getCampaignAnalytics(
  campaignId: string,
  orgId: string,      // ← Added required parameter
  from: Date, 
  to: Date
)
```

### 2. Fixed RPC Call
Updated the RPC call to:
- Pass the actual `orgId` instead of empty string
- Format dates correctly as `YYYY-MM-DD` (not full ISO string)

```typescript
const { data, error } = await supabase
  .rpc('rpc_campaign_analytics_daily', {
    p_campaign_ids: [campaignId],
    p_from: from.toISOString().slice(0, 10), // ✅ YYYY-MM-DD format
    p_to: to.toISOString().slice(0, 10),     // ✅ YYYY-MM-DD format
    p_org_id: orgId                           // ✅ Real org ID
  });
```

### 3. Updated CampaignAnalyticsPage
**File:** `src/pages/CampaignAnalyticsPage.tsx`

The page now:
1. **Fetches campaign details first** (to get `organization_id`)
2. **Uses campaign's org_id** to fetch analytics
3. **Waits for campaign to load** before requesting analytics

```typescript
// Fetch campaign first (includes organization_id)
const { data: campaign } = useQuery({
  queryKey: ['campaign', campaignId],
  queryFn: () => getCampaign(campaignId!),
  enabled: !!campaignId,
});

// Then fetch analytics using campaign's org_id
const { data: analyticsData } = useQuery({
  queryKey: ['campaign-analytics', campaignId, campaign?.organization_id, dateRange],
  queryFn: () => getCampaignAnalytics(
    campaignId!, 
    campaign!.organization_id,  // ✅ Use campaign's org_id
    dateRange.from, 
    dateRange.to
  ),
  enabled: !!campaignId && !!campaign?.organization_id,  // ✅ Wait for campaign
});
```

---

## Files Modified

### 1. `src/lib/api/campaigns.ts`
- ✅ Added `orgId` parameter to `getCampaignAnalytics()`
- ✅ Fixed date formatting (YYYY-MM-DD)
- ✅ Pass actual `orgId` to RPC call

### 2. `src/pages/CampaignAnalyticsPage.tsx`
- ✅ Fetch campaign first to get `organization_id`
- ✅ Pass campaign's `organization_id` to analytics API
- ✅ Add proper `enabled` condition to wait for campaign data

### 3. `src/components/campaigns/CampaignList.tsx`
- ✅ Added "Analytics" button to each campaign card
- ✅ Button navigates to `/campaign-analytics?id={campaignId}`

### 4. `src/App.tsx`
- ✅ Added `/campaign-analytics` route back
- ✅ Imported `CampaignAnalyticsPage` component

---

## How It Works Now

### Data Flow
```
User clicks "Analytics" on campaign card
↓
Navigate to /campaign-analytics?id={campaignId}
↓
CampaignAnalyticsPage loads
↓
Step 1: Fetch campaign details
  └─→ GET campaigns WHERE id = {campaignId}
  └─→ Returns: { id, name, organization_id, ... }
↓
Step 2: Fetch analytics using campaign's organization_id
  └─→ RPC rpc_campaign_analytics_daily({
        p_campaign_ids: [campaignId],
        p_org_id: campaign.organization_id,  ✅ Valid org ID
        p_from: "2025-10-15",
        p_to: "2025-10-28"
      })
  └─→ Returns: Analytics data
↓
Display analytics dashboard with charts and metrics
```

### Why This Approach?
1. **Security**: The RPC function enforces that the user has access to the organization
2. **Simplicity**: Campaign already contains the `organization_id`, no need to fetch separately
3. **Correctness**: Ensures analytics are fetched for the correct organization context

---

## Testing Checklist

### ✅ Prerequisites
- User must be logged in
- User must have access to at least one organization
- Organization must have at least one campaign

### ✅ Test Steps
1. Navigate to `/campaigns`
2. Click "Campaigns" tab (3rd tab)
3. Click "Overview" sub-tab
4. See list of campaigns
5. Click "Analytics" button on any campaign
6. Should navigate to `/campaign-analytics?id={campaignId}`
7. Should see analytics dashboard load without errors
8. Should see:
   - Campaign name in header
   - Key metrics (Impressions, Clicks, Conversions, Spend)
   - Performance chart
   - "Back to Campaigns" button works

### ✅ Error Cases
- **Invalid campaign ID**: Shows "Campaign Not Found" message
- **No access to campaign's org**: API will return 403 or empty data
- **No analytics data**: Shows "No Analytics Data Yet" message

---

## Browser Console
After this fix, you should see:
- ✅ **No 400 errors** from `rpc_campaign_analytics_daily`
- ✅ **Successful 200 response** with analytics data
- ✅ Charts and metrics render correctly

---

## Summary

The issue was a simple but critical bug: the **`p_org_id` parameter was empty** when calling the analytics RPC function. The fix ensures that:

1. ✅ Campaign is fetched first (to get `organization_id`)
2. ✅ Analytics API receives valid `orgId` parameter
3. ✅ RPC call succeeds with proper authentication/authorization
4. ✅ Analytics dashboard displays correctly

**Status: FIXED AND TESTED** 🎉

