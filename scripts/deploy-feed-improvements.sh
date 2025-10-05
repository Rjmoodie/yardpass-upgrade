#!/bin/bash

# Deploy Feed Improvements
# This script applies the feed optimization changes to the database and edge functions

set -e

echo "🚀 Deploying Feed Improvements..."

# Check if we have the required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_PASSWORD" ]; then
    echo "❌ Error: SUPABASE_URL and SUPABASE_PASSWORD environment variables are required"
    echo "   Set them with: export SUPABASE_URL=your_url SUPABASE_PASSWORD=your_password"
    exit 1
fi

echo "📊 Applying SQL migrations..."

# Apply the feed window extension migration
echo "  - Extending feed window to 180 days with balanced scoring..."
psql -h yieslxnrfeqchbcmgavz.supabase.co -p 5432 -U postgres -d postgres \
    -f supabase/migrations/20250101000000_extend_feed_window_corrected.sql

# Apply the wrapper function migration
echo "  - Creating get_home_feed_ranked wrapper function..."
psql -h yieslxnrfeqchbcmgavz.supabase.co -p 5432 -U postgres -d postgres \
    -f supabase/migrations/20250101000001_create_feed_ranked_wrapper.sql

echo "✅ SQL migrations applied successfully!"

echo "📝 Edge function updated in supabase/functions/home-feed/index.ts"
echo "   - Fixed function name mismatch (get_home_feed_ranked)"
echo "   - Added input validation and clamping"
echo "   - Improved error handling and RLS tolerance"
echo "   - Enhanced field selection (added description)"

echo ""
echo "🎯 Summary of improvements:"
echo "   ✅ Extended feed window: 21 days → 180 days (6 months)"
echo "   ✅ Symmetric decay: Events before/after now get balanced scores"
echo "   ✅ Post capping: Max 3 posts per event to prevent spam"
echo "   ✅ Input validation: Limits clamped to prevent abuse"
echo "   ✅ Better error handling: Graceful fallbacks and RLS tolerance"
echo "   ✅ Consistent naming: Edge function calls correct SQL function"

echo ""
echo "🚀 Ready to deploy! The feed will now show:"
echo "   - All media posts from events up to 6 months old"
echo "   - Balanced scoring that doesn't favor far-future events"
echo "   - Limited posts per event to maintain feed quality"
echo "   - Better performance with input validation"

echo ""
echo "💡 Next steps:"
echo "   1. Test the feed in your app to verify the improvements"
echo "   2. Monitor performance and user engagement"
echo "   3. Consider tightening CORS origins in the edge function"
echo "   4. Add database indexes if needed for better performance"
