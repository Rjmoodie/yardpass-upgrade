#!/usr/bin/env pwsh
# Deploy Campaign Lifecycle Production Updates

Write-Host "🚀 Deploying Campaign Lifecycle Production Updates..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Apply SQL migration
Write-Host "📊 Step 1: Applying SQL migration..." -ForegroundColor Yellow
npx supabase@latest db push

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ SQL migration failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ SQL migration applied successfully!" -ForegroundColor Green
Write-Host ""

# Step 2: Run verification tests
Write-Host "🧪 Step 2: Running verification tests..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Run these SQL queries in Supabase SQL Editor:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Test is_servable() function:" -ForegroundColor White
Write-Host "   SELECT * FROM campaigns.test_is_servable();" -ForegroundColor Gray
Write-Host ""
Write-Host "2. View campaigns with new status:" -ForegroundColor White
Write-Host "   SELECT id, name, status, derived_status, is_servable, not_servable_reasons" -ForegroundColor Gray
Write-Host "   FROM public.campaigns_with_status" -ForegroundColor Gray
Write-Host "   LIMIT 10;" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test charge function (replace UUID with actual campaign):" -ForegroundColor White
Write-Host "   SELECT public.try_charge_campaign('your-campaign-id', 10.0);" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Run reconciler manually:" -ForegroundColor White
Write-Host "   SELECT * FROM campaigns.reconcile_campaign_status();" -ForegroundColor Gray
Write-Host ""

# Step 3: Setup cron job (manual instruction)
Write-Host "⏰ Step 3: Setup Cron Job (Manual)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Go to Supabase Dashboard → Database → Cron Jobs" -ForegroundColor Cyan
Write-Host "Add new job:" -ForegroundColor White
Write-Host "  Name: reconcile-campaign-status" -ForegroundColor Gray
Write-Host "  Schedule: */10 * * * * (every 10 minutes)" -ForegroundColor Gray
Write-Host "  Command: SELECT campaigns.reconcile_campaign_status();" -ForegroundColor Gray
Write-Host ""

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🔍 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run verification tests in Supabase SQL Editor" -ForegroundColor White
Write-Host "  2. Setup cron job for auto-reconciliation" -ForegroundColor White
Write-Host "  3. Update frontend to use campaigns_with_status view" -ForegroundColor White
Write-Host "  4. Test pause/resume functionality" -ForegroundColor White
Write-Host ""

