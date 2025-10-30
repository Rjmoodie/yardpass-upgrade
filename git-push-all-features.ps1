#!/usr/bin/env pwsh
# Git push script for AI Recommendations + Campaign Lifecycle Production Updates

Write-Host "📝 Committing AI Recommendations + Campaign Lifecycle..." -ForegroundColor Cyan
Write-Host ""

# Add all changes
git add .

# Commit with comprehensive message
git commit -m "feat: Add AI recommendations + production-grade campaign lifecycle

🤖 AI Recommendations System:
- Implement AI recommendation edge function (ai-recommend)
- Create SQL schema for recommendations, telemetry, and benchmarks
- Build AiSpendOptimizer React component with one-click apply
- Add RPCs for applying recommendations (budget, CPM, freq cap)
- Fix auth to use user session tokens with RLS
- Add get_campaign_for_ai RPC for schema access
- Create category benchmarks view for AI analysis
- Implement telemetry tracking for recommendation adoption
- Add heuristic-based recommendations (CTR, reach, viewability, pacing)

🔄 Campaign Lifecycle Production Improvements:
- Add is_servable() - single source of truth for ad eligibility
- Create campaigns_with_status view with derived status
- Implement try_charge_campaign() with row-level locking (prevents overspend)
- Add reconcile_campaign_status() for auto-completing ended campaigns
- Create status change notification triggers
- Add comprehensive test utilities (test_is_servable, test_concurrent_charges)
- Build CampaignStatusBadge React component with reason tooltips
- Add derived status types and UI configuration
- Implement race-condition-proof charging mechanism
- Add campaign lifecycle testing guide

Technical:
- Supabase Edge Functions (Deno)
- PostgreSQL views, RPCs, and row-level locking
- React + TypeScript with shadcn/ui components
- RLS-enforced security throughout
- Comprehensive test suite for lifecycle logic

Documentation:
- CAMPAIGN_LIFECYCLE_EXPLAINED.md - Complete lifecycle behavior
- CAMPAIGN_LIFECYCLE_TESTING.md - Testing guide with SQL examples
- AI_RECOMMENDATIONS_COMPLETE.md - AI system documentation
- Deploy scripts for both features"

Write-Host ""
Write-Host "✅ Committed!" -ForegroundColor Green
Write-Host ""

# Push to remote
Write-Host "📤 Pushing to remote..." -ForegroundColor Cyan
git push

Write-Host ""
Write-Host "🎉 All features pushed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 What was deployed:" -ForegroundColor Cyan
Write-Host "  ✅ AI-powered spend optimization" -ForegroundColor White
Write-Host "  ✅ Production-grade campaign lifecycle" -ForegroundColor White
Write-Host "  ✅ Race-condition-proof charging" -ForegroundColor White
Write-Host "  ✅ Smart status derivation + UI" -ForegroundColor White
Write-Host "  ✅ Comprehensive testing suite" -ForegroundColor White
Write-Host ""

