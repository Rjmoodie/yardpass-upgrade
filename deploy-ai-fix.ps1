#!/usr/bin/env pwsh
# Quick deploy script for AI recommend edge function

Write-Host "🚀 Deploying fixed ai-recommend edge function..." -ForegroundColor Cyan

# Deploy the edge function
npx supabase@latest functions deploy ai-recommend --no-verify-jwt

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "Now refresh your browser to test." -ForegroundColor Yellow

