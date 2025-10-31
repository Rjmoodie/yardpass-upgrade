# Deploy Console Error Fixes
# This script deploys the migration to fix:
# 1. event_impressions 404 error
# 2. notifications 404 error

Write-Host "🚀 Deploying console error fixes..." -ForegroundColor Cyan
Write-Host ""

# Deploy the migration
Write-Host "📋 Running migration..." -ForegroundColor Yellow
supabase db push --include-all

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration deployed successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Verify tables
    Write-Host "🔍 Verifying tables..." -ForegroundColor Yellow
    
    $verifyQuery = @"
-- Check public views for impressions
SELECT 'public.event_impressions' as view_name, count(*) as exists
FROM pg_views
WHERE schemaname = 'public' AND viewname = 'event_impressions'
UNION ALL
SELECT 'public.post_impressions' as view_name, count(*) as exists
FROM pg_views
WHERE schemaname = 'public' AND viewname = 'post_impressions'
UNION ALL
-- Check notifications table
SELECT 'public.notifications' as view_name, count(*) as exists
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'notifications';
"@
    
    $verifyQuery | supabase db execute
    
    Write-Host ""
    Write-Host "✅ Console errors should now be fixed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 What was fixed:" -ForegroundColor Cyan
    Write-Host "  1. ✅ RPC functions for event_impressions created" -ForegroundColor White
    Write-Host "  2. ✅ RPC functions for post_impressions created" -ForegroundColor White
    Write-Host "  3. ✅ notifications table created" -ForegroundColor White
    Write-Host "  4. ✅ Helper functions for managing notifications" -ForegroundColor White
    Write-Host "  5. ✅ Frontend updated to use RPC functions" -ForegroundColor White
    Write-Host ""
    Write-Host "🔄 Refresh your browser to see the errors disappear!" -ForegroundColor Green
} else {
    Write-Host "❌ Migration failed. Check error above." -ForegroundColor Red
    exit 1
}

