# 🎨 Liventix Design System - Complete File Map

## 📍 **Files That Control The ENTIRE App Design**

---

## **TIER 1: Global Design Tokens** (Colors, Spacing, Typography)

### **1. `tailwind.config.ts`** ⭐ PRIMARY DESIGN FILE
**Lines:** 265 total  
**Controls:** 90% of visual design

**What's Inside:**
```typescript
colors: {
  neutral: { 900: "#0F172A", ... },    // Gray scale
  brand: { 500: "#DF9D07", ... },      // Liventix amber/gold
  success: "#16A34A",                   // Green
  warning: "#F59E0B",                   // Orange  
  danger: "#DC2626",                    // Red
}

spacing: {
  1: "4px",
  2: "8px",
  4: "16px",
  // ... 8pt grid system
}

fontSize: {
  xs: "0.75rem",     // 12px
  sm: "0.875rem",    // 14px
  base: "1rem",      // 16px
  // ... up to 5xl
}

borderRadius: {
  xs: "4px",
  sm: "6px",
  md: "12px",        // Most cards/buttons
  lg: "16px",
  pill: "9999px",    // Fully rounded
}

animations: {
  "fade-in": ...,
  "slide-up": ...,
  "scale-in": ...,
  // ... 8+ custom animations
}
```

**To Change Design:**
- **Colors:** Edit lines 36-101
- **Spacing:** Edit lines 119-152
- **Typography:** Edit lines 102-118
- **Animations:** Edit lines 222-259

---

### **2. `src/index.css`** 🎨 CSS VARIABLES & GLOBAL STYLES
**Lines:** Varies (can be 30-2500+ lines depending on project)  
**Controls:** CSS custom properties, global resets

**What's Inside:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Design tokens as CSS variables */
  --background: 0 0% 100%;              /* HSL white */
  --foreground: 222.2 84% 4.9%;         /* HSL dark text */
  --primary: 25 95% 53%;                /* Brand orange */
  --radius: 0.5rem;                     /* Default border radius */
  
  /* Safe area insets (iOS notch) */
  --safe-area-inset-top: env(safe-area-inset-top);
  --safe-area-inset-bottom: env(safe-area-inset-bottom);
}

.dark {
  --background: 222.2 84% 4.9%;         /* Dark mode black */
  --foreground: 210 40% 98%;            /* Dark mode white text */
  /* ... all theme variants */
}
```

**To Change Dark Mode:**
- Edit `.dark { }` section (usually lines 200-300)

---

## **TIER 2: Component Design** (Reusable UI Elements)

### **3. `src/components/ui/` Directory** 🧩 UI PRIMITIVES
**Files:** 60+ components  
**Controls:** All reusable UI components

**Key Components:**
```
button.tsx          - All button styles
card.tsx            - Card containers
dialog.tsx          - Modal/dialog styles
sheet.tsx           - Bottom sheets
badge.tsx           - Badges (GA, VIP, Organizer, etc.)
toast.tsx           - Toast notifications
dropdown-menu.tsx   - Dropdown menus
input.tsx           - Form inputs
```

**Most Used:**
- `button.tsx` - Defines all button variants (default, destructive, outline, ghost)
- `card.tsx` - Container styles for all cards
- `badge.tsx` - Tag/pill styles

---

## **TIER 3: Page-Level Design** (Layouts & Screens)

### **4. Feed/Main Screens**
```
src/pages/new-design/
  ├── FeedPageNewDesign.tsx       - Main feed layout
  ├── ProfilePage.tsx              - Profile screen layout
  ├── EventDetailPage.tsx          - Event detail screen
  └── ...

src/components/feed/
  ├── EventCardNewDesign.tsx       - Event card design
  ├── UserPostCardNewDesign.tsx    - Post card design
  ├── FeedCard.tsx                 - Alternative feed card
  └── ...
```

**These control:**
- Screen layouts
- Card styles
- Spacing between elements
- Component composition

---

### **5. Navigation Design**
```
src/components/navigation/
  └── NavigationNewDesign.tsx      - Bottom nav bar design

src/components/nav/
  └── ...                          - Top nav, side nav
```

**Controls:**
- Bottom navigation bar look
- Icons, colors, active states
- Safe area handling (iOS notch)

---

## **TIER 4: Feature-Specific Design**

### **6. Event/Ticket UI**
```
src/components/
  ├── EventCheckoutSheet.tsx       - Ticket purchase modal
  ├── EventCard.tsx                - Event cards
  ├── TicketCard.tsx               - Ticket display
  └── ...
```

### **7. Sponsorship UI**
```
src/components/sponsorship/
  ├── SponsorBadges.tsx            - Sponsor badge design
  ├── SponsorshipMarketplace.tsx   - Marketplace layout
  └── ...
```

---

## 🎯 **Design Hierarchy (What Overrides What)**

```
1. tailwind.config.ts (global tokens)
   ↓ defines
2. src/index.css (CSS variables)
   ↓ used by
3. src/components/ui/* (primitives)
   ↓ composed in
4. src/components/feed/* (feature components)
   ↓ rendered in
5. src/pages/* (screens)
```

**Example Flow:**
```
tailwind.config.ts defines:
  brand.500 = "#DF9D07"
    ↓
src/index.css uses:
  --primary: 25 95% 53%
    ↓
button.tsx uses:
  className="bg-primary"
    ↓
EventCheckoutSheet.tsx renders:
  <Button>Proceed to payment</Button>
    ↓
User sees orange button!
```

---

## 🎨 **Quick Reference: Change Common Design Elements**

### **Change Brand Color (Orange → Blue)**
**File:** `tailwind.config.ts` (Line 52-59)
```typescript
brand: {
  500: "#3B82F6",  // Change from #DF9D07 to blue
}
```

### **Change Dark Mode Background**
**File:** `src/index.css` (Dark mode section)
```css
.dark {
  --background: 0 0% 0%;  /* Pure black */
}
```

### **Change Button Styles**
**File:** `src/components/ui/button.tsx`
```typescript
variants: {
  variant: {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    // Edit this line ↑
  }
}
```

### **Change Card Corners**
**File:** `tailwind.config.ts` (Line 153-170)
```typescript
borderRadius: {
  md: "24px",  // Change from 12px to 24px (rounder cards)
}
```

### **Change Font**
**File:** `tailwind.config.ts` (Line 102-106)
```typescript
fontFamily: {
  sans: ["Montserrat", "system-ui", "sans-serif"],  // Change from Inter
}
```

---

## 📊 **Design File Breakdown**

| File | Controls | Lines | Impact |
|------|----------|-------|--------|
| **tailwind.config.ts** | Colors, spacing, typography, animations | 265 | 90% of design |
| **src/index.css** | CSS variables, global styles, resets | 30-2500 | 70% of styling |
| **src/components/ui/*.tsx** | Component primitives (60 files) | ~3000 | 50% of UI |
| **src/components/feed/*.tsx** | Feed-specific design (10 files) | ~2000 | Feed appearance |
| **src/pages/*.tsx** | Page layouts (20 files) | ~5000 | Screen structure |

---

## 🎯 **Most Important Files for Visual Design**

### **Top 5 Files:**

1. **`tailwind.config.ts`** - Brand colors, spacing, typography ⭐⭐⭐⭐⭐
2. **`src/index.css`** - CSS variables, dark mode ⭐⭐⭐⭐
3. **`src/components/ui/button.tsx`** - Button design ⭐⭐⭐
4. **`src/components/ui/card.tsx`** - Card design ⭐⭐⭐
5. **`src/components/feed/EventCardNewDesign.tsx`** - Feed card design ⭐⭐⭐

---

## 🔍 **Where Specific Designs Are Defined**

### **Feed Card Design:**
**File:** `src/components/feed/EventCardNewDesign.tsx` (218 lines)

**Key Design Elements:**
```tsx
// Background gradient
className="bg-gradient-to-br from-black/70 via-black/60 to-black/70"

// Border & shadow
className="border border-white/10 shadow-2xl"

// Glassmorphism effect
className="backdrop-blur-3xl"

// Rounded corners
className="rounded-3xl"

// Text colors
className="text-white drop-shadow-lg"

// Button style
className="bg-gradient-to-r from-orange-500 to-orange-600"
```

---

### **Bottom Navigation Design:**
**File:** `src/components/navigation/NavigationNewDesign.tsx`

**Key Design:**
```tsx
// Background
className="bg-black/95 backdrop-blur-xl"

// Active state
className="text-orange-500"

// Inactive state
className="text-white/60"

// Icon size
className="h-6 w-6"
```

---

### **Ticket Modal Design:**
**File:** `src/components/EventCheckoutSheet.tsx`

**Key Design:**
```tsx
// Modal container
className="max-w-4xl rounded-2xl shadow-xl"

// Header
className="sticky top-0 z-50 backdrop-blur-md"

// Button
className="bg-gradient-to-r from-orange-500 to-orange-600"
```

---

## 🎨 **Design System Overview**

Your app uses **3 design patterns**:

### **Pattern 1: Utility-First (Tailwind)**
```tsx
<div className="flex items-center gap-3 p-4 bg-black rounded-lg">
  // Design defined inline via Tailwind classes
</div>
```
**Most common** - ~80% of your design

---

### **Pattern 2: Component Variants (CVA)**
```tsx
// button.tsx uses class-variance-authority
const buttonVariants = cva(
  "base styles",
  {
    variants: {
      variant: {
        default: "bg-primary",
        destructive: "bg-red-500",
      }
    }
  }
)
```
**Used in:** `src/components/ui/*`

---

### **Pattern 3: Styled Components (Inline)**
```tsx
<div style={{ 
  background: 'linear-gradient(to-br, rgba(0,0,0,0.7), rgba(0,0,0,0.6))' 
}}>
```
**Rare** - Only for dynamic styles

---

## 📋 **Complete Design File List**

### **Core (5 files):**
1. `tailwind.config.ts` - Design tokens
2. `src/index.css` - Global CSS
3. `postcss.config.js` - CSS processing
4. `src/App.tsx` - Theme provider
5. `src/components/ThemeToggle.tsx` - Dark/light switch

### **UI Primitives (60 files):**
```
src/components/ui/
  - button.tsx, card.tsx, badge.tsx, dialog.tsx, sheet.tsx
  - input.tsx, select.tsx, textarea.tsx, checkbox.tsx
  - toast.tsx, alert.tsx, tooltip.tsx, dropdown-menu.tsx
  - ... (57 more)
```

### **Feed Design (10 files):**
```
src/components/feed/
  - EventCardNewDesign.tsx       (218 lines) ⭐ MAIN EVENT CARD
  - UserPostCardNewDesign.tsx    (394 lines) ⭐ MAIN POST CARD
  - FeedCard.tsx
  - VideoMedia.tsx
  - FloatingActions.tsx
  - ...
```

### **Page Layouts (20+ files):**
```
src/pages/new-design/
  - FeedPageNewDesign.tsx        ⭐ MAIN FEED SCREEN
  - ProfilePage.tsx
  - EventDetailPage.tsx
  - ...
```

### **Navigation (5 files):**
```
src/components/navigation/
  - NavigationNewDesign.tsx      ⭐ BOTTOM NAV BAR
  ...
```

---

## 🎯 **To Change Specific Design Elements**

### **Change Feed Card Look:**
Edit: `src/components/feed/EventCardNewDesign.tsx` (Line 61-215)

### **Change Colors Globally:**
Edit: `tailwind.config.ts` (Line 36-101)

### **Change Button Styles:**
Edit: `src/components/ui/button.tsx`

### **Change Dark Mode:**
Edit: `src/index.css` (`.dark { }` section)

### **Change Spacing/Padding:**
Edit: `tailwind.config.ts` (Line 119-152)

### **Change Bottom Nav:**
Edit: `src/components/navigation/NavigationNewDesign.tsx`

---

## 📁 **File Locations (Quick Access)**

```
liventix-upgrade/
├── tailwind.config.ts          ⭐ DESIGN TOKENS
├── src/
│   ├── index.css               ⭐ GLOBAL CSS
│   ├── App.tsx                 ⭐ THEME PROVIDER
│   ├── components/
│   │   ├── ui/                 🧩 UI PRIMITIVES (60 files)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   └── ...
│   │   ├── feed/               📱 FEED DESIGN
│   │   │   ├── EventCardNewDesign.tsx     ⭐ EVENT CARDS
│   │   │   ├── UserPostCardNewDesign.tsx  ⭐ POST CARDS
│   │   │   └── ...
│   │   ├── navigation/         🧭 NAV DESIGN
│   │   │   └── NavigationNewDesign.tsx    ⭐ BOTTOM NAV
│   │   └── EventCheckoutSheet.tsx         💳 TICKET MODAL
│   └── pages/
│       └── new-design/         📄 PAGE LAYOUTS
│           ├── FeedPageNewDesign.tsx      ⭐ FEED SCREEN
│           ├── ProfilePage.tsx
│           └── ...
```

---

## 🎨 **Design Patterns Used**

### **1. Dark Theme with Glassmorphism**
```tsx
className="
  bg-gradient-to-br from-black/70 via-black/60 to-black/70
  backdrop-blur-3xl
  border border-white/10
  shadow-2xl
"
```
**Used in:** Feed cards, modals, bottom sheets

---

### **2. Orange Brand Accents**
```tsx
className="
  bg-gradient-to-r from-orange-500 to-orange-600
  text-white
  rounded-full
"
```
**Used in:** Primary buttons, CTAs, active states

---

### **3. White Text on Dark**
```tsx
className="
  text-white           (primary text)
  text-white/80        (secondary text)
  text-white/60        (tertiary text)
"
```
**Used in:** All text on dark backgrounds

---

## 🔧 **Common Design Customizations**

### **Make Everything Rounded:**
```typescript
// tailwind.config.ts
borderRadius: {
  DEFAULT: "24px",  // Change from 12px
}
```

### **Change Brand from Orange to Blue:**
```typescript
// tailwind.config.ts
brand: {
  500: "#3B82F6",  // Blue instead of #DF9D07
}
```

### **Lighter Dark Mode:**
```css
/* src/index.css */
.dark {
  --background: 240 10% 10%;  /* Change from 4% to 10% (lighter) */
}
```

### **Different Font:**
```typescript
// tailwind.config.ts
fontFamily: {
  sans: ["Montserrat", "system-ui"],  // Change from Inter
}
```

---

## 📊 **Design Responsibilities**

| Aspect | File | Priority |
|--------|------|----------|
| **Colors** | `tailwind.config.ts` | ⭐⭐⭐⭐⭐ |
| **Spacing** | `tailwind.config.ts` | ⭐⭐⭐⭐⭐ |
| **Typography** | `tailwind.config.ts` | ⭐⭐⭐⭐⭐ |
| **Dark Mode** | `src/index.css` | ⭐⭐⭐⭐ |
| **Buttons** | `src/components/ui/button.tsx` | ⭐⭐⭐⭐ |
| **Cards** | `src/components/ui/card.tsx` | ⭐⭐⭐⭐ |
| **Feed Cards** | `src/components/feed/EventCardNewDesign.tsx` | ⭐⭐⭐⭐ |
| **Bottom Nav** | `src/components/navigation/NavigationNewDesign.tsx` | ⭐⭐⭐ |
| **Modals** | `src/components/ui/dialog.tsx` + `sheet.tsx` | ⭐⭐⭐ |
| **Animations** | `tailwind.config.ts` (keyframes) | ⭐⭐⭐ |

---

## 🎯 **TL;DR: Where to Edit Design**

**Want to change:**
- **Brand colors?** → `tailwind.config.ts` (line 52)
- **Card design?** → `src/components/feed/EventCardNewDesign.tsx`
- **Button styles?** → `src/components/ui/button.tsx`
- **Dark mode?** → `src/index.css` (`.dark` section)
- **Bottom nav?** → `src/components/navigation/NavigationNewDesign.tsx`
- **Spacing/padding?** → `tailwind.config.ts` (line 119)
- **Font?** → `tailwind.config.ts` (line 102)

---

**The main design power is in `tailwind.config.ts` + `src/index.css`!** 🎨

Everything else uses these design tokens. ✅
