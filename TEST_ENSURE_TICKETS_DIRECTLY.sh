#!/bin/bash

# Test ensure-tickets directly with most recent order

echo "🧪 Testing ensure-tickets function directly..."
echo ""
echo "Testing with order: 3e0174c9-0984-4d38-b549-d83bb17d3ea3"
echo ""

curl -v -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ensure-tickets' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "3e0174c9-0984-4d38-b549-d83bb17d3ea3"}'

echo ""
echo ""
echo "Expected successful response: {\"status\":\"issued\",\"issued\":1}"
echo ""
echo "If you see an error, paste the FULL output including HTTP status code"
echo ""



