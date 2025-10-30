# ========================================
# Deploy Data Discrepancy Fixes
# ========================================
# This script applies both SQL fixes to resolve data discrepancies

Write-Host "🔧 Deploying Data Discrepancy Fixes..." -ForegroundColor Cyan
Write-Host ""

# Fix 1: campaigns_overview stale data
Write-Host "📊 Fix 1: Updating campaigns_overview view..." -ForegroundColor Yellow
npx supabase@latest db query --file fix-campaigns-overview-spent.sql

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ campaigns_overview fixed!" -ForegroundColor Green
} else {
    Write-Host "❌ Error fixing campaigns_overview" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Fix 2: analytics_campaign_daily daily spend calculation
Write-Host "📈 Fix 2: Updating analytics_campaign_daily view..." -ForegroundColor Yellow
npx supabase@latest db query --file fix-analytics-daily-spend.sql

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ analytics_campaign_daily fixed!" -ForegroundColor Green
} else {
    Write-Host "❌ Error fixing analytics_campaign_daily" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Both fixes deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Hard refresh the UI (Ctrl+Shift+R)" -ForegroundColor White
Write-Host "  2. Check Campaign Manager shows 11 credits" -ForegroundColor White
Write-Host "  3. Check Analytics Spend card shows 1.00 credits" -ForegroundColor White
Write-Host ""
Write-Host "📖 Full documentation: DATA_DISCREPANCY_FIXES.md" -ForegroundColor Cyan

