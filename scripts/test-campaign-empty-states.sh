#!/bin/bash

# Test Campaign Empty States Updates
# This script verifies that the campaign components are working correctly

echo "🧪 Testing Campaign Empty States Updates..."

# Check if we have the required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_PASSWORD" ]; then
    echo "❌ Error: SUPABASE_URL and SUPABASE_PASSWORD environment variables are required"
    echo "   Set them with: export SUPABASE_URL=your_url SUPABASE_PASSWORD=your_password"
    exit 1
fi

echo "📊 Running database checks..."

# 1. Check if campaigns table has data
echo "1. Checking campaigns data..."
psql -h yieslxnrfeqchbcmgavz.supabase.co -p 5432 -U postgres -d postgres -c "
SELECT 
  'Campaigns count:' as check_type, 
  COUNT(*) as count 
FROM campaigns;
"

# 2. Check organizations
echo "2. Checking organizations..."
psql -h yieslxnrfeqchbcmgavz.supabase.co -p 5432 -U postgres -d postgres -c "
SELECT 
  'Organizations count:' as check_type, 
  COUNT(*) as count 
FROM organizations;
"

# 3. Check org memberships
echo "3. Checking org memberships..."
psql -h yieslxnrfeqchbcmgavz.supabase.co -p 5432 -U postgres -d postgres -c "
SELECT 
  'Org memberships count:' as check_type, 
  COUNT(*) as count 
FROM org_memberships;
"

# 4. Check RPC functions exist
echo "4. Checking RPC functions..."
psql -h yieslxnrfeqchbcmgavz.supabase.co -p 5432 -U postgres -d postgres -c "
SELECT 
  'Campaign analytics RPC:' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'rpc_campaign_analytics_daily'
  ) THEN 'EXISTS' ELSE 'MISSING' END as status;
"

psql -h yieslxnrfeqchbcmgavz.supabase.co -p 5432 -U postgres -d postgres -c "
SELECT 
  'Creative analytics RPC:' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'rpc_creative_analytics_rollup'
  ) THEN 'EXISTS' ELSE 'MISSING' END as status;
"

echo ""
echo "✅ Database checks completed!"
echo ""
echo "🎯 Expected Results:"
echo "   - If campaigns count = 0: You'll see the new empty states"
echo "   - If campaigns count > 0: You'll see campaign data"
echo "   - RPC functions should exist for analytics to work"
echo ""
echo "📱 Frontend Testing:"
echo "   1. Navigate to your campaign dashboard"
echo "   2. Check each tab (Campaigns, Analytics, Creatives)"
echo "   3. Verify empty states show proper messaging"
echo "   4. Test creating a campaign to see data appear"
echo ""
echo "🔍 What to Look For:"
echo "   ✅ Campaigns tab: 'No campaigns yet' with create button"
echo "   ✅ Analytics tab: 'No analytics data yet' with guidance"
echo "   ✅ Creatives tab: 'No creatives yet' with create button"
echo "   ✅ All tabs: Professional empty states instead of blank areas"
echo ""
echo "🚀 Next Steps:"
echo "   1. Test the campaign dashboard in your browser"
echo "   2. Create a test campaign to verify data loading"
echo "   3. Check that empty states guide users properly"
