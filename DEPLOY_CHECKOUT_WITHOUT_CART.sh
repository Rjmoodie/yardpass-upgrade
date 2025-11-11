#!/bin/bash
# Deploy Checkout Functions WITHOUT cart_snapshot
# This fixes the PGRST204 error permanently

set -e

echo "🚀 Deploying Checkout Fix (Removing cart_snapshot)..."
echo ""
cd "$(dirname "$0")"

echo "📦 Deploying enhanced-checkout..."
supabase functions deploy enhanced-checkout --no-verify-jwt

echo ""
echo "📦 Deploying guest-checkout..."
supabase functions deploy guest-checkout --no-verify-jwt

echo ""
echo "✅ DEPLOYMENT COMPLETE"
echo ""
echo "🎉 Checkout should now work!"
echo ""
echo "🧪 Test:"
echo "   1. Refresh browser (Cmd + Shift + R)"
echo "   2. Go to an event"
echo "   3. Click 'Get Tickets'"
echo "   4. Buy a ticket"
echo "   5. Should work without 500 error!"
echo ""
echo "📊 What changed:"
echo "   ✅ Removed cart_snapshot (redundant field)"
echo "   ✅ All cart data still saved in order_items table"
echo "   ✅ No data loss"
echo ""


