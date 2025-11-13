#!/bin/bash
# Replace all orange colors with blue (#1171c0) across the app

echo "🎨 Replacing all orange colors with blue..."

# Replace Tailwind classes
find src -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \) -exec sed -i '' \
  -e 's/bg-orange-50/bg-brand-50/g' \
  -e 's/bg-orange-100/bg-brand-100/g' \
  -e 's/bg-orange-200/bg-brand-200/g' \
  -e 's/bg-orange-300/bg-brand-300/g' \
  -e 's/bg-orange-400/bg-brand-400/g' \
  -e 's/bg-orange-500/bg-brand-500/g' \
  -e 's/bg-orange-600/bg-brand-600/g' \
  -e 's/bg-orange-700/bg-brand-700/g' \
  -e 's/bg-orange-800/bg-brand-800/g' \
  -e 's/bg-orange-900/bg-brand-900/g' \
  -e 's/text-orange-50/text-brand-50/g' \
  -e 's/text-orange-100/text-brand-100/g' \
  -e 's/text-orange-200/text-brand-200/g' \
  -e 's/text-orange-300/text-brand-300/g' \
  -e 's/text-orange-400/text-brand-400/g' \
  -e 's/text-orange-500/text-brand-500/g' \
  -e 's/text-orange-600/text-brand-600/g' \
  -e 's/text-orange-700/text-brand-700/g' \
  -e 's/text-orange-800/text-brand-800/g' \
  -e 's/text-orange-900/text-brand-900/g' \
  -e 's/border-orange-50/border-brand-50/g' \
  -e 's/border-orange-100/border-brand-100/g' \
  -e 's/border-orange-200/border-brand-200/g' \
  -e 's/border-orange-300/border-brand-300/g' \
  -e 's/border-orange-400/border-brand-400/g' \
  -e 's/border-orange-500/border-brand-500/g' \
  -e 's/border-orange-600/border-brand-600/g' \
  -e 's/border-orange-700/border-brand-700/g' \
  -e 's/border-orange-800/border-brand-800/g' \
  -e 's/border-orange-900/border-brand-900/g' \
  -e 's/from-orange-/from-brand-/g' \
  -e 's/to-orange-/to-brand-/g' \
  -e 's/via-orange-/via-brand-/g' \
  -e 's/ring-orange-/ring-brand-/g' \
  -e 's/hover:bg-orange-/hover:bg-brand-/g' \
  -e 's/hover:text-orange-/hover:text-brand-/g' \
  -e 's/hover:border-orange-/hover:border-brand-/g' \
  {} +

echo "✅ All orange Tailwind classes replaced with brand (blue)"
echo "🔄 Restart your dev server for changes to take effect"

