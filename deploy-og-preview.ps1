# Deploy OG Preview Edge Function (PowerShell)
# This function provides server-rendered Open Graph meta tags for social media crawlers
# Run this after: npx supabase login

Write-Host "🚀 Deploying OG Preview Edge Function..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Check if logged in
try {
    $null = npx supabase projects list 2>&1
    Write-Host "✅ Authenticated with Supabase" -ForegroundColor Green
} catch {
    Write-Host "❌ Not authenticated with Supabase!" -ForegroundColor Red
    Write-Host "Please run: npx supabase login" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Check if function exists
if (-not (Test-Path "supabase/functions/og-preview")) {
    Write-Host "❌ Error: supabase/functions/og-preview directory not found" -ForegroundColor Red
    Write-Host "   Please ensure the og-preview function exists" -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 Deploying og-preview..." -ForegroundColor Yellow
Write-Host ""

# Deploy the function
# Note: --no-verify-jwt is used because this endpoint is public (for crawlers)
try {
    npx supabase functions deploy og-preview --no-verify-jwt
    
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "✅ og-preview deployed successfully!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 What was deployed:" -ForegroundColor Cyan
    Write-Host "  ✅ og-preview - Server-rendered OG meta tags for social crawlers" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔍 Features:" -ForegroundColor Cyan
    Write-Host "  • Crawler detection (WhatsApp, Twitter, Facebook, etc.)" -ForegroundColor White
    Write-Host "  • Auto-redirects non-crawlers to canonical URLs" -ForegroundColor White
    Write-Host "  • Supports events and posts" -ForegroundColor White
    Write-Host "  • Consistent OG payloads with client-side rendering" -ForegroundColor White
    Write-Host ""
    Write-Host "🧪 Test the function:" -ForegroundColor Cyan
    Write-Host "  • Event: https://[PROJECT_REF].supabase.co/functions/v1/og-preview?type=event&id=[EVENT_ID]" -ForegroundColor Gray
    Write-Host "  • Post: https://[PROJECT_REF].supabase.co/functions/v1/og-preview?type=post&id=[POST_ID]" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📚 Documentation: See SHARE_PREVIEW_ENHANCEMENT.md" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

