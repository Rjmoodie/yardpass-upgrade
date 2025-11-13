#!/bin/bash

# ============================================================================
# FIX ALL MISSING TICKETS - 19 Orders, 26 Tickets, $2,292.08 USD
# ============================================================================

ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY"
SUPABASE_URL="https://yieslxnrfeqchbcmgavz.supabase.co"

# All 19 orders missing tickets
ORDERS=(
  "b9ca7f8b-38f0-410d-b2cf-2f253c9b47c5"
  "5cd581b8-9b00-4e96-b6f0-d6458e5db278"
  "ba1eff01-8955-4136-b4af-39161aaebda8"
  "176315e6-8219-41b6-ad2f-e983b17792d0"
  "d4c379f2-c2e2-4b5a-853f-f2256c99176a"
  "e7af1931-d942-4426-b20f-96b0fa004c3c"
  "40b7f420-d62c-4a6e-b120-64cd4ac8bf0d"
  "eb449249-0f0e-474c-aef9-1eb32819ec0e"
  "94b66cae-462a-4796-8a47-670faa269c69"
  "ec520819-448d-494a-af94-9f4194a66dbe"
  "c94eceaf-1f3d-4a45-b9db-fc41f427dbf8"
  "cd04c469-eb88-4bbd-ba15-7372a49846a5"
  "11b3314f-291d-4b9c-a9c1-500ec65f9247"
  "dffcef1c-d006-42b8-918d-ecdaa9932eee"
  "47849909-1c38-4337-9ad6-91748c5b54ac"
  "65c16489-fbe1-4dbe-a4eb-1985a645873f"
  "7ff85a07-ad42-4c96-b714-86ca9a223e07"
  "22d98305-0b2d-4b8a-aa3e-f8987455be87"
  "61f63bab-640d-4caa-9baf-a0a08a82b227"
)

echo "🎟️  Fixing 19 Orders (26 tickets, \$2,292.08 USD)..."
echo ""

# Generate tickets for each order
SUCCESS_COUNT=0
FAIL_COUNT=0
TOTAL_TICKETS=0

for i in "${!ORDERS[@]}"; do
  ORDER_ID="${ORDERS[$i]}"
  ORDER_NUM=$((i + 1))
  
  echo "$ORDER_NUM. Generating tickets for order: ${ORDER_ID:0:8}..."
  
  RESPONSE=$(curl -s -X POST \
    "$SUPABASE_URL/functions/v1/ensure-tickets" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"order_id\": \"$ORDER_ID\"}")
  
  echo "$RESPONSE"
  
  # Check if successful
  if echo "$RESPONSE" | grep -q '"status":"issued"'; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    # Extract issued count
    ISSUED=$(echo "$RESPONSE" | grep -o '"issued":[0-9]*' | grep -o '[0-9]*')
    if [ -n "$ISSUED" ]; then
      TOTAL_TICKETS=$((TOTAL_TICKETS + ISSUED))
    fi
  elif echo "$RESPONSE" | grep -q '"status":"already_issued"'; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    echo "  ↳ Already had tickets"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo "  ↳ ❌ FAILED"
  fi
  
  # Small delay to avoid rate limiting
  sleep 0.5
done

echo ""
echo "✅ Ticket Generation Complete!"
echo "   Success: $SUCCESS_COUNT/19 orders"
echo "   Failed: $FAIL_COUNT/19 orders"
echo "   Tickets Issued: $TOTAL_TICKETS"
echo ""

# Send confirmation emails
echo "📧 Sending confirmation emails..."
echo ""

EMAIL_SUCCESS=0
EMAIL_FAIL=0

for i in "${!ORDERS[@]}"; do
  ORDER_ID="${ORDERS[$i]}"
  ORDER_NUM=$((i + 1))
  
  EMAIL_RESPONSE=$(curl -s -X POST \
    "$SUPABASE_URL/functions/v1/resend-confirmation" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"orderId\": \"$ORDER_ID\"}")
  
  echo "$ORDER_NUM. $EMAIL_RESPONSE"
  
  if echo "$EMAIL_RESPONSE" | grep -q '"success":true'; then
    EMAIL_SUCCESS=$((EMAIL_SUCCESS + 1))
  else
    EMAIL_FAIL=$((EMAIL_FAIL + 1))
  fi
  
  sleep 0.5
done

echo ""
echo "✅ Email Sending Complete!"
echo "   Success: $EMAIL_SUCCESS/19 emails"
echo "   Failed: $EMAIL_FAIL/19 emails"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 ALL DONE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Verify in Supabase SQL:"
echo "SELECT COUNT(*) FROM ticketing.tickets WHERE created_at > now() - interval '10 minutes';"
echo ""
echo "Expected: $TOTAL_TICKETS new tickets"


