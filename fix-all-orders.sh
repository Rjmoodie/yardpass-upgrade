#!/bin/bash

# Fix all 5 failed orders + send emails

echo "🎟️ Fixing 5 Failed Orders..."
echo ""

API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY"
BASE_URL="https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1"

# Order 1: 6067f78d-176b-4571-a7f0-c24c06b43815
echo "1. Generating tickets for order: 6067f78d..."
curl -X POST "$BASE_URL/ensure-tickets" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "6067f78d-176b-4571-a7f0-c24c06b43815"}'
echo ""
sleep 1

# Order 2: 017b0053-e348-42d5-a665-5be1e1c23353
echo "2. Generating tickets for order: 017b0053..."
curl -X POST "$BASE_URL/ensure-tickets" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "017b0053-e348-42d5-a665-5be1e1c23353"}'
echo ""
sleep 1

# Order 3: 3e0174c9-0984-4d38-b549-d83bb17d3ea3
echo "3. Generating tickets for order: 3e0174c9..."
curl -X POST "$BASE_URL/ensure-tickets" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "3e0174c9-0984-4d38-b549-d83bb17d3ea3"}'
echo ""
sleep 1

# Order 4: ec8723e3-6984-4c1e-b773-c734f49b9150
echo "4. Generating tickets for order: ec8723e3..."
curl -X POST "$BASE_URL/ensure-tickets" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "ec8723e3-6984-4c1e-b773-c734f49b9150"}'
echo ""
sleep 1

# Order 5: f87b5419-c01c-4cc7-9644-292a15e0ec93
echo "5. Generating tickets for order: f87b5419..."
curl -X POST "$BASE_URL/ensure-tickets" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "f87b5419-c01c-4cc7-9644-292a15e0ec93"}'
echo ""
echo ""

echo "✅ All 5 orders processed!"
echo ""
echo "Now sending confirmation emails..."
echo ""

# Send emails for all 5 orders
curl -X POST "$BASE_URL/resend-confirmation" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d '{"orderId": "6067f78d-176b-4571-a7f0-c24c06b43815"}'
echo ""
curl -X POST "$BASE_URL/resend-confirmation" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d '{"orderId": "017b0053-e348-42d5-a665-5be1e1c23353"}'
echo ""
curl -X POST "$BASE_URL/resend-confirmation" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d '{"orderId": "3e0174c9-0984-4d38-b549-d83bb17d3ea3"}'
echo ""
curl -X POST "$BASE_URL/resend-confirmation" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d '{"orderId": "ec8723e3-6984-4c1e-b773-c734f49b9150"}'
echo ""
curl -X POST "$BASE_URL/resend-confirmation" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d '{"orderId": "f87b5419-c01c-4cc7-9644-292a15e0ec93"}'
echo ""
echo ""
echo "✅ All emails sent!"
echo ""
echo "Verify tickets created:"
echo "Run this SQL in Supabase:"
echo ""
echo "SELECT COUNT(*) FROM ticketing.tickets WHERE created_at > now() - interval '5 minutes';"
echo ""


