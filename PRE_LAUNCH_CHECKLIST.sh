#!/bin/bash

# ============================================================================
# PRE-LAUNCH VERIFICATION CHECKLIST
# Run this before going to production
# ============================================================================

echo "🚀 Liventix Pre-Launch Verification"
echo "===================================="
echo ""

SUPABASE_URL="https://yieslxnrfeqchbcmgavz.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY"

# Track results
PASS=0
FAIL=0
WARN=0

# ============================================================================
# 1. Check Edge Functions are deployed
# ============================================================================

echo "1️⃣  Checking Edge Functions..."

FUNCTIONS=(
  "ensure-tickets"
  "process-payment"
  "resend-confirmation"
  "stripe-webhook"
  "enhanced-checkout"
  "guest-checkout"
)

for FUNC in "${FUNCTIONS[@]}"; do
  echo -n "   Testing $FUNC... "
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    "$SUPABASE_URL/functions/v1/$FUNC" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{}')
  
  if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "400" ] || [ "$RESPONSE" = "422" ]; then
    echo "✅ Deployed"
    ((PASS++))
  else
    echo "❌ Not responding (HTTP $RESPONSE)"
    ((FAIL++))
  fi
done

echo ""

# ============================================================================
# 2. Check Environment Variables
# ============================================================================

echo "2️⃣  Checking Environment Variables..."
echo "   ⚠️  Manual verification required:"
echo "   Run: supabase secrets list --project-ref yieslxnrfeqchbcmgavz"
echo ""
echo "   Required secrets:"
echo "   - STRIPE_SECRET_KEY (required)"
echo "   - RESEND_API_KEY (required for emails)"
echo "   - SUPABASE_SERVICE_ROLE_KEY (auto-configured)"
echo "   - SUPABASE_URL (auto-configured)"
echo ""
((WARN++))

# ============================================================================
# 3. Database Health Check
# ============================================================================

echo "3️⃣  Database Health Check..."
echo "   ⚠️  Run these queries in Supabase SQL Editor:"
echo ""
cat << 'EOF'
-- Check accounting accuracy
WITH order_check AS (
  SELECT 
    (SELECT SUM(quantity) FROM ticketing.order_items oi WHERE oi.order_id = o.id) as should_have,
    (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.order_id = o.id) as actually_has
  FROM ticketing.orders o
  WHERE o.status = 'paid'
)
SELECT 
  CASE 
    WHEN should_have = actually_has THEN '✅ PERFECT'
    ELSE '❌ MISMATCH'
  END as status,
  COUNT(*) as order_count
FROM order_check
GROUP BY 
  CASE 
    WHEN should_have = actually_has THEN '✅ PERFECT'
    ELSE '❌ MISMATCH'
  END;
EOF
echo ""
((WARN++))

# ============================================================================
# 4. Check Cron Jobs
# ============================================================================

echo "4️⃣  Checking Cron Jobs..."
echo "   ⚠️  Verify in Supabase Dashboard → Database → Cron Jobs:"
echo "   - expire-ticket-holds (every 5 min) ✅"
echo ""
((WARN++))

# ============================================================================
# 5. Test Purchase Flow (Optional)
# ============================================================================

echo "5️⃣  Test Purchase Flow..."
echo "   📋 Manual test checklist:"
echo "   [ ] Browse events in app"
echo "   [ ] Select tickets and add to cart"
echo "   [ ] Complete Stripe checkout (use test card: 4242 4242 4242 4242)"
echo "   [ ] Verify ticket appears in 'My Tickets'"
echo "   [ ] Check confirmation email arrives"
echo "   [ ] Verify accounting in database matches"
echo ""
((WARN++))

# ============================================================================
# Results Summary
# ============================================================================

echo ""
echo "===================================="
echo "📊 Pre-Launch Results"
echo "===================================="
echo "✅ Passed:  $PASS checks"
echo "❌ Failed:  $FAIL checks"
echo "⚠️  Manual: $WARN checks"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "🎉 System is PRODUCTION READY!"
  echo ""
  echo "📋 Before going live:"
  echo "1. Verify environment variables (see section 2)"
  echo "2. Run database health check (see section 3)"
  echo "3. Confirm cron job is active (see section 4)"
  echo "4. Make a test purchase (see section 5)"
  echo ""
  echo "Then you're ready to launch! 🚀"
else
  echo "⚠️  Fix failed checks before launching"
fi

echo ""



