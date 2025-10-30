# ==========================================
# Deploy AI Recommendations System
# ==========================================
# PowerShell script to deploy all AI recommendation components

Write-Host "🚀 Deploying AI Recommendations System..." -ForegroundColor Cyan
Write-Host ""

# 1. Apply SQL Migration
Write-Host "📦 Step 1/2: Applying SQL migration..." -ForegroundColor Yellow
supabase db push

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Migration failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Migration applied successfully" -ForegroundColor Green
Write-Host ""

# 2. Deploy Edge Function
Write-Host "🔧 Step 2/2: Deploying edge function..." -ForegroundColor Yellow
supabase functions deploy ai-recommend --no-verify-jwt

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Edge function deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Edge function deployed successfully" -ForegroundColor Green
Write-Host ""

# Success!
Write-Host "🎉 AI Recommendations System deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Refresh your dev server (if running)" -ForegroundColor White
Write-Host "  2. Visit /campaign-analytics?id={campaignId}" -ForegroundColor White
Write-Host "  3. See AI recommendations appear automatically!" -ForegroundColor White
Write-Host ""

