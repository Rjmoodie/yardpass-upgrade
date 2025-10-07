#!/bin/bash

# Debug Campaign Components and Organization User Flow
# This script analyzes the campaign system and organization flow

echo "🔍 Debugging Campaign Components and Organization User Flow..."

# Check if we have the required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_PASSWORD" ]; then
    echo "❌ Error: SUPABASE_URL and SUPABASE_PASSWORD environment variables are required"
    echo "   Set them with: export SUPABASE_URL=your_url SUPABASE_PASSWORD=your_password"
    exit 1
fi

echo "📊 Running comprehensive campaign and organization analysis..."
psql -h yieslxnrfeqchbcmgavz.supabase.co -p 5432 -U postgres -d postgres \
    -f scripts/debug-campaign-org-flow.sql

echo ""
echo "💡 Common Issues in Campaign/Organization Flow:"
echo ""
echo "1. 🔗 Organization-Campaign Relationship Issues:"
echo "   - Campaigns without valid org_id"
echo "   - Orphaned campaigns (org deleted but campaign exists)"
echo "   - Missing org memberships for campaign creators"
echo ""
echo "2. 👥 User Role and Permission Issues:"
echo "   - Users without organization memberships"
echo "   - Invalid role assignments (not owner/admin/editor/viewer)"
echo "   - Missing user profiles for org members"
echo ""
echo "3. 📊 Campaign Status Issues:"
echo "   - Invalid campaign statuses"
echo "   - Draft campaigns that should be active"
echo "   - Missing budget or date validation"
echo ""
echo "4. 🎯 Campaign Creation Flow Issues:"
echo "   - Missing org_id in campaign creation"
echo "   - Invalid objective types"
echo "   - Missing required fields (budget, dates)"
echo ""
echo "5. 🔄 Navigation and UI Issues:"
echo "   - Campaign dashboard not showing for organizations"
echo "   - Missing organization context in campaign components"
echo "   - Tab navigation not working properly"
echo ""
echo "🎯 Key Components to Check:"
echo "   - CampaignDashboard: Requires orgId prop"
echo "   - CampaignCreator: Validates org context"
echo "   - CampaignList: Shows campaigns by organization"
echo "   - useCampaigns hook: Filters by org_id"
echo "   - Organization flow: Create org → Dashboard → Campaigns"
echo ""
echo "📋 Next Steps:"
echo "   1. Check the SQL results above for data integrity issues"
echo "   2. Verify organization memberships and roles"
echo "   3. Test campaign creation flow with valid organization"
echo "   4. Check frontend navigation to campaigns tab"
echo "   5. Verify campaign analytics and creative management"
