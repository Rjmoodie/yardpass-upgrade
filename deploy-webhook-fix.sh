#!/bin/bash
# Deploy the fixed stripe-webhook function
echo "🚀 Deploying stripe-webhook with async fix..."
npx supabase functions deploy stripe-webhook
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Go to Stripe Dashboard → Webhooks"
echo "2. Send a test 'checkout.session.completed' event"
echo "3. Check Supabase logs to verify it works"

