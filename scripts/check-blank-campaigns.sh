#!/bin/bash

# Quick check for why campaign tabs are blank
echo "🔍 Checking why campaign tabs are blank..."

# Check if we can connect to Supabase
echo ""
echo "📊 Database Connection Check:"
echo "=============================="

# This will require the user to set their password
echo "Please set your Supabase password:"
echo "export SUPABASE_PASSWORD='your_password_here'"
echo ""
echo "Then run:"
echo "psql -h yieslxnrfeqchbcmgavz.supabase.co -U postgres -d postgres -f scripts/debug-blank-campaigns.sql"
echo ""

# Alternative: Check if local Supabase is running
echo "📱 Local Supabase Check:"
echo "========================"
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI found"
    supabase status 2>/dev/null || echo "❌ Local Supabase not running"
else
    echo "❌ Supabase CLI not found"
fi

echo ""
echo "🎯 Most Likely Causes:"
echo "======================"
echo "1. No organizations created yet"
echo "2. No campaigns created yet" 
echo "3. User not authenticated"
echo "4. Database permissions issues"
echo "5. RPC functions not deployed"
echo "6. Component loading errors"

echo ""
echo "🚀 Quick Solutions:"
echo "==================="
echo "1. Visit /campaigns/debug to run frontend diagnostics"
echo "2. Check browser console for JavaScript errors"
echo "3. Verify you're logged in"
echo "4. Create an organization first"
echo "5. Create a campaign to see data"

echo ""
echo "📋 Next Steps:"
echo "=============="
echo "1. Open http://localhost:5173/campaigns/debug"
echo "2. Click 'Run Diagnostics'"
echo "3. Follow the suggested solutions"
