#!/bin/bash

# Phase 1 Stripe Fixes - Edge Function Deployment Script
# Run this after applying database migrations

echo "🚀 Deploying Phase 1 Stripe fixes..."
echo ""

# Deploy in dependency order (shared utilities first)
echo "1️⃣ Deploying guest-checkout..."
supabase functions deploy guest-checkout --no-verify-jwt

echo ""
echo "2️⃣ Deploying enhanced-checkout..."
supabase functions deploy enhanced-checkout --no-verify-jwt

echo ""
echo "3️⃣ Deploying get-stripe-balance..."
supabase functions deploy get-stripe-balance --no-verify-jwt

echo ""
echo "4️⃣ Deploying create-payout..."
supabase functions deploy create-payout --no-verify-jwt

echo ""
echo "✅ All Edge Functions deployed!"
echo ""
echo "📋 Next steps:"
echo "1. Apply database migration: supabase db push"
echo "2. Test the changes (see STRIPE_PHASE1_COMPLETE.md)"
echo "3. Monitor for any errors in Supabase logs"

