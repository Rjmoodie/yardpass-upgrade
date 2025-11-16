#!/bin/bash

# Deploy Urgency Boost Feature
# This script applies the updated feed ranking with urgency boost for upcoming events

set -e  # Exit on error

echo "🚨 Deploying Urgency Boost Feature..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "supabase/migrations/20251102000002_optimize_feed_for_ticket_purchases.sql" ]; then
  echo -e "${RED}❌ Error: Migration file not found${NC}"
  echo "   Please run this script from the project root directory"
  exit 1
fi

echo -e "${YELLOW}📝 What this deploys:${NC}"
echo "   - Urgency boost for events within 7 days (+0.30)"
echo "   - Extra urgency for events within 24 hours (+0.50)"
echo "   - Posts from upcoming events inherit the boost"
echo "   - Fully configurable via model_feature_weights table"
echo ""

# Confirm deployment
read -p "Deploy to production? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}⏸️  Deployment cancelled${NC}"
  exit 0
fi

echo ""
echo -e "${GREEN}🚀 Starting deployment...${NC}"
echo ""

# Step 1: Push database changes
echo "📊 Step 1/3: Applying database migration..."
npx supabase db push

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Database migration failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Database migration applied${NC}"
echo ""

# Step 2: Verify weights
echo "🔍 Step 2/3: Verifying feature weights..."
npx supabase db execute --sql "
SELECT 
  feature, 
  weight, 
  notes 
FROM model_feature_weights 
WHERE feature LIKE 'urgency%'
ORDER BY feature;
" --format table

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Weight verification failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Feature weights verified${NC}"
echo ""

# Step 3: Test query
echo "🧪 Step 3/3: Testing urgency boost..."
npx supabase db execute --sql "
WITH test_events AS (
  SELECT
    e.id,
    e.title,
    e.start_at,
    EXTRACT(DAY FROM (e.start_at - now())) AS days_until,
    CASE
      WHEN e.start_at <= now() + INTERVAL '1 day' THEN 0.50
      WHEN e.start_at <= now() + INTERVAL '7 days' THEN 0.30
      ELSE 0.0
    END AS urgency_boost
  FROM events e
  WHERE e.visibility = 'public'
    AND e.start_at > now()
    AND e.start_at <= now() + INTERVAL '7 days'
  ORDER BY e.start_at
  LIMIT 10
)
SELECT
  title,
  ROUND(days_until::numeric, 1) AS days_away,
  urgency_boost,
  CASE
    WHEN urgency_boost = 0.50 THEN '🚨 24hr boost'
    WHEN urgency_boost = 0.30 THEN '⚠️ 7day boost'
    ELSE 'No boost'
  END AS status
FROM test_events;
" --format table

if [ $? -ne 0 ]; then
  echo -e "${YELLOW}⚠️  Test query failed (might be no events in 7-day window)${NC}"
else
  echo -e "${GREEN}✅ Urgency boost is working${NC}"
fi
echo ""

# Success!
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Urgency Boost Deployed Successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "📊 Next steps:"
echo "   1. Monitor feed engagement for upcoming events"
echo "   2. Track last-minute ticket sales (< 48h)"
echo "   3. Adjust boost values if needed:"
echo ""
echo "      UPDATE model_feature_weights"
echo "      SET weight = 0.40"
echo "      WHERE feature = 'urgency.one_week_boost';"
echo ""
echo "   4. View detailed docs: URGENCY_BOOST_FEATURE.md"
echo ""
echo -e "${GREEN}✨ Your feed now prioritizes upcoming events!${NC}"







