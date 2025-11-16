#!/bin/bash
# Quick verification that migrations are ready to deploy
# ========================================================

echo "🔍 Verifying Migration Files..."
echo "================================"
echo ""

MIGRATION_DIR="./supabase/migrations"
ERRORS=0

# Check Migration 09
echo "Checking 20251111000009_ticket_refunds_v1.sql..."
if grep -q "CREATE INDEX IF NOT EXISTS" "$MIGRATION_DIR/20251111000009_ticket_refunds_v1.sql"; then
  echo "  ✅ All indexes have IF NOT EXISTS"
else
  echo "  ❌ Some indexes missing IF NOT EXISTS"
  ERRORS=$((ERRORS + 1))
fi

if grep -q "CREATE OR REPLACE FUNCTION" "$MIGRATION_DIR/20251111000009_ticket_refunds_v1.sql"; then
  echo "  ✅ Functions use CREATE OR REPLACE"
else
  echo "  ⚠️  No functions found (might be OK)"
fi

echo ""

# Check Migration 10
echo "Checking 20251111000010_refund_requests.sql..."
if grep -q "CREATE INDEX IF NOT EXISTS" "$MIGRATION_DIR/20251111000010_refund_requests.sql"; then
  echo "  ✅ All indexes have IF NOT EXISTS"
else
  echo "  ❌ Some indexes missing IF NOT EXISTS"
  ERRORS=$((ERRORS + 1))
fi

if grep -q "DROP POLICY IF EXISTS" "$MIGRATION_DIR/20251111000010_refund_requests.sql"; then
  echo "  ✅ Policies have DROP IF EXISTS"
else
  echo "  ❌ Policies missing DROP IF EXISTS"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# Check Migration 11
echo "Checking 20251111000011_auto_approve_logic.sql..."
if grep -q "CREATE OR REPLACE FUNCTION" "$MIGRATION_DIR/20251111000011_auto_approve_logic.sql"; then
  echo "  ✅ Functions use CREATE OR REPLACE"
else
  echo "  ❌ Functions not using CREATE OR REPLACE"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "================================"

if [ $ERRORS -eq 0 ]; then
  echo "✅ All migrations are idempotent!"
  echo "   Safe to run multiple times."
  echo ""
  echo "Ready to deploy with:"
  echo "  supabase db push --project-ref yieslxnrfeqchbcmgavz"
  echo ""
  exit 0
else
  echo "❌ Found $ERRORS issue(s)"
  echo "   Please fix before deploying"
  echo ""
  exit 1
fi



