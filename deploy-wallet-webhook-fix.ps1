# Deploy Wallet Webhook Fix
# Fixes: column invoices.wallet_id does not exist error
# ====================================================

$PROJECT_REF = "yieslxnrfeqchbcmgavz"

Write-Host "🚀 Deploying Wallet Webhook Fix..." -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is available
try {
    $version = npx supabase --version 2>&1
    Write-Host "✅ Supabase CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI not found. Please install it first." -ForegroundColor Red
    Write-Host "   Run: npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "📦 Deploying wallet-stripe-webhook..." -ForegroundColor Yellow
Write-Host ""

# Deploy the function
try {
    npx supabase functions deploy wallet-stripe-webhook `
        --project-ref $PROJECT_REF `
        --no-verify-jwt
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ wallet-stripe-webhook deployed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
        Write-Host "📋 What was fixed:" -ForegroundColor Cyan
        Write-Host "  ✅ Added error handling for missing invoices.wallet_id column" -ForegroundColor Green
        Write-Host "  ✅ Webhook now gracefully handles schema/view issues" -ForegroundColor Green
        Write-Host "  ✅ Prevents crashes when invoice view is missing columns" -ForegroundColor Green
        Write-Host ""
        Write-Host "🔍 Verify deployment:" -ForegroundColor Yellow
        Write-Host "  https://supabase.com/dashboard/project/$PROJECT_REF/functions/wallet-stripe-webhook" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "⚠️  Note: If errors persist, ensure the public.invoices view exists" -ForegroundColor Yellow
        Write-Host "   with the wallet_id column. Check migration:" -ForegroundColor Yellow
        Write-Host "   supabase/migrations/20250126030000_create_invoices_table.sql" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "❌ Deployment failed!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Error during deployment: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green

