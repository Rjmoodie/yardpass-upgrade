#!/bin/bash
# Deploy All Refund System Edge Functions
# ========================================

set -e  # Exit on error

PROJECT_REF="yieslxnrfeqchbcmgavz"

echo "🚀 Deploying Refund System Edge Functions"
echo "=========================================="
echo ""

# Deploy new functions with --no-verify-jwt
echo "1/5 Deploying submit-refund-request..."
supabase functions deploy submit-refund-request --project-ref $PROJECT_REF --no-verify-jwt

echo ""
echo "2/5 Deploying review-refund-request..."
supabase functions deploy review-refund-request --project-ref $PROJECT_REF --no-verify-jwt

echo ""
echo "3/5 Re-deploying stripe-webhook..."
supabase functions deploy stripe-webhook --project-ref $PROJECT_REF --no-verify-jwt

echo ""
echo "4/5 Re-deploying process-refund..."
supabase functions deploy process-refund --project-ref $PROJECT_REF --no-verify-jwt

echo ""
echo "5/5 Re-deploying send-refund-confirmation..."
supabase functions deploy send-refund-confirmation --project-ref $PROJECT_REF --no-verify-jwt

echo ""
echo "✅ All 5 Edge Functions deployed successfully!"
echo ""
echo "📋 Next Steps:"
echo "   1. Update Stripe webhook to include 'charge.refunded' event"
echo "   2. Test customer refund request flow"
echo "   3. Test organizer approval/decline"
echo ""


