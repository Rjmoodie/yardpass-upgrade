#!/bin/bash

# Deploy Checkout Start Tracking Feature
# Implements the #2 purchase intent signal (weight: 4.0)

set -e  # Exit on error

echo "🛒 Deploying Checkout Start Tracking..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check directory
if [ ! -f "supabase/migrations/20251101000001_add_checkout_tracking.sql" ]; then
  echo -e "${RED}❌ Error: Migration file not found${NC}"
  echo "   Please run this script from the project root directory"
  exit 1
fi

echo -e "${YELLOW}📝 What this deploys:${NC}"
echo "   - checkout_sessions table (tracks checkout starts)"
echo "   - Feed ranking integration (weight: 4.0)"
echo "   - Webhook completion tracking"
echo "   - Frontend hook for automatic tracking"
echo ""

# Confirm
read -p "Deploy to production? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}⏸️  Deployment cancelled${NC}"
  exit 0
fi

echo ""
echo -e "${GREEN}🚀 Starting deployment...${NC}"
echo ""

# Step 1: Database migrations
echo "📊 Step 1/4: Applying database migrations..."
npx supabase db push

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Database migration failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Database migrations applied${NC}"
echo ""

# Step 2: Deploy webhook
echo "⚡ Step 2/4: Deploying Stripe webhook..."
npx supabase functions deploy stripe-webhook

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Webhook deployment failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Webhook deployed${NC}"
echo ""

# Step 3: Verify table
echo "🔍 Step 3/4: Verifying checkout_sessions table..."
npx supabase db execute --sql "
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'checkout_sessions'
  AND table_schema = 'public'
ORDER BY ordinal_position;
" --format table

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Table verification failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Table verified${NC}"
echo ""

# Step 4: Verify weight
echo "⚙️  Step 4/4: Verifying feature weight..."
npx supabase db execute --sql "
SELECT 
  feature,
  weight,
  half_life_days,
  notes
FROM model_feature_weights
WHERE feature = 'intent.checkout_start';
" --format table

if [ $? -ne 0 ]; then
  echo -e "${YELLOW}⚠️  Weight verification failed${NC}"
else
  echo -e "${GREEN}✅ Feature weight verified${NC}"
fi
echo ""

# Success!
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Checkout Tracking Deployed!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "📊 Next steps:"
echo ""
echo "1. Test tracking (create a test checkout):"
echo "   - Go to any event"
echo "   - Click 'Get Tickets'"
echo "   - Start checkout"
echo "   - Check database:"
echo ""
echo "     SELECT * FROM checkout_sessions"
echo "     WHERE started_at > now() - INTERVAL '1 hour'"
echo "     ORDER BY started_at DESC;"
echo ""
echo "2. Monitor abandoned checkouts:"
echo ""
echo "     SELECT "
echo "       COUNT(*) FILTER (WHERE completed_at IS NULL) AS abandoned,"
echo "       COUNT(*) AS total"
echo "     FROM checkout_sessions"
echo "     WHERE started_at > now() - INTERVAL '7 days';"
echo ""
echo "3. View full docs: CHECKOUT_TRACKING_FEATURE.md"
echo ""
echo -e "${GREEN}✨ The #2 purchase intent signal is now LIVE!${NC}"

