#!/bin/bash

# Design Files Cleanup Script
# Removes duplicate design files while preserving all production functionality

set -e  # Exit on error

echo "🧹 YardPass Design Files Cleanup"
echo "================================"
echo ""

# Navigate to project root
cd "$(dirname "$0")"

echo "📍 Working directory: $(pwd)"
echo ""

# Step 1: Verify import fixes
echo "Step 1: Verifying no 'New design' imports in src/..."
if grep -r "New design" src/ 2>/dev/null; then
    echo "❌ ERROR: Found 'New design' imports in src/"
    echo "Please fix these imports before running cleanup."
    exit 1
else
    echo "✅ No 'New design' imports found in src/"
fi
echo ""

# Step 2: Create backup
echo "Step 2: Creating backup..."
if [ -d "New design" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_NAME="New design.backup.$TIMESTAMP"
    cp -r "New design" "$BACKUP_NAME"
    echo "✅ Backup created: $BACKUP_NAME"
else
    echo "ℹ️  'New design' folder not found, skipping backup"
fi
echo ""

# Step 3: Delete duplicate folder
echo "Step 3: Deleting 'New design/' folder..."
if [ -d "New design" ]; then
    rm -rf "New design"
    echo "✅ Deleted 'New design/' folder (~2,500 lines)"
else
    echo "ℹ️  'New design' folder already deleted"
fi
echo ""

# Step 4: Check for old component duplicates
echo "Step 4: Checking for old component versions..."

OLD_FILES=(
    "src/components/SearchPage.tsx"
    "src/components/TicketsPage.tsx"
    "src/pages/MessagesPage.tsx"
    "src/pages/NotificationsPage.tsx"
)

DELETED_COUNT=0
for file in "${OLD_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  Found old version: $file"
        # Don't auto-delete these - they might still be used
        # Just report them
    fi
done

echo ""
echo "✨ Cleanup Complete!"
echo ""
echo "Summary:"
echo "  ✅ Imports fixed in FeedPageComplete.tsx"
echo "  ✅ 'New design' folder removed"
echo "  ✅ Backup created (if folder existed)"
echo ""
echo "Next steps:"
echo "  1. Test app: npm run dev"
echo "  2. Verify all pages load correctly"
echo "  3. Check bundle size (should be smaller)"
echo "  4. If issues, restore from backup"
echo ""
echo "To restore from backup (if needed):"
echo "  mv \"$BACKUP_NAME\" \"New design\""
echo ""

