# Campaign Analytics Requirements Checklist

## ✅ What Your Campaign Needs for Analytics to Work

For the standalone Campaign Analytics page (`/campaign-analytics?id=xxx`) to show data, your campaign must meet these requirements:

---

## 1. Campaign Configuration ✅

### Basic Settings (Already Complete)
- ✅ **Status**: Active
- ✅ **Organization ID**: Set
- ✅ **Start Date**: October 26, 2025 (started)
- ✅ **End Date**: October 31, 2025 (not expired)
- ✅ **Budget**: 10,000 credits
- ✅ **Pricing Model**: CPM

---

## 2. Active Creatives ⚠️

### Requirements:
- ✅ At least **1 creative** must exist
- ✅ Creative must have `active = true`
- ✅ Creative must have valid media (image or video)

### Check Your Creatives:
Run the query in `check-campaign-setup.sql` (query #2) to see your creatives.

**Expected Result:**
```json
{
  "id": "...",
  "campaign_id": "3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec",
  "headline": "Your ad headline",
  "media_url": "https://...",
  "active": true  ← MUST be true
}
```

### If No Active Creatives:
Go to Campaign Dashboard → Creatives tab → Set creative to Active

---

## 3. Ad Delivery System ⚠️

### Your Campaign Must Be Eligible for Delivery:

Run query #3 in `check-campaign-setup.sql` to check eligibility:

```sql
-- Quick check
SELECT 
  CASE 
    WHEN status != 'active' THEN '❌ Campaign not active'
    WHEN NOT EXISTS(SELECT 1 FROM ad_creatives WHERE campaign_id = '...' AND active = true) 
      THEN '❌ No active creatives'
    ELSE '✅ Ready for delivery'
  END as status
FROM campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';
```

---

## 4. Ongoing Data Generation 📊

### Current State:
- **Impressions**: 1 (one-time test)
- **Clicks**: 1 (one-time test)
- **Date Range**: Only 1 date has data

### For Rich Analytics (Charts):
You need **multiple dates** with activity:
- Ads shown to users in the feed
- Multiple days of impressions
- At least 2-3 data points for meaningful charts

### How Ads Get Shown:
1. User opens feed (`/` or `/feed`)
2. Ad delivery system picks eligible ads
3. Ad is inserted into feed
4. Impression recorded when user sees it
5. Click recorded when user taps/clicks

---

## 5. Common Issues & Fixes

### Issue 1: "No Analytics Data Yet"
**Cause**: Campaign has 0 impressions/clicks  
**Fix**: 
1. Ensure campaign is active ✅
2. Ensure creative is active ⚠️
3. View feed to trigger ad delivery
4. Check if ads are showing up

### Issue 2: Chart Shows "1 data points"
**Cause**: Only 1 date has activity  
**Fix**: 
- Generate activity on multiple dates
- Test ads over several days
- Or: Wait for real user traffic

### Issue 3: Spend Shows 0 Instead of Actual Amount
**Cause**: Data transformation or timing issue  
**Fix**: Check the RPC function response (see below)

---

## 🧪 Testing Your Campaign

### Step 1: Run the Setup Check
```sql
-- Run this in Supabase SQL Editor
\i check-campaign-setup.sql
```

### Step 2: Check Delivery Eligibility
Look at query #4 results. You should see:
```
✅ Campaign ready for delivery
```

### Step 3: Generate Test Data
1. Open your app in a browser
2. Go to the feed (`/`)
3. Scroll through content
4. Look for your ad
5. Click on your ad if it appears

### Step 4: Verify Analytics
1. Go to `/campaign-analytics?id=3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec`
2. Should see updated numbers
3. Multiple dates = chart will render

---

## 📋 Quick Checklist

Before expecting full analytics:

- [ ] Campaign status = 'active'
- [ ] Start date <= today
- [ ] End date >= today (or null)
- [ ] Budget remaining > 0
- [ ] **At least 1 active creative exists** ⚠️
- [ ] Creative has valid media_url
- [ ] Ad delivery system is running
- [ ] Users are viewing the feed

---

## 🔍 Diagnostic Commands

### Check Everything at Once:
```bash
# In Supabase SQL Editor
\i check-campaign-setup.sql
```

### Check Specific Issues:

**1. Do I have active creatives?**
```sql
SELECT COUNT(*) as active_creatives
FROM ad_creatives
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
  AND active = true;
```
Expected: At least 1

**2. When was my last impression?**
```sql
SELECT MAX(created_at) as last_impression
FROM campaigns.ad_impressions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';
```

**3. How many dates have data?**
```sql
SELECT 
  created_at::date as date,
  COUNT(*) as impressions
FROM campaigns.ad_impressions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
GROUP BY created_at::date
ORDER BY date DESC;
```
Expected: Multiple dates for good charts

---

## ✅ Summary

### Your Analytics Page Works When:
1. ✅ Campaign is properly configured
2. ⚠️ **Active creative exists** (CHECK THIS!)
3. ✅ Campaign is eligible for delivery
4. ⚠️ **Ads are actually being shown** (needs testing)
5. ⚠️ **Multiple dates have activity** (for charts)

### Next Steps:
1. **Run `check-campaign-setup.sql`** to see current state
2. **Ensure creative is active** (most common issue)
3. **Test ad delivery** by viewing the feed
4. **Generate multi-day data** for better analytics

---

## 🎯 The Goal

Once everything is set up correctly:

```
User clicks "Analytics" button on campaign card
↓
Navigate to /campaign-analytics?id={campaignId}
↓
See full analytics dashboard:
  • Impressions, Clicks, CTR, Spend
  • Performance chart over time
  • Campaign breakdown
```

**No errors, no "No Analytics Data Yet" - just clean analytics!** 🚀

Run the setup check SQL file and share the results!

