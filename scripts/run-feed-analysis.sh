#!/bin/bash

# Feed Analysis Script
# This script connects to your Supabase database and runs the feed filtering analysis

echo "🔍 Analyzing Feed Filtering Impact..."
echo "=================================="

# Set your database connection details
DB_HOST="yieslxnrfeqchbcmgavz.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"

echo "📊 Connecting to database: $DB_HOST"
echo ""

# Run the quick analysis
echo "1. QUICK SUMMARY - Media Posts Excluded by 21-Day Window:"
echo "--------------------------------------------------------"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f scripts/quick-feed-analysis.sql

echo ""
echo "✅ Analysis complete!"
echo ""
echo "💡 RECOMMENDATIONS:"
echo "- If you see many excluded posts, consider extending the 21-day window"
echo "- Check if the excluded posts have high engagement (likes/comments)"
echo "- Consider showing posts from events the user has tickets for, regardless of age"
echo ""
echo "🔧 TO FIX: Modify the feed algorithm in:"
echo "   supabase/migrations/20251004025006_b733b150-86ce-4699-86ad-508adfb63a56.sql"
echo "   Change: e.start_at > now() - INTERVAL '21 days'"
echo "   To: e.start_at > now() - INTERVAL '60 days' (or your preferred window)"
