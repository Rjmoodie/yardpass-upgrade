#!/bin/bash
# Deploy the updated Stripe webhook function

echo "🚀 Deploying updated stripe-webhook function..."
echo ""
echo "This will deploy the function that:"
echo "  ✅ Handles payment_intent.succeeded (for embedded checkout)"
echo "  ✅ Queries by checkout_session_id correctly"
echo "  ✅ Sends confirmation emails"
echo ""

cd "$(dirname "$0")"

# Check if logged in
if ! supabase projects list &> /dev/null; then
  echo "❌ Not logged in to Supabase"
  echo "Please run: supabase login"
  echo ""
  exit 1
fi

echo "✅ Logged in to Supabase"
echo ""
echo "Deploying stripe-webhook function..."

supabase functions deploy stripe-webhook

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Function deployed successfully!"
  echo ""
  echo "📋 Next Steps:"
  echo "1. Make sure STRIPE_WEBHOOK_SECRET is configured in Supabase Dashboard"
  echo "2. Add 'payment_intent.succeeded' event to your Stripe webhook"
  echo "3. Test with a new purchase"
  echo ""
  echo "🔍 Check logs at:"
  echo "   Supabase Dashboard > Edge Functions > stripe-webhook > Logs"
else
  echo ""
  echo "❌ Deployment failed"
  echo "Check the error above and try again"
  exit 1
fi
