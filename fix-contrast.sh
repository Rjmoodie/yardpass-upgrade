#!/bin/bash

# Comprehensive contrast fix script for dark and light modes
# This replaces common low-contrast patterns with more readable values

echo "🎨 Fixing contrast issues across the app..."

# Navigate to project root
cd "$(dirname "$0")"

# Counter for changes
CHANGES=0

# Function to replace and count
replace_pattern() {
    local pattern="$1"
    local replacement="$2"
    local description="$3"
    
    echo "📝 $description"
    local count=$(find src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec grep -l "$pattern" {} \; | wc -l | tr -d ' ')
    
    if [ "$count" -gt 0 ]; then
        find src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' "s/$pattern/$replacement/g" {} \;
        echo "   ✅ Updated $count files"
        CHANGES=$((CHANGES + count))
    else
        echo "   ℹ️  No files found"
    fi
}

# 1. Fix text opacity issues (60% -> 85%)
replace_pattern "text-foreground\/60" "text-foreground/85" "Fixing foreground text 60% → 85%"
replace_pattern "text-muted-foreground\/60" "text-muted-foreground/85" "Fixing muted foreground 60% → 85%"

# 2. Fix white text opacity for dark backgrounds
replace_pattern "text-white\/50" "text-white/80" "Fixing white text 50% → 80%"
replace_pattern "text-white\/60" "text-white/85" "Fixing white text 60% → 85%"
replace_pattern "text-white\/70" "text-white/90" "Fixing white text 70% → 90%"

# 3. Fix border opacity for better visibility
replace_pattern "border-border\/20" "border-border/30" "Fixing borders 20% → 30%"
replace_pattern "border-white\/10" "border-white/20" "Fixing white borders 10% → 20%"

# 4. Fix icon opacity
replace_pattern "text-gray-400" "text-gray-300 dark:text-gray-400" "Fixing gray icon colors for light mode"
replace_pattern "text-gray-500" "text-gray-600 dark:text-gray-400" "Fixing gray-500 for better contrast"

# 5. Fix placeholder text
replace_pattern "placeholder:text-muted-foreground\/50" "placeholder:text-muted-foreground/70" "Fixing placeholder text 50% → 70%"

# 6. Fix secondary text
replace_pattern "text-sm text-muted-foreground" "text-sm text-muted-foreground/90" "Adding opacity to muted text"

# 7. Fix tab inactive states
replace_pattern "text-foreground\/50" "text-foreground/80" "Fixing inactive tabs 50% → 80%"

echo ""
echo "✨ Contrast fixes complete!"
echo "📊 Total files potentially updated: $CHANGES"
echo ""
echo "Next steps:"
echo "1. Run 'npm run dev' to see changes"
echo "2. Test in both light and dark modes"
echo "3. Check for any regressions"

