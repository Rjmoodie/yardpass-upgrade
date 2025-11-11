#!/bin/bash
# Fix Checkout PostgREST Cache Issue
# The cart_snapshot column exists but PostgREST cache is stale

set -e

echo "🔄 Fixing PostgREST Schema Cache..."
echo ""

cd "$(dirname "$0")"

echo "Step 1: Stopping Supabase services..."
supabase stop

echo ""
echo "Step 2: Starting Supabase services (forces cache refresh)..."
supabase start

echo ""
echo "✅ PostgREST schema cache refreshed!"
echo ""
echo "Step 3: Deploying checkout functions with cart_snapshot enabled..."
supabase functions deploy enhanced-checkout --no-verify-jwt
supabase functions deploy guest-checkout --no-verify-jwt

echo ""
echo "🎉 CHECKOUT FIX COMPLETE!"
echo ""
echo "The cart_snapshot column now exists and PostgREST knows about it."
echo ""
echo "🧪 Test by purchasing a ticket:"
echo "   1. Go to an event"
echo "   2. Click 'Get Tickets'"
echo "   3. Select tier & click 'Continue'"
echo "   4. Should load Stripe checkout (NO 500 error!)"
echo ""


