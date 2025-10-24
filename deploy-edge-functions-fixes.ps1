# Deploy Fixed Edge Functions
# Date: October 24, 2025
# Purpose: Deploy schema-prefix fixes for Edge Functions

Write-Host "🚀 Deploying Fixed Edge Functions..." -ForegroundColor Cyan
Write-Host ""

# Navigate to supabase directory
Set-Location supabase

# Deploy posts-list (fixes Posts tab on Event Details)
Write-Host "📝 Deploying posts-list..." -ForegroundColor Yellow
npx supabase functions deploy posts-list
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ posts-list deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ posts-list deployment failed" -ForegroundColor Red
}
Write-Host ""

# Deploy checkout-session-status (fixes ticket purchase)
Write-Host "🎫 Deploying checkout-session-status..." -ForegroundColor Yellow
npx supabase functions deploy checkout-session-status
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ checkout-session-status deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ checkout-session-status deployment failed" -ForegroundColor Red
}
Write-Host ""

# Deploy refresh-stripe-accounts (fixes Stripe Connect)
Write-Host "💳 Deploying refresh-stripe-accounts..." -ForegroundColor Yellow
npx supabase functions deploy refresh-stripe-accounts
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ refresh-stripe-accounts deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ refresh-stripe-accounts deployment failed" -ForegroundColor Red
}
Write-Host ""

# Deploy home-feed (fixes main feed)
Write-Host "🏠 Deploying home-feed..." -ForegroundColor Yellow
npx supabase functions deploy home-feed
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ home-feed deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ home-feed deployment failed" -ForegroundColor Red
}
Write-Host ""

# Return to root
Set-Location ..

Write-Host "🎉 Deployment Complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test your app now:" -ForegroundColor White
Write-Host "1. Main Feed should load without CORS errors ✅" -ForegroundColor White
Write-Host "2. Event Details > Posts tab should work ✅" -ForegroundColor White
Write-Host "3. Get Tickets button should open modal ✅" -ForegroundColor White
Write-Host "4. Profile > Stripe Connect errors reduced ✅" -ForegroundColor White

