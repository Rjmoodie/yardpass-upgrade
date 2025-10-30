# ========================================
# Deploy Reconciliation System
# ========================================

Write-Host "🔄 Deploying Reconciliation System..." -ForegroundColor Cyan
Write-Host ""

# Deploy migration
Write-Host "📊 Creating reconciliation tables and functions..." -ForegroundColor Yellow
npx supabase@latest db push

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Reconciliation system deployed!" -ForegroundColor Green
} else {
    Write-Host "❌ Error deploying reconciliation system" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔍 Testing: Finding missing charges..." -ForegroundColor Yellow
npx supabase@latest db query --command "SELECT * FROM campaigns.find_missing_charges('3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec', 7);"

Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review missing charges above" -ForegroundColor White
Write-Host "  2. Test with dry run: SELECT * FROM campaigns.reconcile_missing_charges(campaign_id, 7, TRUE);" -ForegroundColor White
Write-Host "  3. Apply fixes: SELECT * FROM campaigns.reconcile_missing_charges(campaign_id, 7, FALSE);" -ForegroundColor White
Write-Host "  4. Set up cron job for automatic reconciliation" -ForegroundColor White
Write-Host ""

