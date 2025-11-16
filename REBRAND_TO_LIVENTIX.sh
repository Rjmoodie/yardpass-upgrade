#!/bin/bash
# 🎨 REBRAND: Liventix → Liventix
# ================================
# This script renames all instances of Liventix to Liventix

set -e

echo "🎨 REBRANDING Liventix → Liventix"
echo "=================================="
echo ""
echo "⚠️  WARNING: This will modify 362 files with 1,240 replacements!"
echo ""
read -p "Are you sure you want to continue? (type 'YES' to confirm): " confirm

if [ "$confirm" != "YES" ]; then
  echo "❌ Rebrand cancelled."
  exit 0
fi

echo ""
echo "📋 Starting rebrand..."
echo ""

# Function to replace text in files
replace_in_files() {
  local old_text="$1"
  local new_text="$2"
  local description="$3"
  
  echo "🔄 Replacing '$old_text' → '$new_text' ($description)..."
  
  # Use find with -type f to only process files, exclude node_modules, .git, dist, build
  find . -type f \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -not -path "*/.next/*" \
    -not -path "*/coverage/*" \
    -exec grep -l "$old_text" {} \; 2>/dev/null | while read file; do
    
    # Use sed for in-place replacement (BSD sed for macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS
      sed -i '' "s|$old_text|$new_text|g" "$file"
    else
      # Linux
      sed -i "s|$old_text|$new_text|g" "$file"
    fi
    
    echo "  ✓ Updated: $file"
  done
}

# 1. Replace brand name variants
replace_in_files "Liventix" "Liventix" "Standard case"
replace_in_files "yardpass" "liventix" "Lowercase"
replace_in_files "YARDPASS" "LIVENTIX" "Uppercase"
replace_in_files "Yardpass" "Liventix" "Sentence case"

# 2. Replace URL/domain references (if you want to keep old URLs, skip this)
# replace_in_files "yardpass.com" "liventix.com" "Domain"
# replace_in_files "yardpass.co" "liventix.co" "Alt domain"

# 3. Replace file path references (be careful with this)
# replace_in_files "yard_pass" "liventix" "File paths"

echo ""
echo "✅ Rebrand complete!"
echo ""
echo "📊 Summary:"
echo "  - Replaced: Liventix → Liventix"
echo "  - Replaced: yardpass → liventix"
echo "  - Replaced: YARDPASS → LIVENTIX"
echo "  - Replaced: Yardpass → Liventix"
echo ""
echo "📋 Next steps:"
echo "  1. Review changes with: git diff"
echo "  2. Update package.json manually (app ID, name)"
echo "  3. Update capacitor.config.ts (appId, appName)"
echo "  4. Update manifest.json (name, short_name)"
echo "  5. Update index.html (<title> tag)"
echo "  6. Replace logo images in public/ folder"
echo "  7. Test the app thoroughly"
echo "  8. Commit changes: git add . && git commit -m 'Rebrand: Liventix → Liventix'"
echo ""
echo "🎨 Your app is now Liventix! 🚀"



