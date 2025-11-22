#!/bin/bash

# Deploy OG Preview Edge Function
# This function provides server-rendered Open Graph meta tags for social media crawlers
# Run this after: npx supabase login

set -e  # Exit on error

echo "🚀 Deploying OG Preview Edge Function..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if logged in
if ! npx supabase projects list > /dev/null 2>&1; then
  echo "❌ Not authenticated with Supabase!"
  echo "Please run: npx supabase login"
  exit 1
fi

echo "✅ Authenticated with Supabase"
echo ""

# Check if function exists
if [ ! -d "supabase/functions/og-preview" ]; then
  echo "❌ Error: supabase/functions/og-preview directory not found"
  echo "   Please ensure the og-preview function exists"
  exit 1
fi

echo "📦 Deploying og-preview..."
echo ""

# Deploy the function
# Note: --no-verify-jwt is used because this endpoint is public (for crawlers)
npx supabase functions deploy og-preview --no-verify-jwt

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ og-preview deployed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 What was deployed:"
echo "  ✅ og-preview - Server-rendered OG meta tags for social crawlers"
echo ""
echo "🔍 Features:"
echo "  • Crawler detection (WhatsApp, Twitter, Facebook, etc.)"
echo "  • Auto-redirects non-crawlers to canonical URLs"
echo "  • Supports events and posts"
echo "  • Consistent OG payloads with client-side rendering"
echo ""
echo "🧪 Test the function:"
echo "  • Event: https://[PROJECT_REF].supabase.co/functions/v1/og-preview?type=event&id=[EVENT_ID]"
echo "  • Post: https://[PROJECT_REF].supabase.co/functions/v1/og-preview?type=post&id=[POST_ID]"
echo ""
echo "📚 Documentation: See SHARE_PREVIEW_ENHANCEMENT.md"
echo ""

