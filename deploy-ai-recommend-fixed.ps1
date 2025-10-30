#!/usr/bin/env pwsh
# Deploy AI Recommendations - Complete Fix

Write-Host "🚀 Deploying AI Recommendations (with schema fix)" -ForegroundColor Cyan
Write-Host ""

# Step 1: Apply SQL migration
Write-Host "📊 Step 1: Applying SQL migration..." -ForegroundColor Yellow
npx supabase@latest db push

Write-Host ""

# Step 2: Deploy edge function
Write-Host "⚡ Step 2: Deploying edge function..." -ForegroundColor Yellow
npx supabase@latest functions deploy ai-recommend --no-verify-jwt

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🔍 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Hard refresh your browser (Ctrl+Shift+R)"
Write-Host "  2. Check console - should see successful fetch"
Write-Host "  3. AI Recommendations section should appear"
Write-Host ""

