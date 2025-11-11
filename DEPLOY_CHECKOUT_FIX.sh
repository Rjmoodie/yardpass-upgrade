#!/bin/bash
# Deploy Checkout Fix
# Issue: cart_snapshot column causing PGRST204 error
# Solution: Temporarily omit cart_snapshot from checkout session saves

set -e

echo "🚀 Deploying Checkout Fix..."
echo ""

# Navigate to project root
cd "$(dirname "$0")"

echo "📦 Step 1: Deploy enhanced-checkout function..."
supabase functions deploy enhanced-checkout --no-verify-jwt

echo ""
echo "📦 Step 2: Deploy guest-checkout function..."
supabase functions deploy guest-checkout --no-verify-jwt

echo ""
echo "✅ DEPLOYMENT COMPLETE"
echo ""
echo "🧪 Test by:"
echo "   1. Go to an event"
echo "   2. Click 'Get Tickets'"
echo "   3. Select a tier"
echo "   4. Click 'Continue to Checkout'"
echo "   5. Should work without 500 error!"
echo ""
echo "Expected: Stripe checkout loads successfully"
echo ""


