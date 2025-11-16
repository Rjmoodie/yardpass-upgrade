#!/bin/bash

# Deploy ALL Edge Functions - No Verification
# Use this to quickly deploy all edge functions to production

set -e  # Exit on error

echo "🚀 Deploying ALL Edge Functions (No Verification)..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check we're in the right directory
if [ ! -d "supabase/functions" ]; then
  echo -e "${RED}❌ Error: supabase/functions directory not found${NC}"
  echo "   Please run this script from the project root"
  exit 1
fi

# List all edge functions
FUNCTIONS=(
  "ai-writing-assistant"
  "create-checkout"
  "enhanced-checkout"
  "ensure-tickets"
  "guest-checkout"
  "guest-tickets-start"
  "home-feed"
  "process-payment"
  "send-purchase-confirmation"
  "send-ticket-reminder"
  "stripe-webhook"
)

echo -e "${YELLOW}📦 Edge Functions to Deploy (${#FUNCTIONS[@]} total):${NC}"
for func in "${FUNCTIONS[@]}"; do
  echo "   - $func"
done
echo ""

# Start deployment
echo -e "${GREEN}Starting deployment...${NC}"
echo ""

SUCCESS_COUNT=0
FAILED_COUNT=0
FAILED_FUNCTIONS=()

for func in "${FUNCTIONS[@]}"; do
  echo -e "${YELLOW}📤 Deploying $func...${NC}"
  
  if npx supabase functions deploy "$func" --no-verify-jwt 2>&1 | tee /tmp/deploy_$func.log; then
    echo -e "${GREEN}✅ $func deployed successfully${NC}"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo -e "${RED}❌ $func deployment failed${NC}"
    FAILED_COUNT=$((FAILED_COUNT + 1))
    FAILED_FUNCTIONS+=("$func")
  fi
  
  echo ""
done

# Summary
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}📊 Deployment Summary${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo -e "✅ Successful: ${GREEN}$SUCCESS_COUNT${NC}/${#FUNCTIONS[@]}"

if [ $FAILED_COUNT -gt 0 ]; then
  echo -e "❌ Failed: ${RED}$FAILED_COUNT${NC}/${#FUNCTIONS[@]}"
  echo ""
  echo -e "${RED}Failed functions:${NC}"
  for func in "${FAILED_FUNCTIONS[@]}"; do
    echo "   - $func"
  done
  echo ""
  exit 1
else
  echo -e "❌ Failed: 0/${#FUNCTIONS[@]}"
  echo ""
  echo -e "${GREEN}🎉 All edge functions deployed successfully!${NC}"
fi

echo ""
echo "📝 Next steps:"
echo "   1. Test checkout flow in production"
echo "   2. Verify feed ranking is working"
echo "   3. Monitor Stripe webhook logs"
echo ""







