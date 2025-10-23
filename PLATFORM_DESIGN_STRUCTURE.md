# YardPass Platform-Specific Design Structure (Revamped)

## Overview

YardPass uses a **platform-aware architecture** with one codebase that adapts to different platforms:
- **Mobile App** = Social, discovery-first, consumer-focused (TikTok-like)
- **Desktop Web** = Management, analytics-heavy, professional (Eventbrite-like)

**Key Principle:** Capability-gated, not device-gated. Features are controlled by input method, screen size, and hardware capabilities—not naive user-agent checks.

---

## 1) Core Principles

### ✅ One Codebase, Platform-Aware UI
- Shared design tokens and components
- Divergent layouts, navigation, and capabilities
- Feature-first file organization

### ✅ Capability-Gated, Not Device-Gated
- Gate features by input (keyboard/mouse, touch, camera access)
- Use viewport classes and feature detection
- Avoid UA string parsing

### ✅ Upsell > Block
- Always provide a path (view-only, summary, export)
- Never dead-end users
- Show value proposition for unavailable features

---

## 2) Architecture Overview

### **File Structure**
```
src/
├── app/                            # Providers & top-level layouts
│   ├── providers/
│   │   └── ThemeProvider.tsx
│   ├── layouts/
│   │   ├── WebLayout.tsx           # Desktop/top-nav shell
│   │   └── MobileLayout.tsx        # Bottom-nav shell
│   └── routes.tsx
│
├── hooks/
│   ├── usePlatform.ts              # Robust platform & capability detection
│   └── useCapabilities.ts          # camera, haptics, nfc, touch, pointer type
│
├── components/
│   ├── nav/
│   │   ├── PlatformAwareNavigation.tsx
│   │   ├── BottomTabs.tsx          # mobile
│   │   └── TopBar.tsx              # web
│   ├── gates/
│   │   ├── WebOnly.tsx
│   │   └── MobileOnly.tsx
│   └── ui/                         # shadcn/ui + wrappers
│
├── features/                       # Feature-first organization
│   ├── feed/                       # shared; mobile emphasizes media
│   ├── marketplace/
│   ├── sponsorship/
│   ├── matches/
│   ├── proposals/
│   ├── deals/                      # escrow & milestones
│   ├── analytics/                  # richer on web
│   ├── ticketing/                  # wallet, scanner (mobile), seatmap (web)
│   ├── profile/
│   └── settings/
│
└── styles/
    └── index.css                   # design tokens (CSS vars)
```

**Why this structure?**
- Feature-first keeps logic, UI, hooks, and routes co-located per domain
- Platform-specific routes and layouts diverge cleanly
- Shared components remain agnostic
- Easy to maintain and scale

---

## 3) Platform & Capability Detection

### **usePlatform Hook (Revamped)**
**File:** `src/hooks/usePlatform.ts`

**Key Improvements:**
- ✅ Feature detection over UA parsing
- ✅ Uses `matchMedia` and `navigator.maxTouchPoints`
- ✅ Reads Tailwind breakpoints for layout decisions
- ✅ Exposes pointer type (coarse vs fine) for density

```typescript
export type Platform = 'web' | 'native';
export type Screen = 'mobile' | 'tablet' | 'desktop';
export type PointerType = 'coarse' | 'fine';

export interface PlatformInfo {
  platform: Platform;
  isNative: boolean;
  isWeb: boolean;
  screen: Screen;
  isMobile: boolean;
  isDesktop: boolean;
  pointer: PointerType;
}

export function usePlatform(): PlatformInfo {
  const isNative = typeof (window as any).Capacitor !== 'undefined';
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const lg = window.matchMedia('(min-width: 1024px)').matches;
  const md = window.matchMedia('(min-width: 768px)').matches;

  const screen: Screen = lg ? 'desktop' : md ? 'tablet' : 'mobile';

  return {
    platform: isNative ? 'native' : 'web',
    isNative,
    isWeb: !isNative,
    screen,
    isMobile: screen === 'mobile',
    isDesktop: screen === 'desktop',
    pointer: coarse ? 'coarse' : 'fine',
  } as const;
}

// Convenience hooks
export const useIsWeb = () => usePlatform().isWeb;
export const useIsMobile = () => usePlatform().isMobile;
export const useIsNative = () => usePlatform().isNative;
export const useIsDesktop = () => usePlatform().isDesktop;
```

### **useCapabilities Hook**
**File:** `src/hooks/useCapabilities.ts`

```typescript
export interface Capabilities {
  camera: boolean;
  nfc: boolean;
  haptics: boolean;
  payments: boolean;
  geolocation: boolean;
  notifications: boolean;
}

export function useCapabilities(): Capabilities {
  return {
    camera: !!(navigator.mediaDevices?.getUserMedia),
    nfc: 'NDEFReader' in window,
    haptics: 'vibrate' in navigator,
    payments: 'PaymentRequest' in window,
    geolocation: 'geolocation' in navigator,
    notifications: 'Notification' in window,
  } as const;
}
```

**Usage:**
```typescript
const { camera, haptics } = useCapabilities();

if (camera) {
  // Show scanner
} else {
  // Show QR code image + "Open in App" link
}
```

---

## 4) Routing & Gating

### **Platform-Aware Routes**
**File:** `src/app/routes.tsx`

```tsx
import { Route, Routes } from 'react-router-dom';
import { WebOnly, MobileOnly } from '@/components/gates';
import { UpsellDesktop, UpsellMobile } from '@/components/Upsells';

// Shared routes (available on both)
<Route path="/" element={<FeedPage />} />
<Route path="/search" element={<SearchPage />} />
<Route path="/e/:id" element={<EventSlugPage />} />
<Route path="/u/:username" element={<ProfilePage />} />

// Web-only routes (management, analytics, admin)
<Route 
  path="/analytics" 
  element={
    <WebOnly fallback={<UpsellDesktop feature="Analytics" />}>
      <AnalyticsPage />
    </WebOnly>
  } 
/>

<Route 
  path="/deals/:dealId/escrow" 
  element={
    <WebOnly fallback={<UpsellDesktop feature="Escrow Management" />}>
      <EscrowPage />
    </WebOnly>
  } 
/>

<Route 
  path="/admin" 
  element={
    <WebOnly fallback={<UpsellDesktop feature="Admin Dashboard" />}>
      <AdminDashboard />
    </WebOnly>
  } 
/>

// Mobile-only routes (scanner, wallet, social)
<Route 
  path="/scanner/:eventId" 
  element={
    <MobileOnly fallback={<UpsellMobile feature="Scanner" />}>
      <ScannerPage />
    </MobileOnly>
  } 
/>

<Route 
  path="/wallet" 
  element={
    <MobileOnly fallback={<UpsellMobile feature="Wallet" />}>
      <WalletPage />
    </MobileOnly>
  } 
/>
```

### **Gate Components**
**File:** `src/components/gates/WebOnly.tsx`

```tsx
import { usePlatform } from '@/hooks/usePlatform';

interface WebOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function WebOnly({ children, fallback }: WebOnlyProps) {
  const { isDesktop } = usePlatform();
  
  if (!isDesktop) {
    return fallback || <UpsellDesktop />;
  }
  
  return <>{children}</>;
}
```

**File:** `src/components/gates/MobileOnly.tsx`

```tsx
import { usePlatform } from '@/hooks/usePlatform';

interface MobileOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function MobileOnly({ children, fallback }: MobileOnlyProps) {
  const { isMobile } = usePlatform();
  
  if (!isMobile) {
    return fallback || <UpsellMobile />;
  }
  
  return <>{children}</>;
}
```

---

## 5) Navigation Patterns

### **Mobile Navigation (Primary - Social/Discovery)**
**File:** `src/components/nav/BottomTabs.tsx`

**Features:**
- Bottom tab bar with 5 icons
- Action FAB contextually appears (create post, scan, buy)
- Bottom sheets for filters, details, purchase
- Safe area padding
- Touch-optimized (min 44px tap targets)

**Tabs:**
1. **Home/Feed** - Activity feed, real-time updates
2. **Search** - Discover events, sponsors
3. **Tickets** - Wallet, QR codes, passes
4. **Notifications** - Alerts, mentions, deal updates
5. **Profile** - Settings, preferences

```tsx
import { Home, Search, Ticket, Bell, User } from 'lucide-react';

export function BottomTabs() {
  const tabs = [
    { id: 'feed', path: '/', icon: Home, label: 'Home' },
    { id: 'search', path: '/search', icon: Search, label: 'Search' },
    { id: 'tickets', path: '/tickets', icon: Ticket, label: 'Tickets' },
    { id: 'notifications', path: '/notifications', icon: Bell, label: 'Alerts' },
    { id: 'profile', path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around bg-background/90 backdrop-blur-md border-t border-border pb-safe-or-2 h-16">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className="flex flex-col items-center gap-1 p-2 min-w-[56px] touch-manipulation"
        >
          <tab.icon className="h-5 w-5" />
          <span className="text-xs">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
```

---

### **Web Navigation (Management)**
**File:** `src/components/nav/TopBar.tsx`

**Features:**
- Sticky top navigation bar
- Global search/command palette (⌘K)
- Notifications dropdown
- Quick create menu
- Theme toggle
- Profile menu
- Optional left sidebar for deep IA
- Breadcrumbs for nested areas

**Items:**
- Feed (with subtitle: "Live updates across events")
- Search ("Find events, people, and sponsors")
- Sponsorship ("Marketplace & proposals")
- Analytics ("Deep performance reporting" + "Web" badge)
- Dashboard ("Manage events & teams")
- Payments ("Disbursements & escrow")
- Profile ("Account preferences")

```tsx
import { Search, Bell, Plus, Moon, User } from 'lucide-react';
import { CommandK } from '@/components/CommandK';

export function TopBar() {
  return (
    <nav className="sticky top-0 z-50 bg-background border-b border-border">
      {/* Category bar (optional) */}
      <div className="border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <span>Content Creation</span>
          <span>Trading & Investing</span>
          <span>Coding</span>
          <span>Personal</span>
          <span>Business</span>
        </div>
      </div>

      {/* Main nav bar */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">Y</span>
            </div>
            <span className="text-xl font-bold">YardPass</span>
            <span className="text-xs text-muted-foreground bg-accent/10 px-2 py-1 rounded-full">
              Now in Beta
            </span>
          </div>

          {/* Nav items */}
          <div className="flex items-center gap-6">
            <button className="text-sm font-medium hover:text-primary">Feed</button>
            <button className="text-sm font-medium hover:text-primary">Search</button>
            <button className="text-sm font-medium hover:text-primary">Sponsorship</button>
            <button className="text-sm font-medium hover:text-primary">
              Analytics <span className="text-xs text-muted-foreground ml-1">Web</span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button onClick={() => openCommandK()}>
              <Search className="h-5 w-5" />
            </button>
            <button>
              <Bell className="h-5 w-5" />
            </button>
            <button>
              <Plus className="h-5 w-5" />
            </button>
            <button>
              <Moon className="h-5 w-5" />
            </button>
            <button>
              <User className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

---

## 6) Design Tokens (CSS Variables)

### **No Hard-Coded Colors**
**File:** `src/styles/index.css`

All colors are tokenized using CSS custom properties for easy theming and dark mode support.

```css
:root {
  /* Surfaces */
  --bg: 0 0% 100%;
  --bg-elev: 240 5% 98%;
  --bg-subtle: 240 4.8% 95.9%;
  --fg: 240 10% 3.9%;
  
  /* Brand */
  --primary: 42 96% 52%;         /* YardPass yellow/orange */
  --primary-foreground: 0 0% 100%;
  --accent: 221 83% 53%;          /* Blue */
  --accent-foreground: 0 0% 100%;
  --muted: 240 4% 46%;
  --success: 142 72% 29%;
  --warning: 38 92% 50%;
  --danger: 0 84% 57%;
  
  /* Surfaces (optional warm variant) */
  --surface-warm: 38 44% 96%;     /* Tokenized beige instead of #FDF8F2 */
  
  /* Borders & Focus */
  --border: 240 5% 90%;
  --ring: 221 83% 70%;
  
  /* Elevation shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}

.dark {
  --bg: 240 10% 4%;
  --bg-elev: 240 8% 8%;
  --bg-subtle: 240 7% 12%;
  --fg: 0 0% 100%;
  --border: 240 10% 18%;
  --surface-warm: 240 8% 10%;
}
```

### **Typography**
```css
:root {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

/* Sizes use Tailwind scale with tighter leading on data-dense views */
.text-dense {
  line-height: 1.4;
}
```

### **Spacing & Density**
```css
/* 4pt grid; roomy on marketing, denser on tables */
:root {
  --spacing-comfortable: 1rem;
  --spacing-compact: 0.5rem;
}

.density-comfortable {
  padding: var(--spacing-comfortable);
}

.density-compact {
  padding: var(--spacing-compact);
}
```

### **Elevation**
```css
/* 0/1/2 shadow tiers; use focus rings for accessibility, not shadows */
.elevation-0 { box-shadow: none; }
.elevation-1 { box-shadow: var(--shadow-sm); }
.elevation-2 { box-shadow: var(--shadow-md); }
```

---

## 7) Layouts

### **WebLayout (Desktop)**
**File:** `src/app/layouts/WebLayout.tsx`

```tsx
export function WebLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <TopBar />
      
      {/* Optional Context Bar (filters/actions) */}
      <div className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-16">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Breadcrumbs, filters, actions */}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Optional Footer */}
      <footer className="border-t border-border bg-bg-subtle">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Footer content */}
        </div>
      </footer>
    </div>
  );
}
```

**Features:**
- Sticky top bar
- Optional category row
- Max-width container (7xl = 1280px)
- Context bar for filters/actions
- Slots: TopBar, ContextBar, Content, Footer

---

### **MobileLayout (App)**
**File:** `src/app/layouts/MobileLayout.tsx`

```tsx
export function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background no-page-bounce">
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20 scroll-area">
        {children}
      </main>

      {/* Bottom Tabs */}
      <BottomTabs />
    </div>
  );
}
```

**Features:**
- Full-screen vertical scroll
- Bottom tabs (fixed)
- Safe-area paddings (`pb-safe-or-2`)
- Pull-to-refresh affordances
- Uses `ResponsiveBottomSheet` for modal content

---

## 8) Feature Distribution Table

### **Comprehensive Feature Matrix**

| Feature | Mobile App | Desktop Web | Notes |
|---------|-----------|-------------|-------|
| **Discovery & Feed** |
| Activity Feed | ✅ Primary | ⚠️ Summary | Web shows list + filters; no heavy media editor |
| Event Discovery | ✅ Cards | ✅ Grid | Mobile: vertical list, Web: 3-4 col grid |
| Search | ✅ Full | ✅ Full | Different list/grid densities |
| **Sponsorship** |
| Browse Marketplace | ✅ Optimized | ✅ Full Grid | Mobile: vertical list, Web: 3-4 col grid |
| View Package Details | ✅ Modal | ✅ Page | Mobile: bottom sheet, Web: full page |
| Send Proposal | ⚠️ Chat | ✅ Rich | Web: attachments, templates, comparator |
| Negotiate | ⚠️ Chat View | ✅ Thread View | Web: side-by-side comparison |
| Create Package | ❌ None | ✅ Full Form | Desktop-only |
| Match Suggestions | ✅ Basic | ✅ Full | Web: detailed breakdown, explainability |
| **Ticketing** |
| Ticket Purchase | ✅ Optimized | ✅ Supported | Mobile-first Apple/Google Pay; web supports cards + invoicing |
| Wallet & Passes | ✅ Native | ⚠️ View Only | Mobile: QR/NFC, Web: QR image only |
| Scanner | ✅ Native | ❌ None | Camera access required (mobile only) |
| Seat Maps | ⚠️ View | ✅ Interactive | Web: full seat selection |
| Check-In | ✅ Primary | ⚠️ Basic | Mobile: haptics, camera, real-time |
| **Analytics & Reporting** |
| Dashboard KPIs | ⚠️ Summary Cards | ✅ Full | Web: charts, tables, exports |
| Deep Analytics | ❌ None | ✅ Full Dashboard | Desktop-only |
| Reports & Exports | ❌ | ✅ | CSV, PDF generation |
| Attribution | ⚠️ View | ✅ Manage | UTM, coupon codes, QR scans |
| **Deals & Escrow** |
| View Deals | ✅ List | ✅ Kanban/Table | Web: multiple views, density toggle |
| Escrow Timeline | ⚠️ View Only | ✅ Full Control | Desktop-only actions (fund, release, dispute) |
| Milestones | ⚠️ View | ✅ Manage | Approvals, schedules on web |
| Deliverables | ⚠️ View | ✅ Track & Approve | Web: proof uploads, approval workflow |
| **Management** |
| Create Event | ⚠️ Basic | ✅ Full Wizard | Web: multi-step, rich editor |
| Edit Event | ⚠️ Limited | ✅ Full Editor | Desktop for complex edits |
| Team Management | ❌ None | ✅ Full Manager | Roles, permissions, invites |
| Payouts | ⚠️ View | ✅ Manage | Schedules, refunds, Stripe Connect |
| Admin Dashboard | ❌ None | ✅ Full Access | Desktop-only |
| **Social & Content** |
| Post Content | ✅ Camera | ⚠️ Upload | Mobile: in-app camera, filters |
| View Posts | ✅ Primary | ✅ Supported | Mobile: full-screen media player |
| Comments | ✅ Inline | ✅ Inline | Both platforms |
| Mentions | ✅ Full | ✅ Full | Both platforms |
| **Notifications** |
| Push Notifications | ✅ Native | ⚠️ Web Push | Mobile: full OS integration |
| In-App Alerts | ✅ Full | ✅ Full | Both platforms |
| Email Digest | ✅ | ✅ | Both platforms |

**Legend:**
- ✅ Full support, optimized
- ⚠️ Limited or view-only
- ❌ Not available (with upsell)

---

## 9) Upsell & Fallback Patterns

### **Desktop Upsell (shown on mobile)**
```tsx
export function UpsellDesktop({ feature }: { feature: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center space-y-4 rounded-2xl border border-dashed border-border/70 bg-muted/10 p-8 text-center">
      <BarChart3 className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Available on Desktop</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {feature} includes advanced tools like charts, exports, and team management that work best on desktop.
      </p>
      <p className="text-xs text-muted-foreground">
        Visit <strong>yardpass.tech</strong> from a desktop browser to unlock these features.
      </p>
      <Button variant="outline" size="sm" onClick={() => {
        window.open('https://yardpass.tech/analytics', '_blank');
      }}>
        Open on Desktop
      </Button>
    </div>
  );
}
```

### **Mobile Upsell (shown on web)**
```tsx
export function UpsellMobile({ feature }: { feature: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center space-y-4 rounded-2xl border border-dashed border-border/70 bg-muted/10 p-8 text-center">
      <Smartphone className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Designed for Mobile</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {feature} is optimized for the YardPass mobile app with camera access, haptics, and native wallet integration.
      </p>
      <div className="flex gap-3 mt-4">
        <Button variant="default" size="sm" onClick={() => {
          window.open('https://apps.apple.com/yardpass', '_blank');
        }}>
          Download on App Store
        </Button>
        <Button variant="outline" size="sm" onClick={() => {
          window.open('https://play.google.com/yardpass', '_blank');
        }}>
          Get on Google Play
        </Button>
      </div>
    </div>
  );
}
```

### **Fallback Strategies**
1. **Web fallback for Scanner:** Show QR code image + "Open in App" deep link
2. **Mobile fallback for Analytics:** Summary cards + "View Full Report on Desktop"
3. **Mobile fallback for Rich Editors:** Show last version, allow comments, defer editing to web
4. **Web fallback for Camera:** Upload from file picker

---

## 10) Motion & Micro-Interactions

### **Duration Standards**
```css
:root {
  --duration-fast: 120ms;      /* tap feedback */
  --duration-normal: 200ms;    /* modal/sheet */
  --duration-slow: 300ms;      /* page transitions */
}
```

### **Easings**
```css
:root {
  --ease-out: cubic-bezier(0, 0, 0.2, 1);  /* enter */
  --ease-in: cubic-bezier(0.4, 0, 1, 1);   /* exit */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* draggable */
}
```

### **Examples**
- **Save/Pin:** Icon morph (120ms) + toast with undo
- **Escrow change:** Timeline node pulses once
- **Feed new items:** Slide-in from top with unread bar
- **Modal enter:** Scale from 0.95 to 1 (200ms, ease-out)
- **Sheet:** Slide up from bottom (300ms, spring)

---

## 11) Accessibility & Performance

### **Accessibility (WCAG 2.1 AA)**
- ✅ Color contrast ≥ 4.5:1 for text
- ✅ Focus rings on all interactive elements
- ✅ Keyboard navigation for all actions
- ✅ Screen reader labels and ARIA attributes
- ✅ `prefers-reduced-motion` support
- ✅ `prefers-contrast` support

### **Performance**
- ✅ Skeletons + Suspense for loading states
- ✅ Paginated queries with TanStack Query
- ✅ Virtualized tables and feeds (`@tanstack/react-virtual`)
- ✅ Route-level code splitting
- ✅ IntersectionObserver for media autoplay
- ✅ Asset-light illustrations (prefer CSS over images)

### **Dark Mode**
- System preference by default
- Persisted via `next-themes`
- Smooth transition (200ms)

---

## 12) Analytics & Telemetry

### **Platform-Aware Tracking**
```typescript
import { usePlatform } from '@/hooks/usePlatform';
import posthog from 'posthog-js';

const { platform, screen, pointer, isNative } = usePlatform();

posthog.capture('page_view', {
  platform,           // 'web' | 'native'
  screen,             // 'mobile' | 'tablet' | 'desktop'
  pointer,            // 'coarse' | 'fine'
  is_native: isNative // true if iOS/Android app
});
```

### **Key Metrics by Platform**

**Mobile:**
- Session duration
- Scroll depth
- Video plays
- Camera usage
- QR scans
- Haptic feedback triggers

**Web:**
- Time on task
- Conversion funnel
- Form completion
- Table interactions
- Export actions
- Keyboard shortcut usage

---

## 13) Build Matrix

### **Multi-Platform Builds**
```
packages/
├── web/        # Vite build
├── ios/        # Capacitor iOS
└── android/    # Capacitor Android
```

### **Environment Variables**
```env
VITE_PLATFORM=web|ios|android
VITE_WEB_URL=https://yardpass.tech
VITE_APP_STORE_URL=https://apps.apple.com/yardpass
VITE_PLAY_STORE_URL=https://play.google.com/store/apps/yardpass
```

### **Build Commands**
```bash
# Web build
npm run build

# iOS build
npm run build:ios
npx cap sync ios
npx cap open ios

# Android build
npm run build:android
npx cap sync android
npx cap open android
```

---

## 14) Developer Playbook

### **Adding a New Feature: Decision Tree**

```
┌─ Is it consumer/social? (feed, discovery, posting)
│  └─ Mobile-first (with web fallback)
│
├─ Is it management/analytics? (dashboards, team, payouts)
│  └─ Web-first (with mobile upsell)
│
└─ Is it core functionality? (viewing events, profiles)
   └─ Both platforms (responsive)
```

### **Implementation Checklist**

**1. Design for Both Platforms**
- [ ] Define shared primitives
- [ ] Fork only at layout/shell level
- [ ] Keep leaf components platform-agnostic

**2. Implement Gates**
- [ ] Use `<WebOnly>` / `<MobileOnly>` with fallbacks
- [ ] Provide upsells with clear value props
- [ ] Never dead-end users

**3. Ship Fallbacks**
- [ ] Read-only views where applicable
- [ ] Export/summary options
- [ ] Deep links to other platform

**4. Test Modalities**
- [ ] Keyboard only (desktop)
- [ ] Screen reader (both)
- [ ] Coarse pointer / touch (mobile)
- [ ] Fine pointer / mouse (desktop)
- [ ] Offline mode (mobile)
- [ ] Responsive breakpoints (768px, 1024px)

---

## 15) Migration from Old Structure

### **File Mapping (Old → New)**

| Old Location | New Location | Notes |
|-------------|--------------|-------|
| `src/pages/SponsorshipPage.tsx` | `src/features/dashboard/routes/DashboardPage.tsx` | Tabbed overview + quick actions |
| `src/components/sponsorship/SponsorshipMarketplace.tsx` | `src/features/marketplace/routes/MarketplacePage.tsx` | + PackageCard, MarketplaceFilters |
| `src/components/sponsorship/MatchAlgorithm.tsx` | `src/features/matches/routes/MatchesPage.tsx` | + MatchCard component |
| `src/components/sponsorship/ProposalNegotiation.tsx` | `src/features/proposals/components/ProposalThread.tsx` | + OfferComparator |
| `src/components/sponsorship/AnalyticsDashboard.tsx` | `src/features/analytics/routes/AnalyticsPage.tsx` | Richer charts & exports |
| `src/components/sponsorship/SponsorProfileManager.tsx` | `src/features/profile/routes/ProfilePage.tsx` | Unified profile editor |
| `src/components/sponsorship/PaymentEscrowManager.tsx` | `src/features/deals/components/EscrowTimeline.tsx` | + DealDetail |
| (new) | `src/features/feed/routes/FeedPage.tsx` | Activity feed (new) |
| (new) | `src/features/ticketing/*` | Discovery, Checkout, Wallet |
| `src/components/Navigation.tsx` | `src/components/nav/BottomTabs.tsx` | Mobile bottom nav |
| `src/components/web/WebLayout.tsx` | `src/app/layouts/WebLayout.tsx` | Desktop layout |
| `src/hooks/usePlatform.ts` | `src/hooks/usePlatform.ts` | Revamped detection logic |

---

## 16) Example Components

### **PackageCard (Marketplace)**
```tsx
interface PackageCardProps {
  package: {
    id: string;
    title: string;
    coverImage: string;
    price: number;
    qualityBadge: 'premium' | 'high' | 'medium';
    reach: number;
    engagement: number;
  };
}

export function PackageCard({ package: pkg }: PackageCardProps) {
  const [saved, setSaved] = useState(false);

  return (
    <div className="group rounded-2xl border border-border bg-background hover:bg-muted/30 transition overflow-hidden">
      {/* Cover Image */}
      <div className="aspect-video relative overflow-hidden">
        <img src={pkg.coverImage} alt={pkg.title} className="object-cover w-full h-full" />
        <div className="absolute top-2 right-2">
          <Badge variant={pkg.qualityBadge === 'premium' ? 'default' : 'secondary'}>
            {pkg.qualityBadge}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-lg line-clamp-1">{pkg.title}</h3>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Reach: {pkg.reach.toLocaleString()}</span>
          <span>Engagement: {pkg.engagement}%</span>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-2xl font-bold">${(pkg.price / 100).toFixed(2)}</span>
          
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => setSaved(!saved)}
            >
              <Heart className={saved ? 'fill-current text-danger' : ''} />
            </Button>
            <Button size="sm">Details</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### **FeedItemCard (Activity Feed)**
```tsx
interface FeedItemCardProps {
  item: {
    id: string;
    actor: { avatar: string; name: string };
    title: string;
    context: string; // "Deal #1234", "Event: Summer Fest"
    preview?: string;
    timeAgo: string;
    actions?: Array<{
      label: string;
      icon: React.ReactNode;
      onClick: () => void;
      primary?: boolean;
    }>;
  };
}

export function FeedItemCard({ item }: FeedItemCardProps) {
  return (
    <div className="flex gap-3 p-3 rounded-2xl border border-border bg-background hover:bg-muted/30 transition">
      {/* Avatar */}
      <Avatar src={item.actor.avatar} alt={item.actor.name} />
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium truncate">{item.title}</span>
          <Badge variant="secondary">{item.context}</Badge>
          <span className="text-muted-foreground ml-auto shrink-0">
            {item.timeAgo}
          </span>
        </div>

        {item.preview && (
          <p className="text-sm mt-1 line-clamp-2 text-muted-foreground">
            {item.preview}
          </p>
        )}

        {/* Inline Actions */}
        {item.actions && (
          <div className="mt-2 flex gap-2">
            {item.actions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant={action.primary ? 'default' : 'ghost'}
                onClick={action.onClick}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### **ResponsiveBottomSheet (Mobile Filters)**
```tsx
<ResponsiveBottomSheet 
  trigger={
    <Button variant="outline" className="flex items-center gap-2">
      <Filter className="h-4 w-4" />
      Filters
    </Button>
  }
>
  <div className="space-y-4 p-4">
    <h3 className="font-semibold text-lg">Filter Packages</h3>
    
    <TagCombobox label="Category" options={categories} />
    <RangeFilter label="Price" min={0} max={100000} step={1000} />
    <Select label="Quality tier" options={["Premium", "High", "Medium"]} />
    
    <div className="flex gap-2">
      <Button variant="outline" className="flex-1">Clear</Button>
      <Button className="flex-1">Apply</Button>
    </div>
  </div>
</ResponsiveBottomSheet>
```

---

## 17) Quick Edit Reference

| What to Edit | Where to Look |
|-------------|---------------|
| **Global tokens** | `src/styles/index.css` & `tailwind.config.ts` |
| **Navigation** | `src/components/nav/*`, `src/app/layouts/*` |
| **Platform detection** | `src/hooks/usePlatform.ts`, `src/hooks/useCapabilities.ts` |
| **Gates** | `src/components/gates/WebOnly.tsx`, `MobileOnly.tsx` |
| **Feed behavior** | `src/features/feed/hooks/useFeed.ts` |
| **Marketplace** | `src/features/marketplace/*` |
| **Escrow visuals** | `src/features/deals/components/EscrowTimeline.tsx` |
| **Analytics charts** | `src/features/analytics/*` |
| **Ticket QR** | `src/features/ticketing/components/TicketQR.tsx` |
| **Command palette** | `src/components/ui/command.tsx` |
| **Upsells** | `src/components/Upsells.tsx` |

---

## 18) Summary & Key Takeaways

### **What Changed from Original**

✅ **Removed hard-coded colors** - All colors now tokenized
✅ **Feature detection over UA** - Breakpoint + capability checks
✅ **Separated layouts from pages** - Cleaner platform theming
✅ **Explicit fallbacks** - Every gate has an upsell
✅ **Feature-first structure** - Domain-driven file organization
✅ **Density controls** - Comfortable/compact modes
✅ **Better accessibility** - WCAG 2.1 AA compliant

### **Core Architecture Principles**

1. **Platform-aware, not platform-exclusive**
   - Detect capabilities, not devices
   - Provide fallbacks, not blocks

2. **Shared foundation, divergent presentation**
   - Same components, tokens, logic
   - Different layouts, nav, density

3. **Progressive enhancement**
   - Core features work everywhere
   - Enhanced features when available
   - Graceful degradation

4. **Performance-first**
   - Lazy loading
   - Virtualization
   - Optimistic updates
   - Code splitting

### **The Result**

A **professional, modern, and maintainable** platform-aware design that:

✅ Feels **native** on mobile (social, touch-optimized, camera-first)
✅ Feels **powerful** on web (analytics, management, keyboard-driven)
✅ Maintains **one codebase** with shared design system
✅ **Never blocks** users—always provides value
✅ **Scales** with your product roadmap

---

## 🎯 Next Steps

### **Immediate Tasks**
1. ✅ Implement revamped `usePlatform` hook
2. ✅ Create `WebOnly` / `MobileOnly` gate components
3. ✅ Tokenize all colors in `index.css`
4. ✅ Build `WebLayout` and `MobileLayout`
5. ✅ Refactor routes with platform gates
6. ✅ Add upsell components

### **Phase 2**
1. Migrate existing features to feature-first structure
2. Build activity feed module
3. Enhance ticketing with wallet & scanner
4. Add density toggles for tables
5. Implement command palette (⌘K)

### **Phase 3**
1. Performance audit (Lighthouse, Core Web Vitals)
2. Accessibility audit (WCAG 2.1 AA)
3. Cross-browser testing
4. Mobile device testing (iOS, Android)
5. Analytics integration & tracking

---

**Outcome:** A cohesive, scalable design system that cleanly supports sponsorships, ticketing, and a real-time activity feed—optimized for both professional desktop workflows and mobile on-the-go use.
