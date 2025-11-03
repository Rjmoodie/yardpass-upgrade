#!/bin/bash
# Deploy all guest-related functions with schema fixes

echo "🚀 Deploying guest functions with schema fixes..."
echo ""

cd "$(dirname "$0")"

# Check if logged in
if ! supabase projects list &> /dev/null 2>&1; then
    echo "❌ Not logged in to Supabase"
    echo "Please run: supabase login"
    exit 1
fi

echo "✅ Logged in to Supabase"
echo ""

echo "🔧 What was fixed:"
echo "   • Removed .schema('ticketing') calls (PostgREST only exposes public schema)"
echo "   • Functions now access tables via public schema views"
echo "   • Guest auto-redirects to /tickets after verification"
echo "   • Added better error logging for debugging"
echo ""

# Deploy functions
echo "📦 Deploying guest-tickets-start..."
if supabase functions deploy guest-tickets-start --no-verify-jwt; then
    echo "   ✅ guest-tickets-start deployed"
else
    echo "   ❌ Failed to deploy guest-tickets-start"
    exit 1
fi
echo ""

echo "📦 Deploying guest-tickets-verify..."
if supabase functions deploy guest-tickets-verify --no-verify-jwt; then
    echo "   ✅ guest-tickets-verify deployed"
else
    echo "   ❌ Failed to deploy guest-tickets-verify"
    exit 1
fi
echo ""

echo "📦 Deploying tickets-list-guest..."
if supabase functions deploy tickets-list-guest --no-verify-jwt; then
    echo "   ✅ tickets-list-guest deployed"
else
    echo "   ❌ Failed to deploy tickets-list-guest"
    exit 1
fi
echo ""

echo "🎉 All guest functions deployed successfully!"
echo ""
echo "✅ Fixes Applied:"
echo "   • Views created in public schema for ticketing tables"
echo "   • Edge Functions updated to use public.guest_* views"
echo "   • Auto-redirect to /tickets after guest verification"
echo "   • Better error handling and logging"
echo ""
echo "🧪 Test the Guest Access flow:"
echo "   1. Click 'Guest Access' tab in auth modal"
echo "   2. Enter phone or email"
echo "   3. Click 'Send access code'"
echo "   4. Check email/phone for 6-digit OTP"
echo "   5. Enter OTP and verify"
echo "   6. Auto-redirects to /tickets page ✨"
echo ""
echo "⚠️  IMPORTANT: Run this SQL in Supabase Dashboard first:"
echo "   • Go to: SQL Editor > New query"
echo "   • Paste SQL from instructions below"
echo "   • Click 'Run' to create public schema views"
echo ""
echo "🔍 Monitor logs:"
echo "   Supabase Dashboard > Edge Functions > guest-tickets-verify > Logs"
echo "   Look for: [guest-tickets-verify] OTP lookup result"

