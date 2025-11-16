#!/bin/bash

# Liventix - Deploy All Recent Changes
# Run this after: npx supabase login

set -e  # Exit on error

echo "🚀 Starting Liventix Deployment..."
echo ""

# Check if logged in
if ! npx supabase projects list > /dev/null 2>&1; then
  echo "❌ Not authenticated with Supabase!"
  echo "Please run: npx supabase login"
  exit 1
fi

echo "✅ Authenticated with Supabase"
echo ""

# Deploy database migrations
echo "📊 Deploying database migrations..."
npx supabase db push
echo "✅ Database migrations deployed"
echo ""

# Deploy edge functions
echo "🔧 Deploying edge functions..."

echo "1/6 Deploying home-feed..."
npx supabase functions deploy home-feed --no-verify-jwt
echo "✅ home-feed deployed"
echo ""

echo "2/6 Deploying ensure-tickets..."
npx supabase functions deploy ensure-tickets --no-verify-jwt
echo "✅ ensure-tickets deployed"
echo ""

echo "3/6 Deploying process-payment..."
npx supabase functions deploy process-payment --no-verify-jwt
echo "✅ process-payment deployed"
echo ""

echo "4/6 Deploying send-purchase-confirmation..."
npx supabase functions deploy send-purchase-confirmation --no-verify-jwt
echo "✅ send-purchase-confirmation deployed"
echo ""

echo "5/6 Deploying enhanced-checkout..."
npx supabase functions deploy enhanced-checkout --no-verify-jwt
echo "✅ enhanced-checkout deployed"
echo ""

echo "6/6 Deploying create-checkout..."
npx supabase functions deploy create-checkout --no-verify-jwt
echo "✅ create-checkout deployed"
echo ""

echo "🎉 All deployments complete!"
echo ""
echo "📋 Summary of Changes:"
echo "  ✅ Feed ranking optimized for ticket purchase intent"
echo "  ✅ Saved posts unified with saved events"
echo "  ✅ No processing fees for free tickets"
echo "  ✅ RSVP confirmations (no tickets issued)"
echo "  ✅ is_attending flags for UI badges"
echo "  ✅ Post delete functionality (frontend only - no deploy needed)"
echo ""
echo "🧪 Next: Test in your app!"







