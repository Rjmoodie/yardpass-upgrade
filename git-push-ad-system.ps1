# Git Commands to Push Complete Ad System

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "📦 Committing Ad System to Git" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Check current git status
Write-Host "`nCurrent git status:" -ForegroundColor Yellow
git status

# Stage all migration files
Write-Host "`nStaging migration files..." -ForegroundColor Yellow
git add supabase/migrations/20251026160000_fix_impression_dedup_handling.sql
git add supabase/migrations/20251026170000_add_wallet_to_ledger.sql
git add supabase/migrations/20251026180000_make_wallet_id_nullable.sql
git add supabase/migrations/20251026190000_create_analytics_rpcs.sql

# Stage modified source files
Write-Host "Staging source code changes..." -ForegroundColor Yellow
git add src/lib/adTracking.ts
git add src/hooks/useImpressionTracker.ts
git add src/features/feed/routes/FeedPageNewDesign.tsx
git add src/components/feed/EventCardNewDesign.tsx
git add src/hooks/unifiedFeedTypes.ts
git add src/features/feed/types/feed.ts
git add supabase/functions/ad-events/index.ts

# Stage deployment scripts
Write-Host "Staging deployment scripts..." -ForegroundColor Yellow
git add update-campaign-pricing-correct.sql
git add drop-old-analytics-functions.sql
git add deploy-complete-ad-system.ps1
git add deploy-complete-ad-system.sh
git add DEPLOYMENT_COMMANDS.md

# Commit everything
Write-Host "`nCommitting changes..." -ForegroundColor Yellow
git commit -m "feat: Complete ad tracking and billing system

- Implement impression & click tracking with deduplication
- Add CPM billing with fractional accumulation (0.5 credits per impression)
- Integrate org wallet for automatic charging
- Create analytics RPCs for campaign dashboard
- Update campaign pricing to \$5 CPM (500 credits per 1,000 impressions)
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
- \$5 CPM (500 credits per 1,000 impressions)
- 10,000 credits = ~20,000 impressions
- Fractional billing accumulates until ≥1 credit"

# Push to remote
Write-Host "`nPushing to remote..." -ForegroundColor Yellow
git push origin main

Write-Host "`n================================================" -ForegroundColor Green
Write-Host "✅ Successfully pushed to Git!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

