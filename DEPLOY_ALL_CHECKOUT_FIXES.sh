#!/bin/bash
# Deploy ALL Checkout Fixes
# Fixes PGRST204 errors in enhanced-checkout, guest-checkout, AND process-payment

set -e

echo "🚀 Deploying Complete Checkout Fix..."
echo ""
cd "$(dirname "$0")"

echo "📦 Step 1: Apply RPC migrations (bypass PostgREST)..."
supabase db push

echo ""
echo "📦 Step 2: Deploy enhanced-checkout..."
supabase functions deploy enhanced-checkout --no-verify-jwt

echo ""
echo "📦 Step 3: Deploy guest-checkout..."
supabase functions deploy guest-checkout --no-verify-jwt

echo ""
echo "📦 Step 4: Deploy process-payment (webhook handler)..."
supabase functions deploy process-payment --no-verify-jwt

echo ""
echo "✅ ALL CHECKOUT FUNCTIONS DEPLOYED!"
echo ""
echo "🎉 Fixed:"
echo "   ✅ enhanced-checkout (authenticated users)"
echo "   ✅ guest-checkout (guest users)"
echo "   ✅ process-payment (webhook/completion)"
echo ""
echo "🧪 Test:"
echo "   1. Refresh browser (Cmd + Shift + R)"
echo "   2. Buy a ticket"
echo "   3. Complete payment"
echo "   4. Should work end-to-end!"
echo ""
echo "📊 All functions now use ticketing.checkout_sessions (correct table)"
echo ""


