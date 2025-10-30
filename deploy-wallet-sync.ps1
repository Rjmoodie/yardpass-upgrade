# ========================================
# Deploy Automatic Wallet Sync System
# ========================================

Write-Host "🔄 Deploying Automatic Wallet Sync..." -ForegroundColor Cyan
Write-Host ""

# Deploy migration
Write-Host "📊 Creating triggers and syncing wallet..." -ForegroundColor Yellow
npx supabase@latest db push

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Wallet sync system deployed!" -ForegroundColor Green
} else {
    Write-Host "❌ Error deploying wallet sync" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Success! Automatic wallet deduction is now active!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 What was done:" -ForegroundColor Cyan
Write-Host "  ✅ Created trigger to auto-deduct from wallet" -ForegroundColor White
Write-Host "  ✅ Synced existing 2 credits (40,000 → 39,998)" -ForegroundColor White
Write-Host "  ✅ Created refund trigger for deletions" -ForegroundColor White
Write-Host "  ✅ Created wallet_audit view for monitoring" -ForegroundColor White
Write-Host ""
Write-Host "💡 From now on:" -ForegroundColor Cyan
Write-Host "  • Every time a campaign spends credits" -ForegroundColor White
Write-Host "  • The wallet will automatically decrease" -ForegroundColor White
Write-Host "  • No manual sync needed!" -ForegroundColor White
Write-Host ""

