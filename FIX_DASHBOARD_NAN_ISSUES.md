# Dashboard Issues & Fixes

## 🔴 Issues Identified

### 1. **Spend Shows 1 Credit Instead of 0.5**
**Problem:** Materialized view might not be refreshed, or there's data inconsistency.

**Fix:** Run in Supabase SQL Editor:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY public.analytics_campaign_daily_mv;
```

**Verify:**
```sql
SELECT spend_credits FROM public.analytics_campaign_daily_mv
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';
-- Should show 0.5, not 1
```

---

### 2. **NaN Values (Revenue, ROAS, CPC)**
**Problem:** Division by zero when no conversions or revenue exists.

**Where:** Frontend calculations need null checks.

**Fix:** Update dashboard components to handle missing data:

```typescript
// In MetricsBar.tsx or wherever these are calculated
const revenue = conversions > 0 ? totalRevenue : 0;
const roas = spend > 0 && revenue > 0 ? revenue / spend : 0;
const cpc = clicks > 0 ? spend / clicks : 0;

// Display as:
{revenue > 0 ? `$${revenue.toFixed(2)}` : '$0.00'}
{roas > 0 ? `${roas.toFixed(2)}x` : '0.00x'}
{cpc > 0 ? cpc.toFixed(2) : '0.00'}
```

---

### 3. **Dwell Time: 0 ms**
**Problem:** Frontend might not be tracking dwell time properly.

**Check:** Is `dwell_ms` being sent to the RPC?

**Debug Query:**
```sql
SELECT 
  id,
  viewable,
  pct_visible,
  dwell_ms,  -- Should be > 0
  created_at
FROM campaigns.ad_impressions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY created_at DESC;
```

**Expected:** `dwell_ms` should be ≥ 1000 (1 second) for viewable impressions.

**If 0:** The `useImpressionTracker` hook needs to properly calculate and send dwell time.

---

### 4. **Attribution Mix: No Data**
**Status:** ✅ Expected - No conversions yet.

This is normal. Attribution data requires:
- Ticket purchases or other conversions
- Linking conversions to impressions/clicks
- Data in `campaigns.ad_conversions` table

**How to populate:**
When a user buys a ticket after clicking an ad, insert:
```sql
INSERT INTO campaigns.ad_conversions (
  campaign_id,
  impression_id,
  click_id,
  conversion_type,
  conversion_value,
  occurred_at
) VALUES (
  '3a51d5c9-...',
  'impression-uuid',
  'click-uuid',
  'ticket_purchase',
  50.00, -- ticket price
  NOW()
);
```

---

### 5. **Budget Progress Bar: 0%**
**Problem:** 0.5 / 10,000 = 0.005%, which rounds to 0%.

**Fix:** Show more precision or minimum 1px for visual feedback:
```typescript
const progress = (spent / budget) * 100;
const displayProgress = progress > 0 && progress < 0.01 
  ? 0.01 // Show at least 0.01%
  : progress;
```

---

## 🔧 Quick Fixes

### Fix 1: Refresh Materialized View
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY public.analytics_campaign_daily_mv;
```

### Fix 2: Check Data Consistency
Run `fix-dashboard-issues.sql` to verify:
- Campaign spend (should be 0.5)
- Materialized view spend
- Impression dwell times

### Fix 3: Frontend NaN Handling
Update analytics components to use fallback values:
- Revenue: `$0.00` instead of `$NaN`
- ROAS: `0.00x` instead of `NaN x`
- CPC: `0.00` instead of `NaN`

### Fix 4: Dwell Time Investigation
Check if impressions table has `dwell_ms > 0`:
- If YES: Viewability calculation needs updating
- If NO: Frontend tracking needs fixing

---

## 📊 Expected Values After Fixes

### Summary Cards:
```
Impressions: 1
Clicks: 1 (100.00% CTR)
Conversions: 0
Spend: 0.5 credits (eCPM 500.00, CPC 0.50)
Revenue: $0.00 (ROAS 0.00x)
```

### Budget Pacing:
```
0.5 / 10,000 credits (0.005%)
9,999.5 credits remaining
```

### Viewability:
```
Avg % Visible: 100.0%
Avg Dwell: [should be ~1000ms, not 0]
Viewability Rate: 100.0%
```

---

## 🎯 Priority Order

1. **HIGH:** Fix spend showing 1 instead of 0.5 (refresh matview)
2. **HIGH:** Fix NaN values (frontend null checks)
3. **MEDIUM:** Fix dwell time tracking (check frontend/RPC)
4. **LOW:** Improve progress bar precision
5. **INFO:** Attribution data (expected to be empty)

---

## 🧪 Testing Steps

1. **Refresh matview** → Reload dashboard → Spend should show 0.5
2. **Add null checks** → NaN should become 0.00
3. **Check dwell tracking** → Should see >0ms in viewability
4. **Generate 2nd impression** → Spend should become 1.0
5. **Click ad again** → CTR should update, CPC should calculate

---

## ✅ When Fixed

Dashboard should show:
- ✅ Accurate spend (0.5 credits)
- ✅ No NaN values (use 0 as fallback)
- ✅ Proper dwell time (>0ms if tracked)
- ✅ Clean, professional UI
- ✅ Accurate calculations





