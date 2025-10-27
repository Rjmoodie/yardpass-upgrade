# 🚀 Complete Ad System Deployment Commands

Run these commands in order to deploy the complete ad tracking and billing system.

## Option 1: Run the Deployment Script (Recommended)

### Windows PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File deploy-complete-ad-system.ps1
```

### Linux/Mac:
```bash
bash deploy-complete-ad-system.sh
```

---

## Option 2: Run Commands Manually

### Step 1: Deploy Core Billing Migrations

```bash
psql "postgresql://postgres:Louisonthego12@db.yieslxnrfeqchbcmgavz.supabase.co:5432/postgres" -f "supabase/migrations/20251026160000_fix_impression_dedup_handling.sql"
```

```bash
psql "postgresql://postgres:Louisonthego12@db.yieslxnrfeqchbcmgavz.supabase.co:5432/postgres" -f "supabase/migrations/20251026170000_add_wallet_to_ledger.sql"
```

```bash
psql "postgresql://postgres:Louisonthego12@db.yieslxnrfeqchbcmgavz.supabase.co:5432/postgres" -f "supabase/migrations/20251026180000_make_wallet_id_nullable.sql"
```

### Step 2: Update Campaign Pricing

```bash
psql "postgresql://postgres:Louisonthego12@db.yieslxnrfeqchbcmgavz.supabase.co:5432/postgres" -f "update-campaign-pricing-correct.sql"
```

### Step 3: Deploy Analytics Functions

```bash
psql "postgresql://postgres:Louisonthego12@db.yieslxnrfeqchbcmgavz.supabase.co:5432/postgres" -f "drop-old-analytics-functions.sql"
```

```bash
psql "postgresql://postgres:Louisonthego12@db.yieslxnrfeqchbcmgavz.supabase.co:5432/postgres" -f "supabase/migrations/20251026190000_create_analytics_rpcs.sql"
```

---

## ✅ After Deployment

1. **Hard refresh your browser**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

2. **Test impression tracking**: 
   - Open the feed
   - Scroll to a promoted ad
   - Check console for `[AD TRACKING] ✅ Impression logged`

3. **Test click tracking**:
   - Click "Learn More" on a promoted ad
   - Check console for `[AD TRACKING] ✅ Click logged`

4. **Check Campaign Manager**:
   - Navigate to Campaign Manager tab
   - Should see analytics charts (no 404 errors)

5. **Verify billing**:
```bash
psql "postgresql://postgres:Louisonthego12@db.yieslxnrfeqchbcmgavz.supabase.co:5432/postgres" -f "check-ad-accounting.sql"
```

---

## 📊 What Was Deployed

### ✅ Ad Tracking System
- Impression tracking with deduplication
- Click tracking with attribution
- Session-based frequency capping

### ✅ Billing System
- **CPM**: $5.00 per 1,000 impressions (500 credits)
- **Cost per impression**: 0.5 credits
- **10,000 credits delivers**: ~20,000 impressions
- Fractional accrual (charges when ≥1 credit)
- Wallet integration
- Audit ledger

### ✅ Analytics Dashboard
- Daily campaign metrics
- Creative performance rollup
- Impressions, clicks, conversions
- Spend tracking
- CTR calculations

---

## 🔍 Troubleshooting

If analytics still shows 404:
```bash
psql "postgresql://postgres:Louisonthego12@db.yieslxnrfeqchbcmgavz.supabase.co:5432/postgres" -c "\df public.rpc_*analytics*"
```

Should show:
- `rpc_campaign_analytics_daily`
- `rpc_creative_analytics_rollup`
- `rpc_creative_analytics_daily`

If billing shows 0 credits charged:
- Need ~500 impressions to accumulate 1 credit
- Check `spend_accrual` column - should show fractional credits (e.g., 0.004)

---

## 📝 Summary

**Total Migrations**: 4  
**Total Scripts**: 3  
**Pricing**: $5 CPM (500 credits per 1,000 impressions)  
**Status**: Production Ready ✅

