#!/bin/bash

# Phase 2 Stripe Fixes - Edge Function Deployment Script
# Resilience & Maintainability improvements

echo "🚀 Deploying Phase 2 Stripe resilience improvements..."
echo ""
echo "📦 This deployment includes:"
echo "  - Retry logic with exponential backoff"
echo "  - Circuit breaker integration"
echo "  - Consolidated shared utilities"
echo ""

# Deploy all functions that use shared utilities
echo "1️⃣ Deploying guest-checkout (resilience + shared utils)..."
supabase functions deploy guest-checkout --no-verify-jwt

echo ""
echo "2️⃣ Deploying enhanced-checkout (resilience + shared utils)..."
supabase functions deploy enhanced-checkout --no-verify-jwt

echo ""
echo "3️⃣ Deploying get-stripe-balance (retry logic)..."
supabase functions deploy get-stripe-balance --no-verify-jwt

echo ""
echo "4️⃣ Deploying create-payout (retry logic)..."
supabase functions deploy create-payout --no-verify-jwt

echo ""
echo "5️⃣ Deploying create-stripe-connect (standardized circuit breaker)..."
supabase functions deploy create-stripe-connect --no-verify-jwt

echo ""
echo "✅ All Phase 2 Edge Functions deployed!"
echo ""
echo "📋 Next steps:"
echo "1. Test retry logic (simulate network failures)"
echo "2. Monitor circuit breaker state in database"
echo "3. Verify no import errors in function logs"
echo "4. See STRIPE_PHASE2_COMPLETE.md for full testing checklist"

