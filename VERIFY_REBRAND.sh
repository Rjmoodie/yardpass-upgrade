#!/bin/bash
# 🔍 Verify Rebrand Completion
# ============================

echo "🔍 Verifying Liventix Rebrand..."
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for remaining Liventix references
echo "1️⃣ Checking for remaining 'Liventix' references..."
yardpass_count=$(grep -r "Liventix" --exclude-dir={node_modules,.git,dist,build} . 2>/dev/null | wc -l | tr -d ' ')

if [ "$yardpass_count" -eq 0 ]; then
  echo -e "${GREEN}✅ No 'Liventix' found${NC}"
else
  echo -e "${RED}⚠️  Found $yardpass_count instances of 'Liventix'${NC}"
  echo "   Run: grep -r 'Liventix' --exclude-dir={node_modules,.git,dist,build} ."
fi

echo ""

# Check for liventix presence
echo "2️⃣ Checking for 'Liventix' references..."
liventix_count=$(grep -r "Liventix" --exclude-dir={node_modules,.git,dist,build} . 2>/dev/null | wc -l | tr -d ' ')

if [ "$liventix_count" -gt 100 ]; then
  echo -e "${GREEN}✅ Found $liventix_count instances of 'Liventix'${NC}"
else
  echo -e "${YELLOW}⚠️  Only found $liventix_count instances (expected 1000+)${NC}"
fi

echo ""

# Check critical files
echo "3️⃣ Checking critical files..."
echo ""

# package.json
if grep -q '"name": "liventix"' package.json 2>/dev/null; then
  echo -e "${GREEN}✅ package.json updated${NC}"
else
  echo -e "${RED}❌ package.json needs manual update${NC}"
fi

# manifest.json
if grep -q '"name": "Liventix"' public/manifest.json 2>/dev/null; then
  echo -e "${GREEN}✅ manifest.json updated${NC}"
else
  echo -e "${RED}❌ manifest.json needs manual update${NC}"
fi

# index.html
if grep -q "<title>Liventix" index.html 2>/dev/null; then
  echo -e "${GREEN}✅ index.html title updated${NC}"
else
  echo -e "${RED}❌ index.html title needs manual update${NC}"
fi

# capacitor.config.ts
if grep -q 'appName: "Liventix"' capacitor.config.ts 2>/dev/null || grep -q "appName: 'Liventix'" capacitor.config.ts 2>/dev/null; then
  echo -e "${GREEN}✅ capacitor.config.ts updated${NC}"
else
  echo -e "${RED}❌ capacitor.config.ts needs manual update${NC}"
fi

echo ""

# Check for old domain references
echo "4️⃣ Checking for old domain references..."
old_domain_count=$(grep -r "yardpass.com\|yardpass.co" --exclude-dir={node_modules,.git,dist,build} . 2>/dev/null | wc -l | tr -d ' ')

if [ "$old_domain_count" -eq 0 ]; then
  echo -e "${GREEN}✅ No old domain references found${NC}"
else
  echo -e "${YELLOW}⚠️  Found $old_domain_count old domain references${NC}"
  echo "   These may be intentional (redirects, backwards compatibility)"
fi

echo ""

# Summary
echo "================================"
echo "📊 Rebrand Verification Summary"
echo "================================"
echo ""

total_issues=0

if [ "$yardpass_count" -gt 0 ]; then
  ((total_issues++))
fi

if [ "$liventix_count" -lt 100 ]; then
  ((total_issues++))
fi

if ! grep -q '"name": "liventix"' package.json 2>/dev/null; then
  ((total_issues++))
fi

if ! grep -q '"name": "Liventix"' public/manifest.json 2>/dev/null; then
  ((total_issues++))
fi

if ! grep -q "<title>Liventix" index.html 2>/dev/null; then
  ((total_issues++))
fi

if [ "$total_issues" -eq 0 ]; then
  echo -e "${GREEN}✅ Rebrand verification PASSED!${NC}"
  echo ""
  echo "🎉 Your app is now fully rebranded to Liventix!"
  echo ""
  echo "📋 Next steps:"
  echo "  1. Replace logo images (see REBRAND_CHECKLIST.md)"
  echo "  2. Test the app: npm run dev"
  echo "  3. Build: npm run build"
  echo "  4. Deploy Edge Functions: supabase functions deploy --all"
  echo "  5. Deploy frontend to production"
else
  echo -e "${YELLOW}⚠️  Found $total_issues issue(s) that need attention${NC}"
  echo ""
  echo "📋 Please review:"
  echo "  - Check REBRAND_CHECKLIST.md for manual tasks"
  echo "  - Run: git diff to see all changes"
  echo "  - Fix any RED ❌ items above"
fi

echo ""



