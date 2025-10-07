#!/bin/bash

# Debug script for attendees page issues
echo "🔍 Debugging attendees page issues..."
echo ""

# Check if we can connect to Supabase
echo "📊 Database Connection Check:"
echo "=============================="

# This will require the user to set their password
echo "Please set your Supabase password:"
echo "export SUPABASE_PASSWORD='your_password_here'"
echo ""
echo "Then run:"
echo "psql -h yieslxnrfeqchbcmgavz.supabase.co -U postgres -d postgres -f scripts/debug-attendees-issue.sql"
echo ""

echo "🎯 Most Likely Causes:"
echo "======================"
echo "1. No tickets with valid status (issued, transferred, redeemed)"
echo "2. User profiles missing or not linked properly"
echo "3. RLS (Row Level Security) policies blocking data access"
echo "4. Event not found or wrong identifier"
echo "5. Database connection issues"
echo "6. JavaScript errors in browser console"

echo ""
echo "🚀 Quick Solutions:"
echo "==================="
echo "1. Check browser console for JavaScript errors"
echo "2. Verify the event exists and is public"
echo "3. Check if there are any tickets for the event"
echo "4. Verify user profiles are properly linked"
echo "5. Check RLS policies on tickets and user_profiles tables"

echo ""
echo "📋 Debugging Steps:"
echo "==================="
echo "1. Open browser dev tools (F12)"
echo "2. Go to Network tab"
echo "3. Navigate to attendees page"
echo "4. Check for failed requests or 403/401 errors"
echo "5. Look for console errors"
echo "6. Check if the event identifier is correct in URL"

echo ""
echo "🔧 Updated EventAttendeesPage Features:"
echo "======================================="
echo "✅ Added loading states"
echo "✅ Added error handling"
echo "✅ Added console logging for debugging"
echo "✅ Added back button navigation"
echo "✅ Added empty state for no attendees"
echo "✅ Added attendee count display"
