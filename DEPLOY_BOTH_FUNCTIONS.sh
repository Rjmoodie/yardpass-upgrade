#!/bin/bash

# 🚀 Deploy Fixed Functions - ensure-tickets AND process-payment
# Both functions were using public.* views instead of ticketing.* tables

echo "🚀 Deploying Fixed Ticket Generation Functions"
echo "=============================================="
echo ""
echo "Functions to deploy:"
echo "  1. ensure-tickets (fixed Stripe import + ticketing schema)"
echo "  2. process-payment (fixed ticketing schema)"
echo ""
echo "Please deploy these manually via Supabase Dashboard:"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/functions"
echo ""
echo "2. Deploy 'ensure-tickets':"
echo "   - Click on 'ensure-tickets'"
echo "   - Click 'Deploy new version'"
echo "   - Wait for deployment to complete"
echo ""
echo "3. Deploy 'process-payment':"
echo "   - Click on 'process-payment'"  
echo "   - Click 'Deploy new version'"
echo "   - Wait for deployment to complete"
echo ""
echo "After deploying, test with these commands:"
echo ""
echo "# Test ensure-tickets directly:"
echo "curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ensure-tickets' \\"
echo "  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"order_id\": \"5cd581b8-9b00-4e96-b6f0-d6458e5db278\"}'"
echo ""
echo "Expected response: {\"status\":\"issued\",\"issued\":1}"
echo ""



