#!/bin/bash

# Deploy Wallet Webhook Fix
# Fixes: column invoices.wallet_id does not exist error
# ====================================================

set -e  # Exit on error

PROJECT_REF="yieslxnrfeqchbcmgavz"

echo "🚀 Deploying Wallet Webhook Fix..."
echo "===================================="
echo ""

# Check if Supabase CLI is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js first."
    exit 1
fi

echo "✅ Supabase CLI available"
echo ""
echo "📦 Deploying wallet-stripe-webhook..."
echo ""

# Deploy the function
if npx supabase functions deploy wallet-stripe-webhook \
    --project-ref "$PROJECT_REF" \
    --no-verify-jwt; then
    
    echo ""
    echo "✅ wallet-stripe-webhook deployed successfully!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 What was fixed:"
    echo "  ✅ Added error handling for missing invoices.wallet_id column"
    echo "  ✅ Webhook now gracefully handles schema/view issues"
    echo "  ✅ Prevents crashes when invoice view is missing columns"
    echo ""
    echo "🔍 Verify deployment:"
    echo "  https://supabase.com/dashboard/project/$PROJECT_REF/functions/wallet-stripe-webhook"
    echo ""
    echo "⚠️  Note: If errors persist, ensure the public.invoices view exists"
    echo "   with the wallet_id column. Check migration:"
    echo "   supabase/migrations/20250126030000_create_invoices_table.sql"
else
    echo ""
    echo "❌ Deployment failed!"
    exit 1
fi

echo ""
echo "🎉 Deployment complete!"

