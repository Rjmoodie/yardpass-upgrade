# 🎨 Liventix Design System - Complete File Map

## 📂 Core Design Files

### **1. Global Styles & Theme**

#### **`src/index.css`** (2,546 lines) 🎨 MASTER STYLE FILE
**Purpose:** Global CSS, CSS variables, utility classes, animations

**Contains:**
- **CSS Variables:** Colors, spacing, typography
- **Tailwind directives:** `@tailwind base/components/utilities`
- **Custom utilities:** Viewport handling, safe areas, scrolling
- **iOS-specific fixes:** Keyboard handling, viewport height
- **Animations:** Transitions, keyframes
- **Component overrides:** Radix UI, shadcn/ui customizations

**Key Sections:**
```css
:root {
  /* Theme colors */
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 25 95% 53%;         /* Brand orange */
  --secondary: 210 40% 96.1%;
  
  /* Spacing */
  --bottom-nav-h: 84px;
  --bottom-nav-safe: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom));
  
  /* Custom properties */
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --radius: 0.5rem;
}
```

---

#### **`tailwind.config.ts`** (265 lines) ⚙️ TAILWIND CONFIGURATION
**Purpose:** Tailwind CSS customization, design tokens

**Contains:**
- **Color palette:** Brand colors, neutrals, semantics
- **Breakpoints:** Mobile, tablet, desktop
- **Typography:** Font families, sizes, weights
- **Spacing:** Custom spacing scale
- **Animations:** Custom keyframes
- **Plugins:** shadcn/ui plugin

**Key Config:**
```typescript
colors: {
  neutral: { 900: "#0F172A", ... },   // Slate system
  brand: { 600: "#FF8C00", ... },     // Orange brand
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#DC2626",
}

screens: {
  xs: "360px",    // iPhone mini
  sm: "640px",    // Mobile
  md: "768px",    // Tablet
  lg: "1024px",   // Desktop
  xl: "1280px",   // Large desktop
}
```

---

### **2. UI Components (shadcn/ui)**

#### **`src/components/ui/`** (40+ components) 🧩 UI PRIMITIVES
**Purpose:** Reusable UI building blocks based on Radix UI

**Key Components:**
- **`button.tsx`** - All button variants and sizes
- **`card.tsx`** - Card containers
- **`input.tsx`** - Text inputs
- **`dialog.tsx`** - Modals and dialogs
- **`badge.tsx`** - Status badges
- **`tabs.tsx`** - Tab navigation
- **`dropdown-menu.tsx`** - Dropdown menus
- **`sheet.tsx`** - Bottom sheets (mobile)
- **`toast.tsx`** - Toast notifications
- **`skeleton.tsx`** - Loading skeletons

**Example Button Variants:**
```typescript
// From button.tsx
variants: {
  variant: {
    default: "bg-primary text-primary-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    outline: "border border-input bg-background",
    secondary: "bg-secondary text-secondary-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4",
  },
  size: {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
  }
}
```

---

### **3. Layout Components**

#### **`src/App.tsx`** (633 lines) 🏗️ MAIN APP STRUCTURE
**Purpose:** Root component, routing, global layout wrapper

**Contains:**
- Routes definition
- Global providers (Auth, Theme, Analytics)
- Layout wrapper with navigation
- Error boundaries

---

#### **`src/components/Navigation.tsx`** 🧭 BOTTOM NAVIGATION
**Purpose:** Mobile bottom navigation bar

**Features:**
- Platform-aware (shows different items for mobile vs web)
- Active state styling
- Icon + label for each route
- Safe area handling

---

#### **`src/components/web/WebLayout.tsx`** 🌐 WEB LAYOUT
**Purpose:** Desktop/web-specific layout structure

**Features:**
- Top navigation bar
- Yardpass branding
- Navigation items (Feed, Search, Sponsorship, etc.)
- Content container
- Beige background (#FDF8F2)

---

#### **`src/components/PlatformAwareNavigation.tsx`** 📱💻 PLATFORM ROUTING
**Purpose:** Determines which navigation items show based on platform

**Mobile Shows:**
- Feed
- Search  
- Tickets
- Social
- Profile

**Web Shows:**
- Feed
- Search
- Sponsorship
- Analytics
- Dashboard
- Payments
- Profile

---

### **4. Specific Page Layouts**

#### **Feed Pages:**
- **`src/features/feed/components/UnifiedFeedList.tsx`** - Main feed component
- **`src/features/feed/routes/FeedPage.tsx`** - Feed page wrapper
- **`src/components/EventCard.tsx`** - Event cards in feed
- **`src/components/UserPostCard.tsx`** - Post cards in feed

#### **Profile Pages:**
- **`src/pages/UserProfilePage.tsx`** - User profile layout
- **`src/features/profile/routes/ProfilePage.tsx`** - Profile page wrapper
- **`src/features/profile/components/UserProfile.tsx`** - Profile component

#### **Dashboard:**
- **`src/pages/OrganizerDashboard.tsx`** - Organizer dashboard layout
- **`src/features/dashboard/routes/DashboardPage.tsx`** - Dashboard wrapper
- **`src/features/dashboard/components/OrganizationDashboard.tsx`** - Org dashboard

#### **Sponsorship:**
- **`src/pages/web/WebSponsorshipPage.tsx`** - Web sponsorship layout
- **`src/features/marketplace/routes/SponsorshipPage.tsx`** - Sponsorship wrapper

---

### **5. Button-Specific Files**

#### **Primary Button Component:**
**`src/components/ui/button.tsx`**

**All Button Variants:**
```typescript
<Button variant="default">Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon">Icon Only</Button>
```

#### **Specialized Buttons:**
- **`src/components/follow/FollowButton.tsx`** - Follow/Unfollow button
- **`src/components/messaging/MessageButton.tsx`** - Message button
- **`src/components/ActionRail.tsx`** - Like/Comment/Share buttons

---

### **6. Design Tokens Reference**

#### **Colors** (from `tailwind.config.ts` and `src/index.css`):
```typescript
// Brand
--primary: #FF8C00 (Orange)
--primary-glow: #FF9B0F

// Yardpass Specific
--liventix-yellow: #FCD34D
--liventix-beige: #FDF8F2
--liventix-orange: #FF8C00

// Neutrals
--neutral-900: #0F172A (Dark text)
--neutral-50: #F8FAFC (Light bg)

// Semantic
--success: #16A34A (Green)
--warning: #F59E0B (Yellow)
--danger: #DC2626 (Red)
```

#### **Spacing** (from `src/index.css`):
```css
--bottom-nav-h: 84px (mobile: 76px)
--bottom-nav-safe: with safe area insets
--caption-h: 88px
--rail-gap: 14px
```

#### **Typography** (from `tailwind.config.ts`):
```typescript
fontFamily: {
  sans: ["Inter", "system-ui", "sans-serif"],
  heading: ["Cal Sans", "Inter", "sans-serif"],
  mono: ["Fira Code", "monospace"],
}

fontSize: {
  xs: "0.75rem",      // 12px
  sm: "0.875rem",     // 14px  
  base: "1rem",       // 16px
  lg: "1.125rem",     // 18px
  xl: "1.25rem",      // 20px
  "2xl": "1.5rem",    // 24px
  "3xl": "1.875rem",  // 30px
  "4xl": "2.25rem",   // 36px
}
```

#### **Border Radius** (from `src/index.css`):
```css
--radius: 0.5rem (default)

/* Custom radii */
rounded-none: 0
rounded-sm: 0.125rem
rounded: 0.25rem
rounded-md: 0.375rem
rounded-lg: 0.5rem
rounded-xl: 0.75rem
rounded-2xl: 1rem
rounded-3xl: 1.5rem
rounded-full: 9999px
```

---

### **7. Animation Files**

#### **`src/index.css`** - Contains keyframes:
```css
@keyframes shimmer { ... }
@keyframes slide-up { ... }
@keyframes slide-down { ... }
@keyframes fade-in { ... }
@keyframes bounce-subtle { ... }
```

#### **`tailwind.config.ts`** - Animation utilities:
```typescript
animation: {
  "shimmer": "shimmer 2s linear infinite",
  "slide-up": "slide-up 0.3s ease-out",
  "fade-in": "fade-in 0.2s ease-in",
}
```

---

### **8. Responsive Design Files**

#### **Mobile-Specific:**
- **`src/components/layouts/MobileLayout.tsx`** - Mobile app layout
- **`src/components/nav/BottomTabs.tsx`** - Bottom tab navigation
- **`src/components/gates/MobileOnly.tsx`** - Mobile-only wrapper

#### **Web-Specific:**
- **`src/components/web/WebLayout.tsx`** - Web desktop layout
- **`src/app/layouts/WebLayout.tsx`** - Alternative web layout
- **`src/components/gates/WebOnly.tsx`** - Web-only wrapper

#### **Platform Detection:**
- **`src/hooks/usePlatform.ts`** - Detects mobile/web/capacitor
- **`src/hooks/use-mobile.ts`** - Simple mobile detection
- **`src/components/PlatformWrapper.tsx`** - Platform conditional rendering

---

### **9. Component-Specific Styles**

#### **Cards:**
- **`src/components/ui/card.tsx`** - Card component
- **`src/components/EventCard.tsx`** - Event-specific card styling
- **`src/components/UserPostCard.tsx`** - Post-specific card styling

#### **Forms:**
- **`src/components/ui/input.tsx`** - Input fields
- **`src/components/ui/textarea.tsx`** - Text areas
- **`src/components/ui/select.tsx`** - Select dropdowns
- **`src/components/ui/switch.tsx`** - Toggle switches
- **`src/components/ui/slider.tsx`** - Range sliders

#### **Navigation:**
- **`src/components/ui/tabs.tsx`** - Tab components
- **`src/components/ui/navigation-menu.tsx`** - Navigation menus
- **`src/components/ui/breadcrumb.tsx`** - Breadcrumbs

---

## 🎯 Quick Reference: Where to Change What

| What You Want to Change | File to Edit |
|------------------------|--------------|
| **Brand colors** | `tailwind.config.ts` → colors.brand |
| **Global spacing** | `src/index.css` → :root variables |
| **Button styles** | `src/components/ui/button.tsx` |
| **Card styles** | `src/components/ui/card.tsx` |
| **Typography** | `tailwind.config.ts` → theme.fontSize |
| **Mobile nav items** | `src/components/PlatformAwareNavigation.tsx` |
| **Web nav layout** | `src/components/web/WebLayout.tsx` |
| **Feed layout** | `src/features/feed/components/UnifiedFeedList.tsx` |
| **Dark mode** | `src/index.css` → `.dark { ... }` section |
| **Animations** | `src/index.css` → @keyframes |
| **Breakpoints** | `tailwind.config.ts` → theme.screens |
| **Safe areas (iOS)** | `src/index.css` → env(safe-area-inset-*) |

---

## 🎨 Design System Hierarchy

```
┌─────────────────────────────────────────┐
│  1. tailwind.config.ts                  │  ← Design tokens
│     (colors, spacing, typography)       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. src/index.css                       │  ← Global styles
│     (CSS variables, utilities)          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3. src/components/ui/*.tsx             │  ← UI primitives
│     (buttons, cards, inputs)            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  4. Layout Components                   │  ← Page structures
│     (WebLayout, Navigation, etc.)       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  5. Feature Components                  │  ← Specific features
│     (Feed, Profile, Dashboard)          │
└─────────────────────────────────────────┘
```

---

## 🔧 Common Design Modifications

### **Change Brand Color:**
1. Edit `tailwind.config.ts`:
```typescript
colors: {
  brand: {
    600: "#YOUR_COLOR",  // ← Change this
  }
}
```

2. Edit `src/index.css`:
```css
:root {
  --primary: 25 95% 53%;  /* ← Adjust HSL values */
}
```

### **Modify Button Styles:**
Edit `src/components/ui/button.tsx`:
```typescript
variants: {
  variant: {
    default: "bg-primary ...",  // ← Customize classes
  }
}
```

### **Update Layout:**

**Mobile:** Edit `src/components/Navigation.tsx`
**Web:** Edit `src/components/web/WebLayout.tsx`

### **Change Typography:**
Edit `tailwind.config.ts`:
```typescript
fontFamily: {
  sans: ["Your Font", "fallback"],
}
```

---

## 📱 Platform-Specific Design

### **Mobile Design Files:**
- `src/components/Navigation.tsx` - Bottom nav bar
- `src/components/layouts/MobileLayout.tsx` - Mobile wrapper
- `src/components/gates/MobileOnly.tsx` - Mobile-only components

### **Web Design Files:**
- `src/components/web/WebLayout.tsx` - Web header & layout
- `src/app/layouts/WebLayout.tsx` - Alternative web layout  
- `src/components/gates/WebOnly.tsx` - Web-only components

### **Shared Design:**
- `src/components/ui/` - Works on both platforms
- `tailwind.config.ts` - Universal design tokens
- `src/index.css` - Global styles with responsive breakpoints

---

## 🎯 File Priority (What to Edit First)

### **🔴 High Impact - Most Commonly Changed:**
1. **`tailwind.config.ts`** - Brand colors, spacing
2. **`src/components/web/WebLayout.tsx`** - Web navigation
3. **`src/components/Navigation.tsx`** - Mobile navigation
4. **`src/components/ui/button.tsx`** - Button styles

### **🟡 Medium Impact - Occasional Changes:**
5. **`src/index.css`** - Global variables, custom utilities
6. **`src/components/ui/card.tsx`** - Card styling
7. **Layout components** - Page structures

### **🟢 Low Impact - Rarely Changed:**
8. **Other UI components** - Specific inputs, dialogs
9. **Animation definitions** - Keyframes
10. **Platform detection** - Logic files

---

## 🎨 Current Design System

### **Brand Identity:**
- **Primary Color:** Orange (#FF8C00)
- **Secondary Color:** Yellow (#FCD34D)
- **Background:** Beige (#FDF8F2) for web
- **Typography:** Inter (sans), Cal Sans (headings)
- **Design Style:** Clean, modern, mobile-first

### **Component Style:**
- **Rounded corners:** Default 0.5rem (md)
- **Shadows:** Subtle elevation
- **Borders:** Minimal, light gray
- **Hover states:** Subtle transitions
- **Focus states:** Ring outline (accessibility)

### **Spacing System:**
- **Base unit:** 4px (Tailwind default)
- **Common gaps:** 2, 4, 6, 8, 12, 16, 24px
- **Safe areas:** iOS notch/home indicator handled

---

## 📚 Related Files

### **Theme Provider:**
- **`src/app/providers/ThemeProvider.tsx`** - Dark mode toggle
- Theme controlled via `next-themes` library

### **Utility Functions:**
- **`src/lib/utils.ts`** - `cn()` for class merging
- **`src/lib/constants.ts`** - Design constants (DEFAULT_EVENT_COVER, etc.)

### **Icons:**
- **Library:** lucide-react
- **Usage:** Import from `'lucide-react'`
- **Examples:** `Bell`, `Home`, `Search`, `User`, `Settings`

---

## 🚀 Quick Start: Customizing Design

### **1. Change Brand Color:**
```bash
# Edit these 2 files:
tailwind.config.ts → colors.brand
src/index.css → --primary variable
```

### **2. Modify Web Navigation:**
```bash
# Edit:
src/components/web/WebLayout.tsx
```

### **3. Change Mobile Navigation:**
```bash
# Edit:
src/components/Navigation.tsx
src/components/PlatformAwareNavigation.tsx
```

### **4. Update Button Styles:**
```bash
# Edit:
src/components/ui/button.tsx
```

### **5. Global Style Changes:**
```bash
# Edit:
src/index.css (CSS variables, utilities)
tailwind.config.ts (Tailwind config)
```

---

## ✨ Pro Tips

1. **Use Tailwind classes** for most styling (don't write custom CSS)
2. **Modify design tokens first** (colors, spacing) before component styles
3. **Test on mobile AND web** after design changes
4. **Use browser DevTools** to inspect computed styles
5. **Check dark mode** if you modify colors

---

**Last Updated:** After systematic fixes
**Design System:** shadcn/ui + Tailwind CSS + Custom Yardpass theme

