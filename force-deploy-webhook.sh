#!/bin/bash
# Force deploy stripe-webhook with cache invalidation

echo "🚀 Force deploying stripe-webhook function..."
echo ""

cd "$(dirname "$0")"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not installed"
    echo "Install with: npm install -g supabase"
    exit 1
fi

# Login check
echo "Checking Supabase login status..."
if ! supabase projects list &> /dev/null 2>&1; then
    echo "❌ Not logged in to Supabase"
    echo ""
    echo "Please run: supabase login"
    echo "Then run this script again"
    exit 1
fi

echo "✅ Logged in to Supabase"
echo ""

# Get current project
echo "📋 Getting project info..."
PROJECT_REF=$(supabase projects list --output json | jq -r '.[0].id' 2>/dev/null)

if [ -z "$PROJECT_REF" ] || [ "$PROJECT_REF" = "null" ]; then
    echo "⚠️  Could not auto-detect project"
    echo "Deploying anyway..."
else
    echo "✅ Project: $PROJECT_REF"
fi

echo ""
echo "🔨 Building and deploying stripe-webhook..."
echo ""

# Deploy with verbose output
supabase functions deploy stripe-webhook --no-verify-jwt --debug

DEPLOY_STATUS=$?

echo ""
if [ $DEPLOY_STATUS -eq 0 ]; then
    echo "✅ Deployment completed!"
    echo ""
    echo "⏳ Waiting 5 seconds for propagation..."
    sleep 5
    echo ""
    echo "🎉 Function should be live now!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Test with a new purchase"
    echo "2. Check logs for: [STRIPE-WEBHOOK] Processing payment_intent.succeeded"
    echo "3. Verify email is sent"
    echo ""
    echo "🔍 View logs at:"
    echo "   Supabase Dashboard > Edge Functions > stripe-webhook > Logs"
else
    echo "❌ Deployment failed with code: $DEPLOY_STATUS"
    echo ""
    echo "Try:"
    echo "1. Run: supabase login"
    echo "2. Run this script again"
    echo "3. Check for TypeScript errors in the function"
fi

