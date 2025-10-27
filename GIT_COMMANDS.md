# Git Commands to Push Ad System

## Quick Push (Recommended)

```powershell
powershell -ExecutionPolicy Bypass -File git-push-ad-system.ps1
```

---

## Manual Git Commands

### 1. Check Status
```bash
git status
```

### 2. Stage Migration Files
```bash
git add supabase/migrations/20251026160000_fix_impression_dedup_handling.sql
git add supabase/migrations/20251026170000_add_wallet_to_ledger.sql
git add supabase/migrations/20251026180000_make_wallet_id_nullable.sql
git add supabase/migrations/20251026190000_create_analytics_rpcs.sql
```

### 3. Stage Source Code Changes
```bash
git add src/lib/adTracking.ts
git add src/hooks/useImpressionTracker.ts
git add src/features/feed/routes/FeedPageNewDesign.tsx
git add src/components/feed/EventCardNewDesign.tsx
git add src/hooks/unifiedFeedTypes.ts
git add src/features/feed/types/feed.ts
git add supabase/functions/ad-events/index.ts
```

### 4. Stage Deployment Scripts
```bash
git add update-campaign-pricing-correct.sql
git add drop-old-analytics-functions.sql
git add deploy-complete-ad-system.ps1
git add deploy-complete-ad-system.sh
git add DEPLOYMENT_COMMANDS.md
git add GIT_COMMANDS.md
```

### 5. Commit with Detailed Message
```bash
git commit -m "feat: Complete ad tracking and billing system

- Implement impression & click tracking with deduplication
- Add CPM billing with fractional accumulation (0.5 credits per impression)
- Integrate org wallet for automatic charging
- Create analytics RPCs for campaign dashboard
- Update campaign pricing to $5 CPM (500 credits per 1,000 impressions)
- Fix Edge Function CORS and RPC parameter matching
- Add audit ledger for all ad spend

Features:
✅ Real-time impression tracking
✅ Click tracking with attribution
✅ Deduplication (prevents double-charging)
✅ CPM/CPC billing
✅ Wallet integration
✅ Campaign analytics dashboard
✅ Creative performance metrics

Pricing:
- $5 CPM (500 credits per 1,000 impressions)
- 10,000 credits = ~20,000 impressions
- Fractional billing accumulates until ≥1 credit"
```

### 6. Push to Remote
```bash
git push origin main
```

---

## Alternative: Stage All Changes

If you want to commit ALL changes (including test scripts):

```bash
git add -A
git commit -m "feat: Complete ad tracking and billing system"
git push origin main
```

---

## Verify Before Pushing

```bash
# See what will be committed
git diff --staged

# See commit log
git log --oneline -5
```

---

## 📦 What's Being Committed

### Core Migrations (4 files)
- `20251026160000_fix_impression_dedup_handling.sql` - Deduplication with exception handling
- `20251026170000_add_wallet_to_ledger.sql` - Wallet integration for billing
- `20251026180000_make_wallet_id_nullable.sql` - Schema fix for org wallets
- `20251026190000_create_analytics_rpcs.sql` - Analytics dashboard functions

### Frontend Changes (7 files)
- `src/lib/adTracking.ts` - Impression/click tracking logic
- `src/hooks/useImpressionTracker.ts` - Dwell time tracking
- `src/features/feed/routes/FeedPageNewDesign.tsx` - Feed integration
- `src/components/feed/EventCardNewDesign.tsx` - CTA click tracking
- `src/hooks/unifiedFeedTypes.ts` - Type definitions
- `src/features/feed/types/feed.ts` - Feed promotion types
- `supabase/functions/ad-events/index.ts` - Edge Function fixes

### Deployment Scripts (5 files)
- `update-campaign-pricing-correct.sql` - Set $5 CPM pricing
- `drop-old-analytics-functions.sql` - Cleanup script
- `deploy-complete-ad-system.ps1` - Automated deployment
- `deploy-complete-ad-system.sh` - Bash deployment
- `DEPLOYMENT_COMMANDS.md` - Deployment guide

---

## 🎯 After Pushing

The remote repository will have:
- Complete ad tracking system
- Billing with wallet integration
- Analytics dashboard
- Production-ready pricing ($5 CPM)

