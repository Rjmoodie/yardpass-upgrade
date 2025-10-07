#!/bin/bash

# Debug script to find posts by Kaylee and Datmahseh
# This will help us understand why their posts aren't showing in the feed

echo "🔍 Debugging posts by Kaylee and Datmahseh..."

# Check if we have the required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_PASSWORD" ]; then
    echo "❌ Error: SUPABASE_URL and SUPABASE_PASSWORD environment variables are required"
    echo "   Set them with: export SUPABASE_URL=your_url SUPABASE_PASSWORD=your_password"
    exit 1
fi

echo "📊 Running analysis..."
psql -h yieslxnrfeqchbcmgavz.supabase.co -p 5432 -U postgres -d postgres \
    -f scripts/debug-kaylee-datmahseh-posts.sql

echo ""
echo "💡 Common reasons posts might not appear:"
echo "   1. Posts are older than 21 days (current window) or 180 days (new window)"
echo "   2. Associated events are outside the time window"
echo "   3. Posts are marked as deleted (deleted_at IS NOT NULL)"
echo "   4. Events have visibility != 'public'"
echo "   5. Posts have no media_urls (if filtering for media posts only)"
echo ""
echo "🎯 If you see posts in the results but they're not in your feed:"
echo "   - Check the feed_window_status column"
echo "   - Check the event_feed_window_status column"
echo "   - Make sure deleted_at is NULL"
echo "   - Verify event visibility is 'public'"
