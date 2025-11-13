# Liventix Sponsorship System - UI/Design Files

This document lists all files responsible for the **layout, design, buttons, and appearance** of the sponsorship system.

---

## 🎨 Main Page Layout

### **Primary Entry Point**
**File:** `src/pages/SponsorshipPage.tsx` (322 lines)
- **Purpose:** Main sponsorship page that brings together all components
- **Layout:** Tab-based interface with multiple sections
- **Components Used:**
  - Card, CardContent, CardHeader, CardTitle
  - Button, Badge, Tabs, TabsList, TabsTrigger
  - Icons: Building2, Users, DollarSign, TrendingUp, Bell, Settings, Plus, Search, Filter, BarChart3, MessageSquare, Shield, Star

**Tabs:**
1. Marketplace - Browse packages
2. Matches - AI-suggested matches
3. My Deals - Active sponsorships
4. Proposals - Negotiation threads
5. Analytics - Performance metrics
6. Profile - Sponsor profile management

---

## 🧩 Core Component Files (Layout & Design)

### **1. Marketplace Interface**
**File:** `src/components/sponsorship/SponsorshipMarketplace.tsx` (472 lines)
- **Purpose:** Main marketplace for browsing sponsorship packages
- **Features:**
  - Search bar with filters
  - Package grid/list view
  - Sorting options (price, quality, relevance, date)
  - Quality tier badges
  - Pagination
- **UI Components:**
  - Search input with icon
  - Filter dropdowns (category, price range, location, quality tier)
  - Package cards with:
    - Event cover image
    - Title, description, price
    - Expected reach, engagement score
    - Quality badge (Premium, High, Medium)
    - "View Details" button

---

### **2. Match Algorithm Interface**
**File:** `src/components/sponsorship/MatchAlgorithm.tsx`
- **Purpose:** Display AI-suggested sponsor-event matches
- **Features:**
  - Match score display (0-100)
  - Explainability metrics breakdown
  - Accept/Reject buttons
  - Contact organizer CTA
- **UI Components:**
  - Match cards with score visualization
  - Progress bars for fit metrics
  - Action buttons (Accept, Decline, Learn More)

---

### **3. Proposal Negotiation Interface**
**File:** `src/components/sponsorship/ProposalNegotiation.tsx`
- **Purpose:** Multi-round proposal negotiation UI
- **Features:**
  - Chat-style message thread
  - Offer comparison table
  - Attachment previews
  - Accept/Counter/Reject buttons
- **UI Components:**
  - Message bubbles (organizer vs sponsor)
  - Offer cards with structured benefits
  - File upload zone
  - Action buttons with confirmation dialogs

---

### **4. Analytics Dashboard**
**File:** `src/components/sponsorship/AnalyticsDashboard.tsx`
- **Purpose:** Performance metrics and ROI tracking
- **Features:**
  - KPI cards (GMV, conversion rate, avg deal size)
  - Charts (line, bar, pie)
  - Deliverable status tracker
  - Export buttons
- **UI Components:**
  - Stat cards with icons
  - Chart.js / Recharts visualizations
  - Progress bars for deliverables
  - Date range picker

---

### **5. Sponsor Profile Manager**
**File:** `src/components/sponsorship/SponsorProfileManager.tsx`
- **Purpose:** Edit sponsor profile, objectives, and preferences
- **Features:**
  - Multi-step form
  - Industry/company size selectors
  - Budget slider
  - Brand objectives text area
  - Target audience checkboxes
- **UI Components:**
  - Form inputs (text, number, select, textarea)
  - Slider for budget range
  - Checkbox groups for categories/regions
  - Save/Cancel buttons

---

### **6. Payment & Escrow Manager**
**File:** `src/components/sponsorship/PaymentEscrowManager.tsx`
- **Purpose:** Payment tracking and escrow status
- **Features:**
  - Order summary
  - Escrow state visualization
  - Milestone tracker
  - Payout schedule
- **UI Components:**
  - Payment status badges
  - Timeline component for milestones
  - Escrow state indicator (pending, funded, locked, released)
  - Payment confirmation modal

---

### **7. Notification System**
**File:** `src/components/sponsorship/NotificationSystem.tsx`
- **Purpose:** In-app notifications for sponsorship events
- **Features:**
  - Notification dropdown
  - Unread count badge
  - Mark as read functionality
  - Click to navigate
- **UI Components:**
  - Bell icon with badge
  - Dropdown list with notification cards
  - Timestamp display
  - Action buttons per notification

---

## 🎯 Sponsor-Specific Components

### **1. Sponsor Dashboard**
**File:** `src/components/sponsor/SponsorDashboard.tsx`
- **Purpose:** Main dashboard for sponsors
- **Layout:**
  - Header with sponsor switcher
  - KPI overview cards
  - Quick action buttons
  - Recent deals list
  - Upcoming deliverables
- **UI Components:**
  - Dashboard grid layout
  - Stat cards with trend indicators
  - Quick action buttons (Browse, Create Deal, View Analytics)
  - Table for deals with status badges

---

### **2. Sponsor Marketplace**
**File:** `src/components/sponsor/SponsorMarketplace.tsx`
- **Purpose:** Sponsor-facing marketplace view
- **Features:**
  - Personalized recommendations
  - Saved packages
  - Recently viewed
- **UI Components:**
  - Similar to `SponsorshipMarketplace.tsx` but with sponsor-specific filters

---

### **3. Package Grid**
**File:** `src/components/sponsor/PackagesGrid.tsx`
- **Purpose:** Grid layout for browsing packages
- **Features:**
  - Responsive grid (1, 2, 3, or 4 columns)
  - Hover effects
  - Quick view modal
- **UI Components:**
  - Package cards in grid
  - Hover overlay with "Quick View" button
  - Quality tier badges

---

### **4. Sponsor Deals**
**File:** `src/components/sponsor/SponsorDeals.tsx`
- **Purpose:** List of active, pending, and completed deals
- **Features:**
  - Filterable table
  - Status badges
  - Actions per deal (View, Message, Submit Proof)
- **UI Components:**
  - Data table with sorting
  - Status badges (active, pending, completed, cancelled)
  - Dropdown menu for actions

---

### **5. Sponsor Analytics**
**File:** `src/components/sponsor/SponsorAnalytics.tsx`
- **Purpose:** Analytics for sponsor's campaigns
- **Features:**
  - ROI calculator
  - Performance trends
  - Deal comparison
- **UI Components:**
  - Charts and graphs
  - Comparison table
  - Export to PDF button

---

### **6. Sponsor Checkout Button**
**File:** `src/components/sponsor/SponsorCheckoutButton.tsx`
- **Purpose:** Initiate sponsorship purchase
- **Features:**
  - Price display
  - Stripe Checkout integration
  - Loading states
- **UI Components:**
  - Primary button with price
  - Loading spinner
  - Success/error toasts

---

### **7. Sponsorship Checkout Modal**
**File:** `src/components/sponsor/SponsorshipCheckoutModal.tsx`
- **Purpose:** Full checkout flow modal
- **Features:**
  - Order summary
  - Payment form (Stripe Elements)
  - Terms & conditions checkbox
- **UI Components:**
  - Modal dialog
  - Order summary card
  - Payment form
  - Submit button

---

### **8. Sponsor Team Manager**
**File:** `src/components/sponsor/SponsorTeam.tsx`
- **Purpose:** Manage team members and roles
- **Features:**
  - Add/remove team members
  - Role assignment (owner, admin, editor, viewer)
  - Invite via email
- **UI Components:**
  - Team member cards
  - Role dropdown
  - Invite form
  - Remove button with confirmation

---

### **9. Sponsor Billing**
**File:** `src/components/sponsor/SponsorBilling.tsx`
- **Purpose:** Billing history and payment methods
- **Features:**
  - Invoice list
  - Payment method management
  - Download invoices
- **UI Components:**
  - Table for invoices
  - Payment method cards (Stripe)
  - Add payment method button

---

### **10. Sponsor Assets**
**File:** `src/components/sponsor/SponsorAssets.tsx`
- **Purpose:** Upload and manage brand assets (logos, media kits)
- **Features:**
  - File upload (drag & drop)
  - Asset preview
  - Delete/replace assets
- **UI Components:**
  - File uploader
  - Asset grid with thumbnails
  - Delete icon on hover

---

### **11. Sponsor Switcher**
**File:** `src/components/sponsor/SponsorSwitcher.tsx`
- **Purpose:** Switch between multiple sponsor accounts
- **Features:**
  - Dropdown with sponsor list
  - Create new sponsor CTA
- **UI Components:**
  - Dropdown button with current sponsor logo/name
  - Scrollable list of sponsors
  - "+ Create Sponsor" button

---

### **12. Sponsor Create Dialog**
**File:** `src/components/sponsor/SponsorCreateDialog.tsx`
- **Purpose:** Create a new sponsor account
- **Features:**
  - Multi-step form
  - Logo upload
  - Basic info (name, website, industry)
- **UI Components:**
  - Dialog modal
  - Form with validation
  - Logo upload zone
  - Submit button

---

### **13. Sponsor Opt-In Modal**
**File:** `src/components/sponsor/SponsorOptInModal.tsx`
- **Purpose:** Onboard users to sponsor mode
- **Features:**
  - Explainer text
  - Benefits list
  - Enable sponsor mode toggle
- **UI Components:**
  - Modal with illustrations
  - Benefits list with icons
  - "Enable Sponsor Mode" button

---

### **14. Sponsor Mode Settings**
**File:** `src/components/sponsor/SponsorModeSettings.tsx`
- **Purpose:** Settings for sponsor mode preferences
- **Features:**
  - Notification preferences
  - Default filters
  - Privacy settings
- **UI Components:**
  - Settings form
  - Toggle switches
  - Save button

---

## 🎨 UI Component Library (shadcn/ui)

All components use these base UI components from `src/components/ui/`:

### **Layout Components**
- `card.tsx` - Card container with header, content, footer
- `tabs.tsx` - Tab navigation
- `dialog.tsx` - Modal dialogs
- `sheet.tsx` - Side sheets / drawers
- `accordion.tsx` - Collapsible sections
- `sidebar.tsx` - Sidebar navigation

### **Form Components**
- `button.tsx` - Primary, secondary, outline, ghost variants
- `input.tsx` - Text inputs
- `textarea.tsx` - Multi-line text
- `select.tsx` - Dropdown selects
- `checkbox.tsx` - Checkboxes
- `radio-group.tsx` - Radio buttons
- `slider.tsx` - Range sliders
- `switch.tsx` - Toggle switches
- `calendar.tsx` - Date picker
- `form.tsx` - Form utilities with validation

### **Display Components**
- `badge.tsx` - Status badges (success, warning, error)
- `avatar.tsx` - User avatars
- `tooltip.tsx` - Hover tooltips
- `popover.tsx` - Popovers
- `alert.tsx` - Alert banners
- `toast.tsx` / `toaster.tsx` - Toast notifications
- `progress.tsx` - Progress bars
- `skeleton.tsx` - Loading skeletons
- `table.tsx` - Data tables

### **Navigation Components**
- `dropdown-menu.tsx` - Dropdown menus
- `navigation-menu.tsx` - Nav menus
- `breadcrumb.tsx` - Breadcrumbs
- `pagination.tsx` - Pagination controls
- `TabNavigation.tsx` - Custom tab nav

### **Data Visualization**
- `chart.tsx` - Chart wrapper (Recharts)
- `ProgressRing.tsx` - Circular progress

### **Specialized**
- `responsive-dialog.tsx` - Responsive modal
- `responsive-bottom-sheet.tsx` - Mobile bottom sheet
- `bottom-sheet.tsx` - Bottom sheet
- `PremiumButton.tsx` - Premium feature button
- `slug-display.tsx` - URL slug display
- `command.tsx` - Command palette

---

## 🎨 Styling & Theme

### **CSS Files**
**File:** `src/index.css`
- **Purpose:** Global styles, theme variables, Tailwind directives
- **Contains:**
  - CSS custom properties for colors
  - Dark/light theme definitions
  - Global typography
  - iOS-specific styles
  - Custom utility classes

### **Tailwind Config**
**File:** `tailwind.config.ts`
- **Purpose:** Tailwind CSS configuration
- **Contains:**
  - Color palette (primary, secondary, accent, muted)
  - Spacing scale
  - Typography scale
  - Breakpoints (mobile, tablet, desktop)
  - Custom animations

### **Theme Provider**
**File:** `src/App.tsx` (uses `next-themes`)
- **Purpose:** Dark/light mode management
- **Features:**
  - System preference detection
  - Manual toggle
  - Persistent storage

---

## 🖼️ Icons

### **Icon Library**
**Package:** `lucide-react`
- All icons imported from `lucide-react`
- Examples used in sponsorship:
  - `Building2` - Sponsors
  - `Users` - Team
  - `DollarSign` - Pricing
  - `TrendingUp` - Analytics
  - `Bell` - Notifications
  - `Settings` - Settings
  - `Plus` - Add/Create
  - `Search` - Search
  - `Filter` - Filters
  - `BarChart3` - Charts
  - `MessageSquare` - Messages
  - `Shield` - Verification
  - `Star` - Quality/Rating

---

## 📱 Responsive Design

### **Breakpoints** (defined in `tailwind.config.ts`)
```
sm: 640px   (mobile landscape)
md: 768px   (tablet)
lg: 1024px  (desktop)
xl: 1280px  (large desktop)
2xl: 1536px (extra large)
```

### **Mobile-First Approach**
- All components use responsive Tailwind classes
- Example: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Touch-friendly buttons (min 44px tap target)
- Collapsible sections on mobile

### **Platform-Specific**
**File:** `src/lib/ios-capacitor.ts`
- iOS safe area handling
- Status bar styling
- Keyboard behavior

---

## 🎨 Design Tokens

### **Colors** (defined in `src/index.css`)
```css
--background: hsl(...)
--foreground: hsl(...)
--primary: hsl(...)
--secondary: hsl(...)
--accent: hsl(...)
--muted: hsl(...)
--destructive: hsl(...)
--border: hsl(...)
--input: hsl(...)
--ring: hsl(...)
```

### **Typography**
```css
--font-sans: 'Inter', sans-serif
--font-mono: 'JetBrains Mono', monospace
```

### **Spacing**
- Uses Tailwind's spacing scale (0-96)
- Safe area utilities: `pb-safe-or-2`, `pt-safe-or-4`

### **Animations**
- Fade in/out
- Slide in from top/bottom/left/right
- Spin (loading)
- Pulse (skeleton)
- Bounce (alerts)

---

## 🧪 Variant Pages (for Testing)

### **Basic Version**
**File:** `src/pages/SponsorshipPageBasic.tsx`
- Simplified UI for basic sponsorship features
- Minimal styling

### **Minimal Version**
**File:** `src/pages/SponsorshipPageMinimal.tsx`
- Bare-bones UI for testing core functionality

### **Test Version**
**File:** `src/pages/SponsorshipPageTest.tsx`
- Debug/test interface with mock data

### **Test Page**
**File:** `src/pages/SponsorshipTestPage.tsx`
- Another test environment

---

## 🔧 Utility Files

### **Sponsorship Client**
**File:** `src/integrations/supabase/sponsorship-client.ts`
- API client for sponsorship operations
- Includes utility functions:
  - `formatCurrency(cents, currency)` - Format prices
  - `getQualityTierColor(tier)` - Get badge color based on quality
  - `calculateMatchScore(event, sponsor)` - Calculate fit score

### **Type Definitions**
**File:** `src/types/sponsorship-complete.ts` (511 lines)
- All TypeScript types for sponsorship system
- Ensures type safety across components

---

## 🎯 Key Design Patterns

### **1. Card-Based Layout**
- Most components use `Card` from shadcn/ui
- Consistent padding, borders, shadows
- Dark mode support

### **2. Action Buttons**
- Primary: `Button variant="default"` (filled)
- Secondary: `Button variant="outline"` (bordered)
- Ghost: `Button variant="ghost"` (text only)
- Destructive: `Button variant="destructive"` (red)

### **3. Status Badges**
```tsx
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="destructive">Cancelled</Badge>
```

### **4. Loading States**
- Skeleton components for initial load
- Spinner for button actions
- Progress bars for multi-step processes

### **5. Empty States**
- Centered icon + message
- Call-to-action button
- Example: "No packages yet. Create your first one!"

### **6. Data Tables**
- Sortable columns
- Pagination
- Row actions (dropdown menu)
- Responsive (stacks on mobile)

---

## 📂 File Organization Summary

```
src/
├── pages/
│   ├── SponsorshipPage.tsx          ← Main page (complete)
│   ├── SponsorshipPageBasic.tsx     ← Basic version
│   ├── SponsorshipPageMinimal.tsx   ← Minimal version
│   └── SponsorLanding.tsx           ← Landing page
│
├── components/
│   ├── sponsorship/                  ← Core sponsorship components
│   │   ├── SponsorshipMarketplace.tsx (472 lines)
│   │   ├── MatchAlgorithm.tsx
│   │   ├── ProposalNegotiation.tsx
│   │   ├── PaymentEscrowManager.tsx
│   │   ├── AnalyticsDashboard.tsx
│   │   ├── SponsorProfileManager.tsx
│   │   └── NotificationSystem.tsx
│   │
│   ├── sponsor/                      ← Sponsor-specific UI
│   │   ├── SponsorDashboard.tsx
│   │   ├── SponsorMarketplace.tsx
│   │   ├── PackagesGrid.tsx
│   │   ├── SponsorDeals.tsx
│   │   ├── SponsorAnalytics.tsx
│   │   ├── SponsorCheckoutButton.tsx
│   │   ├── SponsorshipCheckoutModal.tsx
│   │   ├── SponsorTeam.tsx
│   │   ├── SponsorBilling.tsx
│   │   ├── SponsorAssets.tsx
│   │   ├── SponsorSwitcher.tsx
│   │   ├── SponsorCreateDialog.tsx
│   │   ├── SponsorOptInModal.tsx
│   │   └── SponsorModeSettings.tsx
│   │
│   └── ui/                           ← Base UI components (60+ files)
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── badge.tsx
│       └── ... (all shadcn/ui components)
│
├── types/
│   └── sponsorship-complete.ts      ← TypeScript types (511 lines)
│
├── integrations/supabase/
│   └── sponsorship-client.ts        ← API client with utilities
│
├── index.css                         ← Global styles & theme variables
└── App.tsx                           ← Theme provider & routing
```

---

## 🎨 Quick Reference: Where to Edit What

### **Want to change...**

| What | File(s) |
|------|---------|
| Main page layout | `src/pages/SponsorshipPage.tsx` |
| Marketplace design | `src/components/sponsorship/SponsorshipMarketplace.tsx` |
| Package card design | `src/components/sponsor/PackagesGrid.tsx` |
| Colors | `src/index.css` (CSS variables) |
| Buttons | `src/components/ui/button.tsx` |
| Cards | `src/components/ui/card.tsx` |
| Badges | `src/components/ui/badge.tsx` |
| Typography | `src/index.css` + `tailwind.config.ts` |
| Spacing | `tailwind.config.ts` |
| Icons | Import from `lucide-react` |
| Dark mode | `src/App.tsx` (ThemeProvider) |
| Mobile breakpoints | `tailwind.config.ts` |
| Dashboard layout | `src/components/sponsor/SponsorDashboard.tsx` |
| Checkout modal | `src/components/sponsor/SponsorshipCheckoutModal.tsx` |
| Analytics charts | `src/components/sponsorship/AnalyticsDashboard.tsx` |

---

## 📝 Notes

- All components use **Tailwind CSS** for styling
- Base components from **shadcn/ui** (built on Radix UI)
- Icons from **lucide-react**
- Charts use **Recharts** (wrapped in `src/components/ui/chart.tsx`)
- Dark mode via **next-themes**
- Type safety via **TypeScript**

The complete sponsorship UI is modular, accessible, and fully responsive across all devices! 🎉

