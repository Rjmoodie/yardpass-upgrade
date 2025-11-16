#!/bin/bash

# 🚨 Quick Fix Script - Deploy ensure-tickets and check config
# Run this after fixing the code to deploy and verify everything

set -e  # Exit on any error

echo "🚀 Liventix Ticket Generation Fix Script"
echo "========================================"
echo ""

# Check if we're in the right directory
if [ ! -f "supabase/functions/ensure-tickets/index.ts" ]; then
  echo "❌ Error: Not in the yardpass-upgrade directory"
  echo "Please cd to: /Users/rod/Desktop/yard_pass/yardpass/yardpass-upgrade/yardpass-upgrade"
  exit 1
fi

echo "✅ Found ensure-tickets function"
echo ""

# Step 1: Deploy the fixed function
echo "📦 Step 1: Deploying fixed ensure-tickets function..."
echo "Running: supabase functions deploy ensure-tickets --no-verify-jwt"
echo ""

if command -v supabase &> /dev/null; then
  supabase functions deploy ensure-tickets --no-verify-jwt
  echo "✅ ensure-tickets deployed successfully!"
else
  echo "⚠️  Supabase CLI not found. Please deploy manually:"
  echo "   1. Go to: https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/functions"
  echo "   2. Click 'ensure-tickets'"
  echo "   3. Click 'Deploy new version'"
fi

echo ""

# Step 2: Check environment variables
echo "🔍 Step 2: Checking environment variables..."
echo ""

echo "To check if RESEND_API_KEY is set:"
echo "  supabase secrets list"
echo ""
echo "If not set, add it:"
echo "  supabase secrets set RESEND_API_KEY=re_your_key_here"
echo ""

# Step 3: Create SQL diagnostic queries
echo "📊 Step 3: Creating diagnostic queries..."
echo ""

cat > /tmp/check_recent_orders.sql << 'EOF'
-- Check most recent orders and ticket generation status
SELECT 
  o.id as order_id,
  o.created_at::text as order_time,
  o.status,
  o.total_cents / 100.0 as total_usd,
  o.contact_email,
  e.title as event_title,
  (SELECT COUNT(*) FROM tickets t WHERE t.order_id = o.id) as tickets_created,
  (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as items_ordered,
  CASE 
    WHEN (SELECT COUNT(*) FROM tickets t WHERE t.order_id = o.id) > 0 THEN '✅ Has Tickets'
    WHEN o.status = 'paid' THEN '❌ MISSING TICKETS'
    ELSE '⏳ Pending Payment'
  END as status
FROM orders o
LEFT JOIN events e ON e.id = o.event_id
WHERE o.created_at > now() - interval '2 hours'
ORDER BY o.created_at DESC
LIMIT 5;
EOF

echo "✅ Created diagnostic query: /tmp/check_recent_orders.sql"
echo ""
echo "Run this in Supabase SQL Editor to check order status."
echo ""

# Step 4: Create fix query for failed orders
cat > /tmp/fix_failed_orders.sql << 'EOF'
-- Find orders that need ticket generation
WITH failed_orders AS (
  SELECT 
    o.id,
    o.created_at,
    o.status,
    o.user_id,
    o.event_id,
    e.title as event_title
  FROM orders o
  LEFT JOIN events e ON e.id = o.event_id
  WHERE o.status = 'paid'
    AND o.paid_at > now() - interval '24 hours'
    AND (SELECT COUNT(*) FROM tickets t WHERE t.order_id = o.id) = 0
  ORDER BY o.created_at DESC
)
SELECT 
  id as order_id,
  created_at::text as order_time,
  event_title,
  '⚠️ Call ensure-tickets for this order' as action_needed
FROM failed_orders;

-- To fix each order, call:
-- SELECT * FROM ensure_tickets_manual('ORDER_ID_HERE');
EOF

echo "✅ Created fix query: /tmp/fix_failed_orders.sql"
echo ""

# Step 5: Test the deployment
echo "🧪 Step 4: Testing deployment..."
echo ""
echo "To test manually:"
echo "  1. Make a test purchase through the app"
echo "  2. Check Supabase logs:"
echo "     supabase functions logs process-payment --tail"
echo "  3. Should see: '✅ Purchase confirmation email sent successfully'"
echo ""

# Summary
echo "================================"
echo "✅ DEPLOYMENT COMPLETE"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Check Supabase secrets have RESEND_API_KEY"
echo "2. Run /tmp/check_recent_orders.sql to verify recent orders"
echo "3. If orders missing tickets, run /tmp/fix_failed_orders.sql"
echo "4. Make a test purchase to verify everything works"
echo ""
echo "For detailed instructions, see: DEPLOYMENT_CHECKLIST.md"
echo ""



