#!/usr/bin/env pwsh
# Git push script for AI Recommendations implementation

Write-Host "📝 Committing AI Recommendations System..." -ForegroundColor Cyan
Write-Host ""

# Add all changes
git add .

# Commit with descriptive message
git commit -m "feat: Implement AI-powered spend optimization recommendations

- Add AI recommendation edge function (ai-recommend)
- Create SQL schema for recommendations, telemetry, and benchmarks
- Implement AiSpendOptimizer React component
- Add RPCs for applying recommendations (budget, CPM, freq cap)
- Fix auth to use user session tokens with RLS
- Add get_campaign_for_ai RPC for schema access
- Create category benchmarks view for AI analysis
- Implement telemetry tracking for recommendation adoption
- Add deployment scripts and verification tools

Features:
- Heuristic-based recommendations (CTR, reach, viewability, pacing)
- One-click apply with automatic campaign updates
- Telemetry for measuring recommendation lift
- Handles low data gracefully (no premature recommendations)

Tech:
- Supabase Edge Functions (Deno)
- PostgreSQL views and RPCs
- React + TypeScript
- RLS-enforced security"

Write-Host ""
Write-Host "✅ Committed!" -ForegroundColor Green
Write-Host ""

# Push to remote
Write-Host "📤 Pushing to remote..." -ForegroundColor Cyan
git push

Write-Host ""
Write-Host "🎉 All changes pushed successfully!" -ForegroundColor Green
Write-Host ""

