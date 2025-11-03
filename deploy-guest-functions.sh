#!/bin/bash
# Deploy all guest-related edge functions

echo "🚀 Deploying guest-related Edge Functions..."
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

# Array of guest-related functions
functions=(
    "guest-checkout"
    "guest-tickets-start"
    "guest-tickets-verify"
    "tickets-list-guest"
    "validate-guest-code"
)

# Deploy each function
for func in "${functions[@]}"; do
    echo "📦 Deploying $func..."
    if supabase functions deploy "$func" --no-verify-jwt; then
        echo "   ✅ $func deployed successfully"
    else
        echo "   ❌ $func deployment failed"
        exit 1
    fi
    echo ""
done

echo ""
echo "🎉 All guest functions deployed successfully!"
echo ""
echo "📋 Summary:"
echo "   ✅ guest-checkout (creates embedded checkout for guests)"
echo "   ✅ guest-tickets-start (sends OTP codes)"
echo "   ✅ guest-tickets-verify (verifies OTP codes)"
echo "   ✅ tickets-list-guest (lists guest tickets)"
echo "   ✅ validate-guest-code (validates promo codes)"
echo ""
echo "🧪 Test guest checkout:"
echo "   1. Go to an event page (not logged in)"
echo "   2. Click 'Get Tickets'"
echo "   3. Enter email and complete embedded checkout"
echo "   4. Check email for confirmation"
echo ""
echo "🔍 Monitor logs at:"
echo "   Supabase Dashboard > Edge Functions > Logs"

