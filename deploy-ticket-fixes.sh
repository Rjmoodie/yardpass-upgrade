#!/bin/bash

# 🚀 Deploy All 4 Fixed Ticket Functions
# Run this script to deploy all fixes at once

set -e

echo "🚀 Deploying Fixed Ticket Generation Functions..."
echo ""

cd /Users/rod/Desktop/yard_pass/yardpass/yardpass-upgrade/yardpass-upgrade

echo "📦 Deploying ensure-tickets..."
supabase functions deploy ensure-tickets --no-verify-jwt --project-ref yieslxnrfeqchbcmgavz

echo ""
echo "📦 Deploying process-payment..."
supabase functions deploy process-payment --no-verify-jwt --project-ref yieslxnrfeqchbcmgavz

echo ""
echo "📦 Deploying resend-confirmation..."
supabase functions deploy resend-confirmation --no-verify-jwt --project-ref yieslxnrfeqchbcmgavz

echo ""
echo "📦 Deploying stripe-webhook..."
supabase functions deploy stripe-webhook --no-verify-jwt --project-ref yieslxnrfeqchbcmgavz

echo ""
echo "✅ All 4 functions deployed successfully!"
echo ""
echo "🧪 Now run this test command:"
echo ""
echo "curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ensure-tickets' \\"
echo "  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"order_id\": \"5cd581b8-9b00-4e96-b6f0-d6458e5db278\"}'"
echo ""
echo "Expected: {\"status\":\"issued\",\"issued\":1}"
echo ""



