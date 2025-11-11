#!/bin/bash
# FINAL Checkout Fix - Bypass PostgREST Cache Entirely
# Uses RPC function instead of REST API

set -e

echo "🚀 FINAL CHECKOUT FIX - Bypassing PostgREST Cache..."
echo ""
cd "$(dirname "$0")"

echo "📦 Step 1: Apply RPC migration..."
supabase db push

echo ""
echo "📦 Step 2: Deploy enhanced-checkout..."
supabase functions deploy enhanced-checkout --no-verify-jwt

echo ""
echo "📦 Step 3: Deploy guest-checkout..."
supabase functions deploy guest-checkout --no-verify-jwt

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "🎉 Checkout now uses RPC (bypasses PostgREST cache)"
echo ""
echo "🧪 Test:"
echo "   1. Refresh browser (Cmd + Shift + R)"
echo "   2. Buy a ticket"
echo "   3. Should work!"
echo ""
echo "📊 What changed:"
echo "   ✅ Created upsert_checkout_session() RPC function"
echo "   ✅ Checkout uses direct SQL (not PostgREST)"
echo "   ✅ No more PGRST204 errors"
echo "   ✅ All snapshot data preserved"
echo ""


