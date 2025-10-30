# 🔄 Reconciliation System Guide

## Overview

The reconciliation system automatically detects and fixes missing charges for delivered ads. It ensures that every impression and click is properly billed, preventing revenue loss.

---

## 🎯 **What It Does**

### Automatic Detection
- Scans for impressions delivered but not charged
- Scans for clicks delivered but not charged
- Calculates what should have been charged
- Identifies campaigns with billing issues

### Automatic Fixes
- Creates missing ledger entries
- Updates campaign `spent_credits`
- Logs all reconciliations
- Refreshes analytics views

### Monitoring
- Tracks reconciliation history
- Alerts for frequent issues
- Provides detailed reports

---

## 🚀 **Quick Start**

### 1. Deploy the System

```bash
# Deploy reconciliation migration
./deploy-reconciliation.ps1
```

### 2. Test with Your Campaign

```sql
-- Find missing charges (read-only)
SELECT * FROM campaigns.find_missing_charges(
  '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec',
  7
);
```

### 3. Run Reconciliation

```sql
-- Dry run first (no changes)
SELECT * FROM campaigns.reconcile_missing_charges(
  '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec',
  7,
  TRUE  -- dry run
);

-- Apply fixes
SELECT * FROM campaigns.reconcile_missing_charges(
  '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec',
  7,
  FALSE  -- for real
);
```

---

## ⚙️ **How It Works**

### Detection Algorithm

```
FOR each campaign:
  FOR each day in lookback window:
    
    -- Count delivered impressions
    delivered_impressions = COUNT(*) FROM ad_impressions
    
    -- Count charged impressions
    charged_impressions = SUM(quantity) FROM ad_spend_ledger 
                         WHERE metric_type = 'impression'
    
    -- Calculate missing
    missing = delivered_impressions - charged_impressions
    
    IF missing > 0:
      should_charge = missing * campaign.cpm_credits / 1000
      
      -- Add to fix list
      missing_charges.add({
        campaign_id,
        day,
        missing_count: missing,
        should_charge_credits: should_charge
      })
```

### Safety Features

1. **5-Minute Buffer**: Only processes events older than 5 minutes to avoid race conditions with normal charging
2. **Dry Run Mode**: Test before applying changes
3. **Detailed Logging**: Every reconciliation is logged with full details
4. **Idempotent**: Safe to run multiple times (won't double-charge)

---

## 📊 **Database Schema**

### `campaigns.reconciliation_log`
```sql
CREATE TABLE campaigns.reconciliation_log (
  id UUID PRIMARY KEY,
  campaign_id UUID,
  reconciliation_date TIMESTAMPTZ,
  missing_impressions INT,
  missing_clicks INT,
  credits_charged NUMERIC,
  ledger_entries_created INT,
  notes TEXT,
  details JSONB,
  created_at TIMESTAMPTZ
);
```

### Functions

| Function | Purpose | Usage |
|----------|---------|-------|
| `find_missing_charges` | Detect missing charges | Read-only analysis |
| `reconcile_missing_charges` | Apply fixes | Run manually or via cron |
| `trigger_campaign_reconciliation` | UI-friendly wrapper | Called from frontend |

---

## 🔄 **Automatic Scheduling**

### Option 1: Supabase Cron (Recommended)

```sql
-- Run every hour for all campaigns
SELECT cron.schedule(
  'reconcile-ad-charges',
  '0 * * * *',  -- Every hour at :00
  $$SELECT campaigns.reconcile_missing_charges(NULL, 7, FALSE)$$
);

-- View scheduled jobs
SELECT * FROM cron.job;

-- Unschedule if needed
SELECT cron.unschedule('reconcile-ad-charges');
```

### Option 2: Edge Function + Scheduler

```typescript
// supabase/functions/reconcile-charges/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await supabase.rpc('reconcile_missing_charges', {
    p_campaign_id: null,  // All campaigns
    p_lookback_days: 7,
    p_dry_run: false
  });

  if (error) {
    console.error('Reconciliation error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ success: true, data }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

Then schedule via Supabase Dashboard → Edge Functions → Cron Triggers

---

## 📈 **Monitoring & Reporting**

### View Recent Reconciliations

```sql
SELECT * FROM public.reconciliation_summary
ORDER BY reconciliation_date DESC
LIMIT 20;
```

### Total Recovered Credits

```sql
SELECT 
  campaign_name,
  SUM(credits_charged) AS total_recovered,
  SUM(missing_impressions) AS total_missing_impressions,
  COUNT(*) AS reconciliation_runs
FROM public.reconciliation_summary
WHERE reconciliation_date >= NOW() - INTERVAL '30 days'
GROUP BY campaign_name
ORDER BY total_recovered DESC;
```

### Campaigns with Frequent Issues (Possible Bugs)

```sql
SELECT 
  campaign_id,
  campaign_name,
  COUNT(*) AS reconciliation_count,
  AVG(missing_impressions) AS avg_missing_per_run,
  SUM(credits_charged) AS total_recovered
FROM public.reconciliation_summary
WHERE reconciliation_date >= NOW() - INTERVAL '7 days'
GROUP BY campaign_id, campaign_name
HAVING COUNT(*) > 5  -- More than 5 reconciliations in a week = problem
ORDER BY reconciliation_count DESC;
```

---

## 🎨 **Frontend Integration**

### Add Reconciliation Button to Campaign Dashboard

```typescript
import { ReconciliationButton } from '@/components/campaigns/ReconciliationButton';

// In your Campaign Dashboard or Analytics page
<ReconciliationButton 
  campaignId={campaignId}
  onComplete={() => {
    // Refresh campaign data
    refetchCampaign();
    refetchAnalytics();
  }}
/>
```

### Display Reconciliation History

```typescript
const { data: reconciliations } = useQuery({
  queryKey: ['reconciliation-history', campaignId],
  queryFn: async () => {
    const { data } = await supabase
      .from('reconciliation_summary')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('reconciliation_date', { ascending: false })
      .limit(10);
    return data;
  }
});

// Display in UI
{reconciliations?.map(r => (
  <div key={r.id}>
    <p>{r.reconciliation_date}: 
       Fixed {r.missing_impressions} impressions, 
       charged {r.credits_charged} credits
    </p>
  </div>
))}
```

---

## 🚨 **Alerts & Notifications**

### Email Alert for Large Discrepancies

```sql
-- Create notification function
CREATE OR REPLACE FUNCTION campaigns.notify_large_reconciliation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If more than 100 impressions missing, alert
  IF NEW.missing_impressions > 100 THEN
    -- Insert into notifications table or call external service
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type
    )
    SELECT 
      om.user_id,
      'Large Reconciliation Required',
      format('Campaign "%s" had %s missing impressions charged retroactively.',
             c.name, NEW.missing_impressions),
      'warning'
    FROM campaigns.campaigns c
    JOIN public.org_memberships om ON om.org_id = c.org_id
    WHERE c.id = NEW.campaign_id
      AND om.role IN ('owner', 'admin');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_large_reconciliation
AFTER INSERT ON campaigns.reconciliation_log
FOR EACH ROW
EXECUTE FUNCTION campaigns.notify_large_reconciliation();
```

---

## 🧪 **Testing**

### Test Scenario: Missing Oct 28 Charge

```sql
-- 1. Verify the issue exists
SELECT * FROM campaigns.find_missing_charges(
  '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec',
  7
);
-- Expected: Shows 1 missing impression on Oct 28

-- 2. Dry run
SELECT * FROM campaigns.reconcile_missing_charges(
  '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec',
  7,
  TRUE
);
-- Expected: Shows what would be fixed (0.50 credits)

-- 3. Apply fix
SELECT * FROM campaigns.reconcile_missing_charges(
  '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec',
  7,
  FALSE
);
-- Expected: Creates ledger entry, updates spent_credits

-- 4. Verify fix
SELECT * FROM campaigns.find_missing_charges(
  '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec',
  7
);
-- Expected: No missing charges

-- 5. Check reconciliation log
SELECT * FROM public.reconciliation_summary
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY reconciliation_date DESC
LIMIT 1;
-- Expected: Shows 1 missing impression, 0.50 credits charged
```

---

## 🔧 **Troubleshooting**

### Issue: Reconciliation Not Finding Missing Charges

**Possible Causes:**
1. Events are too recent (< 5 minutes old)
2. Charges already exist in ledger
3. Campaign CPM is 0 or NULL

**Solution:**
```sql
-- Check campaign bidding settings
SELECT id, name, bidding FROM campaigns.campaigns
WHERE id = 'your-campaign-id';

-- Manually check for missing charges
SELECT 
  DATE(created_at) AS day,
  COUNT(*) AS delivered
FROM campaigns.ad_impressions
WHERE campaign_id = 'your-campaign-id'
GROUP BY DATE(created_at);

SELECT 
  DATE(occurred_at) AS day,
  SUM(quantity) AS charged
FROM campaigns.ad_spend_ledger
WHERE campaign_id = 'your-campaign-id'
  AND metric_type = 'impression'
GROUP BY DATE(occurred_at);
```

### Issue: Reconciliation Runs But Doesn't Fix

**Check:**
```sql
-- Verify function has correct permissions
SELECT has_function_privilege('campaigns.reconcile_missing_charges(uuid, integer, boolean)', 'execute');

-- Check for transaction locks
SELECT * FROM pg_locks 
WHERE relation = 'campaigns.ad_spend_ledger'::regclass;
```

---

## 📝 **Best Practices**

1. **Always Dry Run First**: Test with `p_dry_run = TRUE` before applying changes
2. **Monitor Logs**: Check `reconciliation_log` regularly for patterns
3. **Set Alerts**: Notify admins for large discrepancies
4. **Run Hourly**: Schedule automatic reconciliation every hour
5. **Investigate Root Causes**: If reconciliation runs frequently, fix the underlying issue

---

## 🎓 **Real-World Example**

### Your Oct 28 Missing Charge

**Problem:**
- Oct 28: 1 impression delivered, 0 credits charged

**Detection:**
```sql
SELECT * FROM campaigns.find_missing_charges('3a51d5c9...', 7);
-- Result: 1 missing impression, should charge 0.50 credits
```

**Fix:**
```sql
SELECT * FROM campaigns.reconcile_missing_charges('3a51d5c9...', 7, FALSE);
-- Result: Created ledger entry, charged 0.50 credits
```

**Outcome:**
- Budget: 11 → 11.50 credits
- Spend: 1.00 → 1.50 credits
- Oct 28 now shows 0.50 credit spend in analytics

---

## ✅ **Summary**

The reconciliation system:
- ✅ Automatically detects missing charges
- ✅ Fixes billing discrepancies
- ✅ Prevents revenue loss
- ✅ Provides detailed audit logs
- ✅ Alerts for unusual patterns
- ✅ Can be run manually or automatically

**Recommended Setup:**
1. Deploy migration
2. Test with dry run
3. Set up hourly cron job
4. Add monitoring dashboard
5. Configure alerts for large discrepancies

---

## 📚 **Files Created**

1. `supabase/migrations/20250131000000_reconciliation_jobs.sql` - Database schema
2. `src/components/campaigns/ReconciliationButton.tsx` - UI component
3. `deploy-reconciliation.ps1` - Deployment script
4. `RECONCILIATION_SYSTEM_GUIDE.md` - This guide

