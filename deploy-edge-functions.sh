#!/bin/bash

# YardPass - Deploy Edge Functions Only
# Run this after: npx supabase login

set -e  # Exit on error

echo "🚀 Deploying YardPass Edge Functions..."
echo ""

# Check if logged in
if ! npx supabase projects list > /dev/null 2>&1; then
  echo "❌ Not authenticated with Supabase!"
  echo "Please run: npx supabase login"
  exit 1
fi

echo "✅ Authenticated with Supabase"
echo ""

# Deploy edge functions
echo "🔧 Deploying 6 edge functions..."
echo ""

echo "[1/6] Deploying home-feed..."
npx supabase functions deploy home-feed --no-verify-jwt
echo "✅ home-feed deployed"
echo ""

echo "[2/6] Deploying ensure-tickets..."
npx supabase functions deploy ensure-tickets --no-verify-jwt
echo "✅ ensure-tickets deployed"
echo ""

echo "[3/6] Deploying process-payment..."
npx supabase functions deploy process-payment --no-verify-jwt
echo "✅ process-payment deployed"
echo ""

echo "[4/6] Deploying send-purchase-confirmation..."
npx supabase functions deploy send-purchase-confirmation --no-verify-jwt
echo "✅ send-purchase-confirmation deployed"
echo ""

echo "[5/6] Deploying enhanced-checkout..."
npx supabase functions deploy enhanced-checkout --no-verify-jwt
echo "✅ enhanced-checkout deployed"
echo ""

echo "[6/6] Deploying create-checkout..."
npx supabase functions deploy create-checkout --no-verify-jwt
echo "✅ create-checkout deployed"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 All edge functions deployed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 What was deployed:"
echo "  ✅ home-feed - is_attending flags, pagination fix"
echo "  ✅ ensure-tickets - Skip tickets for RSVP tiers"
echo "  ✅ process-payment - RSVP handling"
echo "  ✅ send-purchase-confirmation - RSVP emails"
echo "  ✅ enhanced-checkout - No fee for free tickets (member)"
echo "  ✅ create-checkout - No fee for free tickets (guest)"
echo ""
echo "⚠️  Note: Database migrations NOT deployed"
echo "To deploy database changes, run: npx supabase db push"
echo ""
echo "🧪 Ready to test!"





