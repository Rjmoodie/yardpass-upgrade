# Complete Ad System Deployment Script
# Run this to deploy all migrations and configurations

$DB_URL = "postgresql://postgres:Louisonthego12@db.yieslxnrfeqchbcmgavz.supabase.co:5432/postgres"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "🚀 Deploying Complete Ad System" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "Step 1: Deploy ad tracking & billing migrations..." -ForegroundColor Yellow
psql $DB_URL -f "supabase/migrations/20251026160000_fix_impression_dedup_handling.sql"
psql $DB_URL -f "supabase/migrations/20251026170000_add_wallet_to_ledger.sql"
psql $DB_URL -f "supabase/migrations/20251026180000_make_wallet_id_nullable.sql"

Write-Host ""
Write-Host "Step 2: Update campaign pricing to `$5 CPM..." -ForegroundColor Yellow
psql $DB_URL -f "update-campaign-pricing-correct.sql"

Write-Host ""
Write-Host "Step 3: Deploy analytics functions..." -ForegroundColor Yellow
psql $DB_URL -f "drop-old-analytics-functions.sql"
psql $DB_URL -f "supabase/migrations/20251026190000_create_analytics_rpcs.sql"

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Hard refresh your browser (Ctrl+Shift+R)"
Write-Host "2. Test the feed - ads should track impressions"
Write-Host "3. Click an ad CTA - clicks should be logged"
Write-Host "4. Check Campaign Manager - analytics should display"
Write-Host ""
Write-Host "Verify billing:" -ForegroundColor Cyan
Write-Host "  psql `"$DB_URL`" -f `"check-ad-accounting.sql`""
Write-Host ""

