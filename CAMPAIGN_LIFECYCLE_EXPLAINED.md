# 📋 Campaign Lifecycle - What Happens When Campaigns Stop

## 🎯 Campaign Status Flow

```
draft → scheduled → active → paused → completed/archived
                        ↓
                     ended (budget exhausted or end_date reached)
```

---

## 🔍 How Ad Serving Works

### `get_eligible_ads` Function Filtering

Every time the system needs to show an ad, it queries `get_eligible_ads()`, which filters campaigns by:

```sql
WHERE 
  c.status::text = 'active'  -- ✅ ONLY active campaigns
  AND c.start_date <= now()  -- ✅ Campaign has started
  AND (c.end_date IS NULL OR c.end_date >= now())  -- ✅ Campaign hasn't ended
  AND (c.total_budget_credits - COALESCE(c.spent_credits, 0)) > 0  -- ✅ Has budget
```

**Location**: `supabase/migrations/20251026112158_fix_get_eligible_ads_direct_uploads.sql:63-66`

---

## ⏸️ What Happens When You **Pause** a Campaign

### Immediate Effects:
1. ✅ **Ads stop serving instantly** (status changes to `paused`)
2. ✅ `get_eligible_ads` excludes it (only returns `active` campaigns)
3. ✅ No new impressions, clicks, or spend
4. ✅ Analytics data preserved (all historical data remains)
5. ✅ Budget preserved (spent + remaining = total)
6. ✅ AI recommendations **still work** (analyzes historical data)

### What's Preserved:
```typescript
✅ Campaign data (name, description, targeting, etc.)
✅ All creatives (ad content, media, CTAs)
✅ Historical analytics (impressions, clicks, conversions)
✅ Spent credits (locked in)
✅ Remaining budget (available when resumed)
✅ Telemetry data (AI recommendation history)
```

### Resume Campaign:
```typescript
// Simply change status back to 'active'
UPDATE campaigns.campaigns 
SET status = 'active', updated_at = now()
WHERE id = 'campaign-id';

// Ads start serving again immediately ✅
```

---

## 🛑 What Happens When Campaign **Ends**

### Three Ways Campaigns End:

#### 1. **Manual End** (User stops campaign)
```typescript
// User clicks "End Campaign" button
UPDATE campaigns.campaigns 
SET status = 'completed', updated_at = now()
WHERE id = 'campaign-id';
```

#### 2. **End Date Reached** (Time-based)
```typescript
// Campaign reaches end_date
// System AUTOMATICALLY filters it out via query:
c.end_date IS NULL OR c.end_date >= now()

// ⚠️ Note: Status does NOT auto-update to 'completed'
// It stays 'active' but stops serving due to date check
```

**Current Behavior**: 
- ❌ Status stays `active` after end date
- ✅ Ads stop serving (date filter catches it)
- ⚠️ **Recommendation**: Add cron job to auto-mark as `completed`

#### 3. **Budget Exhausted** (Spend-based)
```typescript
// Campaign runs out of credits
// System AUTOMATICALLY filters it out via query:
(c.total_budget_credits - c.spent_credits) > 0

// ⚠️ Note: Status does NOT auto-update to 'completed'
// It stays 'active' but stops serving due to budget check
```

**Current Behavior**:
- ❌ Status stays `active` after budget exhausted
- ✅ Ads stop serving (budget filter catches it)
- ⚠️ **Recommendation**: Add trigger to auto-mark as `completed`

---

## 📊 What Happens to Data

### Analytics (Preserved Forever):
```sql
-- All data in analytics.campaign_daily remains
SELECT * FROM public.analytics_campaign_daily 
WHERE campaign_id = 'ended-campaign-id';
-- ✅ Returns all historical data

-- AI can still analyze ended campaigns
SELECT * FROM public.category_benchmarks;
-- ✅ Includes data from ended campaigns
```

### AI Recommendations:
- ✅ **Still Generated** (analyzes past performance)
- ❌ **Can't Apply** (no active campaign to modify)
- ✅ **Useful for Future Campaigns** (learn from past)

### Billing & Spent Credits:
```sql
-- Final spend is locked in
SELECT 
  total_budget_credits,
  spent_credits,
  (total_budget_credits - spent_credits) AS unused_credits
FROM campaigns.campaigns 
WHERE id = 'ended-campaign-id';
```

**What You Pay**:
- ✅ Only `spent_credits` (actual usage)
- ✅ `unused_credits` are **NOT charged**
- ✅ Refunds happen automatically (unused budget)

---

## 🔄 Current Limitations & Recommendations

### ⚠️ Limitation 1: No Auto-Status Updates

**Problem**: Campaigns stay `active` even after:
- End date reached
- Budget exhausted

**Why It Works**: Query filters catch them (`end_date` and `budget` checks)

**Why It's Not Ideal**:
- ❌ Dashboard shows misleading status
- ❌ Users think campaign is still running
- ❌ AI might suggest changes to "active" but ended campaigns

**Recommended Fix**:

```sql
-- Add cron job (runs daily)
CREATE OR REPLACE FUNCTION campaigns.auto_complete_campaigns()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Mark campaigns as completed if:
  -- 1. End date passed
  -- 2. Budget exhausted
  UPDATE campaigns.campaigns
  SET 
    status = 'completed',
    updated_at = now()
  WHERE status = 'active'
    AND (
      -- End date reached
      (end_date IS NOT NULL AND end_date < now())
      OR
      -- Budget exhausted
      (spent_credits >= total_budget_credits)
    );
END;
$$;

-- Schedule it (requires pg_cron extension)
SELECT cron.schedule(
  'auto-complete-campaigns',
  '0 * * * *',  -- Every hour
  'SELECT campaigns.auto_complete_campaigns();'
);
```

### ⚠️ Limitation 2: No Pause Notifications

**Recommended**: Add notifications when:
- Campaign auto-completes (end date/budget)
- Campaign performance drops significantly
- AI detects optimization opportunities

---

## 🎯 Best Practices for Campaign Management

### 1. **Monitor Pacing**
```typescript
// Check if campaign will exhaust budget before end date
const daysRemaining = differenceInDays(campaign.end_date, new Date());
const spendRate = campaign.spent_credits / daysSinceStart;
const projectedSpend = spendRate * totalDays;

if (projectedSpend > campaign.total_budget_credits) {
  // ⚠️ Campaign will run out of budget early
  // Recommend: Increase budget or reduce CPM
}
```

### 2. **Set Realistic End Dates**
```typescript
// Bad: No end date (runs forever until budget exhausted)
end_date: null

// Good: Specific campaign duration
end_date: addDays(start_date, 30)  // 30-day campaign
```

### 3. **Pause vs. Complete**
- **Pause**: Temporary stop (resume later)
  - Testing different creatives
  - Adjusting targeting
  - Budget reallocation

- **Complete**: Permanent end
  - Campaign goals achieved
  - Event has passed
  - ROI analysis needed

---

## 📱 UI Behavior

### Campaign Dashboard Shows:

#### **Active Campaign:**
```
🟢 Active
Budget: 8,500 / 10,000 credits (85% spent)
Pacing: On Track
[Pause] [View Analytics] [Edit]
```

#### **Paused Campaign:**
```
⏸️ Paused
Budget: 5,200 / 10,000 credits (52% spent)
Last Active: 2 days ago
[Resume] [View Analytics] [End Campaign]
```

#### **Completed Campaign:**
```
✅ Completed
Budget: 10,000 / 10,000 credits (100% spent)
Ended: Jan 28, 2025
[View Analytics] [Duplicate] [Archive]
```

---

## 🧪 Testing Campaign Lifecycle

### Test Pause:
```sql
-- 1. Pause campaign
UPDATE campaigns.campaigns SET status = 'paused' WHERE id = 'test-id';

-- 2. Check ads stopped
SELECT * FROM public.get_eligible_ads(NULL, NULL, NULL, NULL, 'feed', 10);
-- ✅ Paused campaign should NOT appear

-- 3. Resume campaign
UPDATE campaigns.campaigns SET status = 'active' WHERE id = 'test-id';

-- 4. Check ads resumed
SELECT * FROM public.get_eligible_ads(NULL, NULL, NULL, NULL, 'feed', 10);
-- ✅ Campaign should appear again
```

### Test Budget Exhaustion:
```sql
-- 1. Exhaust budget
UPDATE campaigns.campaigns 
SET spent_credits = total_budget_credits 
WHERE id = 'test-id';

-- 2. Check ads stopped
SELECT * FROM public.get_eligible_ads(NULL, NULL, NULL, NULL, 'feed', 10);
-- ✅ Campaign should NOT appear (budget filter)
```

### Test End Date:
```sql
-- 1. Set end date to past
UPDATE campaigns.campaigns 
SET end_date = now() - interval '1 day'
WHERE id = 'test-id';

-- 2. Check ads stopped
SELECT * FROM public.get_eligible_ads(NULL, NULL, NULL, NULL, 'feed', 10);
-- ✅ Campaign should NOT appear (date filter)
```

---

## ✅ Summary

### When Campaign Pauses:
| Effect | Happens? |
|--------|----------|
| Ads stop serving | ✅ Immediate |
| Analytics preserved | ✅ Yes |
| Budget preserved | ✅ Yes |
| Can resume | ✅ Yes |
| AI recommendations | ✅ Still work |

### When Campaign Ends:
| Effect | Happens? |
|--------|----------|
| Ads stop serving | ✅ Immediate |
| Status auto-updates | ❌ No (manual or needs cron) |
| Data preserved | ✅ Forever |
| Refund unused budget | ✅ Automatic |
| Can reactivate | ❌ No (duplicate instead) |

---

## 🚀 Next Steps

1. **Add auto-complete cron job** (mark ended campaigns)
2. **Add pause/end notifications** (alert organizers)
3. **Add "Resume Campaign" UI** (one-click reactivation)
4. **Add "Duplicate Campaign" UI** (reuse successful campaigns)

---

**Questions?** Let me know if you want me to implement any of these improvements! 🎯

