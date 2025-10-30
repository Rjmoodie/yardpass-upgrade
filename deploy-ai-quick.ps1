#!/usr/bin/env pwsh
# Quick deploy - just edge function (SQL already partially applied)

Write-Host "🚀 Deploying AI Recommend Edge Function..." -ForegroundColor Cyan
Write-Host ""

# Deploy only the edge function
npx supabase@latest functions deploy ai-recommend --no-verify-jwt

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🔍 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Hard refresh your browser (Ctrl+Shift+R)"
Write-Host "  2. Check console - should see successful fetch"
Write-Host ""

