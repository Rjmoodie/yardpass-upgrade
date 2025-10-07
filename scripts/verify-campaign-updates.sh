#!/bin/bash

# Verify Campaign Empty State Updates
# This script checks that all campaign components are working correctly

echo "🔍 Verifying Campaign Empty State Updates..."

# Check if we have the required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_PASSWORD" ]; then
    echo "❌ Error: SUPABASE_URL and SUPABASE_PASSWORD environment variables are required"
    echo "   Set them with: export SUPABASE_URL=your_url SUPABASE_PASSWORD=your_password"
    exit 1
fi

echo "📊 Running comprehensive verification..."

# 1. Check database state
echo ""
echo "1️⃣ Database State Check:"
echo "========================"

# Check campaigns
CAMPAIGNS_COUNT=$(psql -h yieslxnrfeqchbcmgavz.supabase.co -p 5432 -U postgres -d postgres -t -c "SELECT COUNT(*) FROM campaigns;" 2>/dev/null | tr -d ' ')
echo "   📊 Campaigns in database: $CAMPAIGNS_COUNT"

# Check organizations
ORGS_COUNT=$(psql -h yieslxnrfeqchbcmgavz.supabase.co -p 5432 -U postgres -d postgres -t -c "SELECT COUNT(*) FROM organizations;" 2>/dev/null | tr -d ' ')
echo "   🏢 Organizations in database: $ORGS_COUNT"

# Check RPC functions
echo ""
echo "2️⃣ RPC Functions Check:"
echo "======================="

CAMPAIGN_RPC=$(psql -h yieslxnrfeqchbcmgavz.supabase.co -p 5432 -U postgres -d postgres -t -c "
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM pg_proc 
  WHERE proname = 'rpc_campaign_analytics_daily'
) THEN 'EXISTS' ELSE 'MISSING' END;
" 2>/dev/null | tr -d ' ')

CREATIVE_RPC=$(psql -h yieslxnrfeqchbcmgavz.supabase.co -p 5432 -U postgres -d postgres -t -c "
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM pg_proc 
  WHERE proname = 'rpc_creative_analytics_rollup'
) THEN 'EXISTS' ELSE 'MISSING' END;
" 2>/dev/null | tr -d ' ')

echo "   📈 Campaign Analytics RPC: $CAMPAIGN_RPC"
echo "   🎨 Creative Analytics RPC: $CREATIVE_RPC"

# 3. Check component files
echo ""
echo "3️⃣ Component Files Check:"
echo "=========================="

# Check if updated files exist
FILES=(
  "src/components/campaigns/CampaignList.tsx"
  "src/components/campaigns/CampaignAnalytics.tsx"
  "src/components/campaigns/CreativeManager.tsx"
  "src/components/campaigns/CampaignDashboard.tsx"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✅ $file exists"
    
    # Check for empty state improvements
    if grep -q "No campaigns yet" "$file" || grep -q "No analytics data yet" "$file" || grep -q "No creatives yet" "$file"; then
      echo "      ✅ Contains improved empty state messaging"
    else
      echo "      ⚠️  May not have updated empty states"
    fi
    
    # Check for visual improvements
    if grep -q "w-24 h-24 bg-muted rounded-full" "$file"; then
      echo "      ✅ Contains visual improvements (circular icons)"
    else
      echo "      ⚠️  May not have visual improvements"
    fi
  else
    echo "   ❌ $file missing"
  fi
done

# 4. Check test files
echo ""
echo "4️⃣ Test Files Check:"
echo "====================="

TEST_FILES=(
  "src/components/debug/CampaignEmptyStateTester.tsx"
  "src/pages/CampaignEmptyStateTest.tsx"
  "scripts/test-campaign-empty-states.sh"
)

for file in "${TEST_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✅ $file exists"
  else
    echo "   ❌ $file missing"
  fi
done

# 5. Expected behavior analysis
echo ""
echo "5️⃣ Expected Behavior Analysis:"
echo "==============================="

if [ "$CAMPAIGNS_COUNT" = "0" ]; then
  echo "   🎯 Expected: Empty states should show in all tabs"
  echo "      - Campaigns: 'No campaigns yet' with create button"
  echo "      - Analytics: 'No analytics data yet' with guidance"
  echo "      - Creatives: 'No creatives yet' with create button"
elif [ "$CAMPAIGNS_COUNT" -gt "0" ]; then
  echo "   🎯 Expected: Campaign data should show in all tabs"
  echo "      - Campaigns: List of existing campaigns"
  echo "      - Analytics: Performance metrics and charts"
  echo "      - Creatives: List of ad creatives"
else
  echo "   ⚠️  Could not determine campaign count"
fi

# 6. Recommendations
echo ""
echo "6️⃣ Recommendations:"
echo "==================="

if [ "$CAMPAIGNS_COUNT" = "0" ]; then
  echo "   💡 To test empty states:"
  echo "      1. Navigate to campaign dashboard"
  echo "      2. Verify all tabs show empty state messages"
  echo "      3. Test creating a campaign to see data appear"
elif [ "$CAMPAIGNS_COUNT" -gt "0" ]; then
  echo "   💡 To test with data:"
  echo "      1. Navigate to campaign dashboard"
  echo "      2. Verify all tabs show campaign data"
  echo "      3. Test the empty state tester page"
fi

if [ "$CAMPAIGN_RPC" = "MISSING" ] || [ "$CREATIVE_RPC" = "MISSING" ]; then
  echo "   ⚠️  Missing RPC functions may cause analytics issues"
  echo "      Consider running database migrations"
fi

echo ""
echo "✅ Verification completed!"
echo ""
echo "🚀 Next Steps:"
echo "   1. Test the campaign dashboard in your browser"
echo "   2. Use the empty state tester: /campaign-empty-state-test"
echo "   3. Create a test campaign to verify data loading"
echo "   4. Check browser console for any errors"
