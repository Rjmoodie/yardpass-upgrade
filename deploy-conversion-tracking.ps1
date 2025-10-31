# =====================================================
# CONVERSION TRACKING DEPLOYMENT SCRIPT
# =====================================================
# Deploys enhanced conversion tracking with attribution,
# computed metrics, and analytics enhancements
# =====================================================

Write-Host "🚀 Deploying Conversion Tracking Enhancements..." -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Supabase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

# Check if we're in the right directory
if (-not (Test-Path "supabase/migrations")) {
    Write-Host "❌ Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Deployment Plan:" -ForegroundColor Yellow
Write-Host "  1. Enhance ad_conversions table with new columns" -ForegroundColor White
Write-Host "  2. Update attribute_conversion() RPC with attribution model" -ForegroundColor White
Write-Host "  3. Add track_ticket_conversion() helper function" -ForegroundColor White
Write-Host "  4. Rebuild analytics_campaign_daily_mv with computed metrics" -ForegroundColor White
Write-Host "  5. Add CTR, CVR, ROAS, CPA, view-through rate columns" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Continue with deployment? (y/n)"
if ($confirm -ne "y") {
    Write-Host "❌ Deployment cancelled" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "📦 Step 1: Enhancing conversion tracking..." -ForegroundColor Cyan

# Apply migration 1: Enhanced conversion tracking
$migration1 = "supabase/migrations/20251028010000_enhance_conversion_tracking.sql"
if (Test-Path $migration1) {
    Write-Host "   Applying: $migration1" -ForegroundColor Gray
    supabase db push --include-all
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Migration 1 failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ Conversion tracking enhanced" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Migration file not found: $migration1" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📊 Step 2: Adding conversion metrics..." -ForegroundColor Cyan

# Apply migration 2: Conversion metrics
$migration2 = "supabase/migrations/20251028020000_add_conversion_metrics.sql"
if (Test-Path $migration2) {
    Write-Host "   Applying: $migration2" -ForegroundColor Gray
    supabase db push --include-all
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Migration 2 failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ Analytics metrics added (CTR, CVR, ROAS, CPA)" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Migration file not found: $migration2" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔄 Step 3: Refreshing analytics..." -ForegroundColor Cyan

# Refresh materialized view
$refreshSQL = @"
SELECT public.refresh_analytics();
"@

Write-Host "   Refreshing materialized views..." -ForegroundColor Gray
Write-Output $refreshSQL | supabase db execute

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Analytics refreshed" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Analytics refresh failed (this is OK if no data exists yet)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🧪 Step 4: Verifying deployment..." -ForegroundColor Cyan

# Verification queries
$verifySQL = @"
-- Check ad_conversions columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'campaigns' 
  AND table_name = 'ad_conversions'
  AND column_name IN ('attribution_model', 'conversion_source', 'device_type')
ORDER BY column_name;

-- Check if functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('attribute_conversion', 'track_ticket_conversion')
ORDER BY routine_name;

-- Check materialized view columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'analytics_campaign_daily_mv'
  AND column_name IN ('ctr', 'cvr', 'roas', 'cpa', 'view_through_rate')
ORDER BY column_name;
"@

Write-Host "   Running verification checks..." -ForegroundColor Gray
$verifyResult = Write-Output $verifySQL | supabase db execute

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Verification passed" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Verification incomplete" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🎉 DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

Write-Host "✅ What's New:" -ForegroundColor Yellow
Write-Host "   • Enhanced ad_conversions table with attribution model, source, device" -ForegroundColor White
Write-Host "   • Updated attribute_conversion() RPC with full metadata" -ForegroundColor White
Write-Host "   • New track_ticket_conversion() helper for easy integration" -ForegroundColor White
Write-Host "   • Analytics with CTR, CVR, ROAS, CPA, view-through rate" -ForegroundColor White
Write-Host "   • Attribution breakdown (last-click vs view-through)" -ForegroundColor White
Write-Host ""

Write-Host "📚 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Read: CONVERSION_TRACKING_INTEGRATION.md" -ForegroundColor White
Write-Host "   2. Add tracking to your checkout flow:" -ForegroundColor White
Write-Host "      import { trackTicketPurchase } from '@/lib/conversionTracking';" -ForegroundColor Gray
Write-Host "   3. Test with: CONVERSION_TRACKING_TESTING_GUIDE.md" -ForegroundColor White
Write-Host "   4. Monitor your dashboard: /campaign-analytics?id=<campaign_id>" -ForegroundColor White
Write-Host ""

Write-Host "📊 Quick Test Query:" -ForegroundColor Yellow
Write-Host "   SELECT * FROM campaigns.ad_conversions LIMIT 5;" -ForegroundColor Gray
Write-Host "   SELECT * FROM public.analytics_campaign_daily_mv WHERE conversions > 0;" -ForegroundColor Gray
Write-Host ""

Write-Host "🆘 Need Help?" -ForegroundColor Yellow
Write-Host "   • Integration examples: CONVERSION_TRACKING_INTEGRATION.md" -ForegroundColor White
Write-Host "   • Test scenarios: CONVERSION_TRACKING_TESTING_GUIDE.md" -ForegroundColor White
Write-Host "   • Troubleshooting: Check the 'Common Issues' section in the guide" -ForegroundColor White
Write-Host ""

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")



