#!/bin/bash
# Complete Ad System Deployment Script
# Run this to deploy all migrations and configurations

DB_URL="postgresql://postgres:Louisonthego12@db.yieslxnrfeqchbcmgavz.supabase.co:5432/postgres"

echo "================================================"
echo "🚀 Deploying Complete Ad System"
echo "================================================"

echo ""
echo "Step 1: Deploy ad tracking & billing migrations..."
psql "$DB_URL" -f "supabase/migrations/20251026160000_fix_impression_dedup_handling.sql"
psql "$DB_URL" -f "supabase/migrations/20251026170000_add_wallet_to_ledger.sql"
psql "$DB_URL" -f "supabase/migrations/20251026180000_make_wallet_id_nullable.sql"

echo ""
echo "Step 2: Update campaign pricing to $5 CPM..."
psql "$DB_URL" -f "update-campaign-pricing-correct.sql"

echo ""
echo "Step 3: Deploy analytics functions..."
psql "$DB_URL" -f "drop-old-analytics-functions.sql"
psql "$DB_URL" -f "supabase/migrations/20251026190000_create_analytics_rpcs.sql"

echo ""
echo "================================================"
echo "✅ Deployment Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Hard refresh your browser (Ctrl+Shift+R)"
echo "2. Test the feed - ads should track impressions"
echo "3. Click an ad CTA - clicks should be logged"
echo "4. Check Campaign Manager - analytics should display"
echo ""
echo "Verify billing:"
echo "  psql \"$DB_URL\" -f \"check-ad-accounting.sql\""
echo ""

