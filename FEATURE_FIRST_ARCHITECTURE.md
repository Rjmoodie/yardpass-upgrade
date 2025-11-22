# Liventix Feature-First Architecture

## 📊 Current State (January 2025)

Liventix uses a **hybrid architecture** combining feature-first organization with legacy type-based structure. This document reflects the **actual current state** of the codebase.

---

## Directory Structure

```
src/
├── app/                                    # Application shell
│   └── layouts/
│       └── WebLayout.tsx                  # Desktop layout (top nav)
│
├── features/                               # 🎯 Feature modules (MIGRATED)
│   │
│   ├── feed/                              # Activity feed ✅
│   │   ├── index.tsx                      # Public API
│   │   ├── routes/
│   │   │   ├── FeedPage.tsx               # Main feed page
│   │   │   └── FeedPageNewDesign.tsx      # New design feed
│   │   ├── components/
│   │   │   ├── UnifiedFeedList.tsx        # Feed list component
│   │   │   ├── FeedFilter.tsx             # Filter controls
│   │   │   ├── FeedGestures.tsx           # Touch gestures
│   │   │   └── FeedKeymap.tsx             # Keyboard shortcuts
│   │   ├── hooks/
│   │   │   └── useUnifiedFeedInfinite.ts  # Infinite scroll hook
│   │   └── types/
│   │       └── feed.ts                    # TypeScript types
│   │
│   ├── marketplace/                        # Sponsorship marketplace ✅
│   │   ├── index.tsx                      # Public API
│   │   └── routes/
│   │       ├── MarketplacePage.tsx        # Browse packages
│   │       └── SponsorshipPage.tsx        # Sponsorship overview
│   │
│   ├── matches/                            # AI-powered matching ✅
│   │   ├── index.tsx                      # Public API
│   │   └── routes/
│   │       └── MatchesPage.tsx            # Match recommendations
│   │
│   ├── proposals/                          # Negotiation & proposals ✅
│   │   ├── index.tsx                      # Public API
│   │   └── routes/
│   │       └── ProposalsPage.tsx          # Proposal threads
│   │
│   ├── deals/                              # Deals & escrow ✅
│   │   ├── index.tsx                      # Public API
│   │   └── components/
│   │       └── EscrowTimeline.tsx         # Payment timeline
│   │
│   ├── analytics/                          # Analytics & reporting ✅
│   │   ├── index.tsx                      # Public API
│   │   └── routes/
│   │       ├── AnalyticsPage.tsx          # Main analytics
│   │       └── EventAnalyticsPage.tsx     # Event-specific analytics
│   │
│   ├── ticketing/                          # Ticketing & wallet ✅
│   │   ├── index.tsx                      # Public API
│   │   └── routes/
│   │       └── WalletPage.tsx             # Ticket wallet
│   │
│   ├── profile/                            # User & sponsor profiles ✅
│   │   ├── index.tsx                      # Public API
│   │   ├── routes/
│   │   │   ├── ProfilePage.tsx            # View profile
│   │   │   └── EditProfilePage.tsx        # Edit profile
│   │   └── components/
│   │       ├── UserProfile.tsx            # Profile component
│   │       └── SponsorProfileManager.tsx  # Sponsor profile mgmt
│   │
│   └── dashboard/                          # Main dashboard ✅
│       ├── index.tsx                      # Public API
│       ├── routes/
│       │   └── DashboardPage.tsx          # Dashboard overview
│       └── components/
│           └── OrganizationDashboard.tsx  # Org dashboard
│
├── components/                             # ⚠️ LEGACY + Shared components
│   ├── ui/                                # shadcn/ui components (shared)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ... (60+ components)
│   │
│   ├── CommentModal.tsx                   # ⚠️ Legacy - comment system
│   ├── PostCreator.tsx                    # ⚠️ Legacy - post creation
│   ├── PostCreatorModal.tsx               # ⚠️ Legacy
│   ├── EventManagement.tsx                # ⚠️ Legacy - event management
│   ├── EventFeed.tsx                      # ⚠️ Legacy - event posts
│   ├── OrganizationDashboard.tsx          # ⚠️ Legacy - duplicate
│   ├── OrganizationCreator.tsx            # ⚠️ Legacy - org creation
│   ├── GuestManagement.tsx                # ⚠️ Legacy - guest management
│   ├── ScannerPage.tsx                    # ⚠️ Legacy - QR scanner
│   ├── SearchPage.tsx                     # ⚠️ Legacy - search
│   ├── CreateEventFlow.tsx                # ⚠️ Legacy - event creation
│   ├── AnalyticsHub.tsx                   # ⚠️ Legacy - analytics
│   ├── NavigationNewDesign.tsx            # Shared navigation
│   ├── BrandedSpinner.tsx                 # Shared loading states
│   ├── LoadingSpinner.tsx                 # Shared loading states
│   ├── AuthGuard.tsx                      # Auth guard component
│   ├── GlobalErrorHandler.tsx             # Error handling
│   ├── ErrorBoundary.tsx                  # React error boundary
│   │
│   ├── feed/                              # Feed components (legacy)
│   ├── analytics/                         # Analytics components (legacy)
│   ├── campaigns/                         # Campaign components (legacy)
│   ├── dashboard/                         # Dashboard components (legacy)
│   ├── tickets/                           # Ticket components (legacy)
│   ├── wallet/                            # Wallet components (legacy)
│   ├── scanner/                           # Scanner components (legacy)
│   ├── auth/                              # Auth components (shared)
│   ├── gates/                             # Access gates (shared)
│   ├── nav/                               # Navigation (shared)
│   └── ... (many more legacy components)
│
├── pages/                                  # ⚠️ LEGACY pages (not yet migrated)
│   ├── Index.tsx                          # Main feed (uses FeedPage)
│   ├── EventSlugPage.tsx                  # Event details
│   ├── EventDetailsPage.tsx               # Event details (new design)
│   ├── ProfilePage.tsx                    # Profile (new design)
│   ├── SearchPage.tsx                     # Search (new design)
│   ├── TicketsPage.tsx                    # Tickets (new design)
│   ├── MessagesPage.tsx                   # Messages (new design)
│   ├── NotificationsPage.tsx              # Notifications (new design)
│   ├── ScannerSelectEventPage.tsx         # Scanner event selection
│   ├── OrganizerRefundsPage.tsx           # Organizer refunds
│   ├── WalletPage.tsx                     # Wallet page
│   ├── AuthPage.tsx                       # Auth page
│   ├── OrgInvitePage.tsx                  # Org invite acceptance
│   ├── RoleAcceptPage.tsx                 # Role invite acceptance
│   ├── PrivacyPolicy.tsx                  # Legal pages
│   ├── TermsOfService.tsx
│   ├── RefundPolicy.tsx
│   └── ... (many more pages)
│
├── contexts/                               # React contexts
│   ├── AuthContext.tsx                    # Authentication context
│   ├── ProfileViewContext.tsx             # Profile view (attendee/organizer)
│   └── FollowRealtimeContext.tsx          # Follow real-time updates
│
├── hooks/                                  # Shared hooks
│   ├── useAuth.ts                         # Authentication hook
│   ├── usePlatform.ts                     # Platform detection
│   ├── useCapabilities.ts                 # Hardware capabilities
│   ├── useRealtimeComments.ts             # Real-time comment subscriptions
│   ├── useRealtimeMessages.ts             # Real-time messaging
│   ├── useRealtimePosts.ts                # Real-time post updates
│   ├── useTickets.tsx                     # Ticket management
│   ├── useOrganizations.ts                # Organization management
│   ├── useStripeConnect.tsx               # Stripe Connect
│   ├── useAnalytics.ts                    # Analytics tracking
│   └── ... (80+ hooks)
│
├── lib/                                    # Shared utilities
│   ├── api/                               # API clients
│   │   ├── campaigns.ts
│   │   ├── events.ts
│   │   ├── homeFeed.ts
│   │   └── wallet.ts
│   ├── video/                             # Video utilities
│   │   └── muxClient.ts                   # Mux video client
│   ├── routes.ts                          # Route definitions
│   ├── analytics.ts                       # Analytics helpers
│   ├── share.ts                           # Share functionality
│   ├── utils.ts                           # General utilities
│   └── ... (30+ utility files)
│
├── types/                                  # TypeScript types
│   ├── events.ts                          # Event types
│   ├── global.ts                          # Global types
│   └── supabase.ts                        # Generated Supabase types
│
├── utils/                                  # Utility functions
│   ├── media.ts                           # Media utilities
│   └── animations.css                     # CSS animations
│
└── integrations/                           # Third-party integrations
    └── supabase/
        └── client.ts                      # Supabase client

supabase/
├── functions/                              # Edge Functions (Deno)
│   │
│   ├── Feed Feature →
│   │   ├── home-feed/                     # Feed generation API
│   │   └── posts-list/                    # Posts listing
│   │
│   ├── Posts Feature (planned) →
│   │   ├── posts-create/                  # Post creation API
│   │   ├── comments-add/                  # Comment creation API
│   │   └── reactions-toggle/              # Reactions API
│   │
│   ├── Ticketing Feature →
│   │   ├── checkout/                      # Checkout processing
│   │   ├── create-checkout/               # Checkout session creation
│   │   ├── create-embedded-checkout/      # Embedded checkout
│   │   ├── guest-checkout/                # Guest checkout flow
│   │   ├── process-refund/                # Refund processing
│   │   ├── review-refund-request/         # Refund review
│   │   ├── send-purchase-confirmation/    # Purchase emails
│   │   ├── send-ticket-reminder/          # Ticket reminders
│   │   ├── ensure-tickets/                # Ticket generation
│   │   ├── get-user-tickets/              # User tickets API
│   │   ├── get-wallet/                    # Wallet API
│   │   └── wallet-*                       # Wallet functions (8+)
│   │
│   ├── Organizations Feature (planned) →
│   │   ├── send-org-invite/               # Organization invites
│   │   ├── send-role-invite/              # Role invites
│   │   ├── scanner-invite/                # Scanner invitations
│   │   └── refresh-stripe-accounts/       # Stripe Connect
│   │
│   ├── Analytics Feature →
│   │   ├── analytics-*                    # Analytics functions (10+)
│   │   ├── track-analytics/               # Analytics tracking
│   │   └── refresh-analytics/             # Analytics refresh
│   │
│   ├── Events Feature (planned) →
│   │   ├── search-events/                 # Event search
│   │   └── event-embed/                   # Event embedding
│   │
│   ├── Campaigns Feature (planned) →
│   │   ├── campaigns-*                    # Campaign functions (3+)
│   │   └── creatives-*                    # Creative functions (2+)
│   │
│   ├── Scanner Feature (planned) →
│   │   ├── scanner-*                      # Scanner functions (5+)
│   │   └── issue-ticket-qr-token/         # QR token generation
│   │
│   ├── Messaging Feature (planned) →
│   │   ├── messaging-queue/               # Message queue
│   │   └── send-digest/                   # Digest emails
│   │
│   ├── Video/Media Feature →
│   │   ├── mux-*                          # Mux functions (3+)
│   │   ├── upload-video-mux/              # Video upload
│   │   └── video-optimization/            # Video optimization
│   │
│   └── Utility Functions →
│       ├── auth-*                         # Auth functions (2+)
│       ├── ai-*                           # AI functions (4+)
│       ├── cleanup-job/                   # Maintenance
│       └── ... (shared utilities)
│
├── migrations/                             # Database migrations
│   ├── 20251102_enhance_comments.sql      # Comment enhancements
│   ├── 20250104_fix_comment_rls.sql       # Comment RLS fixes
│   ├── 20250115_clean_comment_policies.sql # Comment policies
│   └── ... (155+ migrations)
│
└── config.toml                             # Supabase configuration
```

---

## ✅ Feature Status & Ownership

| Feature | Status | Owner / DRI | Location | Notes |
|---------|--------|-------------|----------|-------|
| **feed** | ✅ Migrated | @team-feed | `src/features/feed/` | New design in `FeedPageNewDesign.tsx` |
| **marketplace** | ✅ Migrated | @team-sponsorship | `src/features/marketplace/` | Sponsorship marketplace |
| **matches** | ✅ Migrated | @team-sponsorship | `src/features/matches/` | AI-powered matching |
| **proposals** | ✅ Migrated | @team-sponsorship | `src/features/proposals/` | Negotiation & proposals |
| **deals** | ✅ Migrated | @team-sponsorship | `src/features/deals/` | Deals & escrow |
| **analytics** | ✅ Migrated | @team-analytics | `src/features/analytics/` | Analytics & reporting |
| **ticketing** | ✅ Migrated | @team-events | `src/features/ticketing/` | Ticketing & wallet |
| **profile** | ✅ Migrated | @team-platform | `src/features/profile/` | User & sponsor profiles |
| **dashboard** | ✅ Migrated | @team-platform | `src/features/dashboard/` | Main dashboard |
| **comments** | ⚠️ Legacy | TBD | `src/components/CommentModal.tsx` | **High priority** - Core engagement |
| **posts** | ⚠️ Legacy | TBD | `src/components/PostCreator.tsx` | **High priority** - Core engagement |
| **events** | ⚠️ Legacy | TBD | `src/components/EventManagement.tsx` | **High priority** - Organizer workflow |
| **organizations** | ⚠️ Legacy | TBD | `src/components/OrganizationCreator.tsx` | Medium priority |
| **guests** | ⚠️ Legacy | TBD | `src/components/GuestManagement.tsx` | Medium priority |
| **scanner** | ⚠️ Legacy | TBD | `src/components/ScannerPage.tsx` | Medium priority |
| **search** | ⚠️ Legacy | TBD | `src/components/SearchPage.tsx` | Medium priority |
| **campaigns** | ⚠️ Legacy | TBD | `src/components/campaigns/` | Medium priority |

### 🚀 Upcoming Feature Modules (Planned)

These are explicitly planned for migration and should NOT be started as legacy components:

- ✅ **features/comments/** - Comment system (`CommentModal.tsx` → feature)
- ✅ **features/posts/** - Post creation (`PostCreator.tsx` → feature)
- ✅ **features/events/** - Event management (`EventManagement.tsx` → feature)
- ✅ **features/organizations/** - Organization management (consolidate org components)
- ✅ **features/guests/** - Guest management (`GuestManagement.tsx` → feature)
- ✅ **features/scanner/** - QR scanner (`ScannerPage.tsx` → feature)
- ✅ **features/search/** - Search functionality (`SearchPage.tsx` → feature)
- ✅ **features/campaigns/** - Campaign management (consolidate campaigns/)

---

## 🔄 Hybrid Architecture Rules

**During the transition period, follow these rules:**

1. ✅ **New features MUST go under `features/`**
   - Don't create new top-level components in `components/` unless they are truly shared
   - Don't create new pages in `pages/` unless they're utility pages (legal, auth, etc.)

2. ✅ **Significant changes trigger migration**
   - If you're refactoring a legacy component significantly, migrate it to a feature first
   - If a legacy page needs a major overhaul, create the feature version before updating

3. ✅ **Shared components stay in `components/`**
   - UI components (`components/ui/`) - shadcn/ui components
   - Navigation (`components/nav/`, `NavigationNewDesign.tsx`)
   - Loading states (`BrandedSpinner.tsx`, `LoadingSpinner.tsx`)
   - Auth components (`AuthGuard.tsx`, `auth/` directory)
   - Gates (`components/gates/`) - Access control wrappers

4. ⚠️ **Avoid creating new legacy structure**
   - Don't create `components/[feature-name]/` directories
   - Don't create deep nested component structures
   - Prefer creating a feature module instead

5. 🔗 **Feature boundaries**
   - Features should not directly import from other features
   - Use composition or shared components for cross-feature communication
   - Export only what's needed via `index.tsx` (public API)

---

## 🗺️ Canonical Routes & Entry Points

**Clarifying which page/route is canonical for each domain:**

| Domain | Old Entrypoint | New Entrypoint | Status | Notes |
|--------|---------------|----------------|--------|-------|
| **Feed** | `pages/Index.tsx` | `features/feed/routes/FeedPageNewDesign.tsx` | ✅ Migrated | `Index.tsx` wraps `FeedPage` |
| **Event Details** | `pages/EventSlugPage.tsx` | `pages/new-design/EventDetailsPage.tsx` | ⚠️ Dual | New design is default via `/e/:identifier` |
| **Profile** | `pages/UserProfilePage.tsx` | `features/profile/routes/ProfilePage.tsx` | ✅ New Default | Via `/profile/:username` |
| **Search** | `components/SearchPage.tsx` | `pages/new-design/SearchPage.tsx` | ⚠️ New Design | Default via `/search` |
| **Tickets** | `pages/WalletPage.tsx` | `pages/new-design/TicketsPage.tsx` | ⚠️ New Design | Default via `/tickets` |
| **Messages** | `pages/MessagesPage.tsx` | `pages/new-design/MessagesPage.tsx` | ⚠️ New Design | Default via `/messages` |
| **Notifications** | `pages/NotificationsPage.tsx` | `pages/new-design/NotificationsPage.tsx` | ⚠️ New Design | Default via `/notifications` |
| **Dashboard** | `components/OrganizerDashboard.tsx` | `features/dashboard/routes/DashboardPage.tsx` | ✅ Migrated | Default via `/dashboard` |
| **Analytics** | `components/AnalyticsHub.tsx` | `features/analytics/routes/AnalyticsPage.tsx` | ✅ Migrated | Part of dashboard |

**Legacy routes redirect:**
- `/events/:id` → `/e/:identifier` (EventDetailsPageNew)
- `/event/:id` → `/e/:identifier` (EventDetailsPageNew)
- `/u/:username` → `/profile/:username` (ProfilePageNew)
- `/user/:userId` → `/profile/:userId` (ProfilePageNew)

---

## Feature Module Template

Each feature follows this standard structure:

```
features/[feature-name]/
├── index.tsx                   # Public API (exports)
├── routes/
│   └── [Feature]Page.tsx      # Main route component
├── components/
│   ├── [Feature]Card.tsx      # Display components
│   ├── [Feature]List.tsx      # List views
│   └── [Feature]Form.tsx      # Forms
├── hooks/
│   ├── use[Feature].ts        # Data fetching
│   └── use[Feature]State.ts   # State management
├── api/
│   └── [feature]Api.ts        # API client
├── types/
│   └── [feature].ts           # TypeScript types
└── utils/
    └── [feature]Helpers.ts    # Helper functions
```

---

## Import Patterns

### 1. Within a Feature (Relative Imports)
```typescript
// In features/marketplace/components/PackageCard.tsx
import { useMarketplace } from '../hooks/useMarketplace';
import { MarketplacePage } from '../routes/MarketplacePage';
import type { Package } from '../types/marketplace';
```

### 2. From Shared Components (Absolute Imports)
```typescript
// Any feature can import shared components
import { Button } from '@/components/ui/button';
import { WebOnly } from '@/components/gates/WebOnly';
import { usePlatform } from '@/hooks/usePlatform';
import { cn } from '@/lib/utils';
```

### 3. From Other Features (Via Public API)
```typescript
// In features/dashboard/routes/DashboardPage.tsx
import { AnalyticsPage } from '@/features/analytics';
import { MarketplacePage } from '@/features/marketplace';
import { FeedPage } from '@/features/feed';
```

### 4. Feature Public API (`index.tsx`)
```typescript
// features/marketplace/index.tsx
export { default as MarketplacePage } from './routes/MarketplacePage';
export { default as SponsorshipPage } from './routes/SponsorshipPage';
export { useMarketplace } from './hooks/useMarketplace';
export type { Package, PackageFilter } from './types/marketplace';
```

---

## Migration Map

| Old Path | New Path |
|----------|----------|
| `pages/Index.tsx` | `features/feed/routes/FeedPage.tsx` |
| `components/UnifiedFeedList.tsx` | `features/feed/components/UnifiedFeedList.tsx` |
| `components/sponsorship/SponsorshipMarketplace.tsx` | `features/marketplace/routes/MarketplacePage.tsx` |
| `components/sponsorship/MatchAlgorithm.tsx` | `features/matches/routes/MatchesPage.tsx` |
| `components/sponsorship/ProposalNegotiation.tsx` | `features/proposals/routes/ProposalsPage.tsx` |
| `components/sponsorship/PaymentEscrowManager.tsx` | `features/deals/components/EscrowTimeline.tsx` |
| `components/sponsorship/AnalyticsDashboard.tsx` | `features/analytics/routes/AnalyticsPage.tsx` |
| `pages/WalletPage.tsx` | `features/ticketing/routes/WalletPage.tsx` |
| `pages/OrganizerDashboard.tsx` | `features/dashboard/routes/DashboardPage.tsx` |
| `components/UserProfile.tsx` | `features/profile/components/UserProfile.tsx` |

---

## Benefits

### 1. **Co-Location** 🎯
All code for a feature lives together:
```
features/marketplace/
  ├── MarketplacePage.tsx     ← Route
  ├── PackageCard.tsx         ← Component
  ├── useMarketplace.ts       ← Hook
  └── marketplaceApi.ts       ← API
```

### 2. **Clear Boundaries** 🔒
```typescript
// ✅ GOOD: Feature imports from itself
import { PackageCard } from '../components/PackageCard';

// ✅ GOOD: Feature imports shared components
import { Button } from '@/components/ui/button';

// ⚠️ AVOID: Cross-feature imports (creates coupling)
import { DealCard } from '@/features/deals/components/DealCard';
```

### 3. **Easy Refactoring** ♻️
```bash
# Delete entire marketplace feature
rm -rf src/features/marketplace/

# Rename matches to recommendations
mv src/features/matches/ src/features/recommendations/
```

### 4. **Automatic Code Splitting** 📦
```typescript
// Lazy load features
const MarketplacePage = lazy(() => 
  import('@/features/marketplace/routes/MarketplacePage')
);
// Webpack/Vite creates: marketplace.chunk.js
```

### 5. **Team Ownership** 👥
```
Team Sponsorship:        Team Events:
- marketplace/           - ticketing/
- matches/               - feed/
- proposals/             - dashboard/
- deals/
- analytics/
```

### 6. **Shorter Imports** 📏
```typescript
// Before (type-first):
import { PackageCard } from '@/components/sponsorship/marketplace/PackageCard';

// After (feature-first):
import { PackageCard } from '../components/PackageCard';
```

---

## Backward Compatibility

Old imports still work via deprecated re-exports:

```typescript
// ✅ Old path (still works, with deprecation warning)
import Index from '@/pages/Index';
import { UnifiedFeedList } from '@/components/UnifiedFeedList';
import { SponsorshipMarketplace } from '@/components/sponsorship/SponsorshipMarketplace';

// ✅ New path (recommended)
import { FeedPage } from '@/features/feed';
import { UnifiedFeedList } from '@/features/feed';
import { MarketplacePage } from '@/features/marketplace';
```

---

## 🎯 When to Create a New Feature

**Create a new feature folder when:**

1. ✅ **It represents a user-facing domain**
   - Examples: `events`, `comments`, `posts`, `search`, `messaging`
   - Not: utility functions, helpers, or pure UI components

2. ✅ **It has substantial code surface area**
   - At least **one route** (page/route component), OR
   - **Multiple components + hooks** that work together as a cohesive unit
   - Single-use components should stay in the feature that uses them

3. ✅ **It encapsulates distinct business logic**
   - Has its own data fetching, state management, or API calls
   - Has clear boundaries with other features
   - Not just a visual section or layout component

4. ✅ **It can evolve independently**
   - Features should be loosely coupled
   - Changes to one feature shouldn't require changes to others
   - Has its own domain concepts and types

**Examples:**
- ✅ **Good**: `features/comments/` - Comments system with modal, hooks, API calls, types
- ✅ **Good**: `features/posts/` - Post creation with form, validation, upload logic
- ❌ **Avoid**: `features/buttons/` - Just UI components (use `components/ui/`)
- ❌ **Avoid**: `features/utils/` - Pure utilities (use `lib/`)

---

## Rules & Best Practices

### Rule 1: Feature Isolation
Features should be **self-contained**. Avoid cross-feature dependencies.

```typescript
// ❌ BAD: Direct cross-feature import
import { DealCard } from '@/features/deals/components/DealCard';

// ✅ GOOD: Move to shared if used by multiple features
import { DealCard } from '@/components/shared/DealCard';

// ✅ GOOD: Pass as prop (composition)
<MarketplacePage dealCardComponent={<DealCard />} />
```

### Rule 2: Public API
Only export what other features need via `index.tsx`:

```typescript
// features/marketplace/index.tsx
export { default as MarketplacePage } from './routes/MarketplacePage';
// Don't export internal components unless needed elsewhere
```

### Rule 3: Component Promotion
- Used in **1 feature** → Keep in that feature
- Used in **2+ features** → Move to `components/shared/`
- Used **everywhere** → Move to `components/ui/`

### Rule 4: Import Hierarchy
```
features/[feature]/
  ↓ Can import from:
  ├── Same feature (relative imports)
  ├── components/ (shared components)
  ├── hooks/ (shared hooks)
  ├── lib/ (utilities)
  └── Other features (via public API only, sparingly)
```

---

## 🔒 Boundary Enforcement

**Tooling to enforce feature boundaries:**

### Current (Manual)
- Code reviews ensure feature boundaries
- Documentation (this file) guides structure

### Planned (Automated)

1. **ESLint Rules**
   ```json
   {
     "rules": {
       "import/no-restricted-paths": [2, {
         "zones": [
           {
             "target": "./features/*",
             "from": "./features/*",
             "except": ["./features/*/index.tsx"]
           },
           {
             "target": "./components",
             "from": "./features"
           }
         ]
       }]
     }
   }
   ```

2. **TypeScript Path Groups**
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/features/*": ["src/features/*"],
         "@/components/*": ["src/components/*"]
       }
     }
   }
   ```

3. **eslint-plugin-boundaries**
   - Enforce layer boundaries (features vs components vs lib)
   - Prevent feature-to-feature imports except via public API

**Goal:** Gradually add lint rules to prevent:
- Cross-feature imports (except via `index.tsx`)
- `components/` depending on `features/`
- Creating new legacy structure during transition

This isn't just "best effort" - tooling will enforce boundaries as the codebase matures.

---

## Developer Workflow

### Working on a Feature
```bash
# All code for marketplace is here
cd src/features/marketplace/

# Add a component
touch components/PackageFilter.tsx

# Add a hook
touch hooks/usePackageFilters.ts

# Export in public API
echo "export { usePackageFilters } from './hooks/usePackageFilters';" >> index.tsx
```

### Creating a New Feature
```bash
# Create feature structure
mkdir -p src/features/my-feature/{routes,components,hooks,api,types,utils}

# Create index.tsx
cat > src/features/my-feature/index.tsx << EOF
// My Feature public API
export { default as MyFeaturePage } from './routes/MyFeaturePage';
EOF

# Create route
cat > src/features/my-feature/routes/MyFeaturePage.tsx << EOF
export default function MyFeaturePage() {
  return <div>My Feature</div>;
}
EOF
```

---

## Testing

### Unit Tests
Place tests next to the code:
```
features/marketplace/
├── components/
│   ├── PackageCard.tsx
│   └── __tests__/
│       └── PackageCard.test.tsx
```

### Integration Tests
Test entire features:
```
features/marketplace/
└── __tests__/
    └── marketplace.test.tsx
```

---

## Documentation

- **Migration Guide**: `MIGRATION_COMPLETE.md`
- **Section 8 Elaboration**: `SECTION_8_FILE_ORGANIZATION_GUIDE.md`
- **Platform Design**: `PLATFORM_DESIGN_STRUCTURE.md`
- **Implementation Verification**: `IMPLEMENTATION_VERIFICATION.md`

---

## Summary

### ✅ Completed Migrations

**9 features fully migrated to feature-first structure:**
1. ✅ **feed/** - Activity feed with infinite scroll
2. ✅ **marketplace/** - Sponsorship marketplace
3. ✅ **matches/** - AI-powered matching
4. ✅ **proposals/** - Negotiation & proposals
5. ✅ **deals/** - Deals & escrow
6. ✅ **analytics/** - Analytics & reporting
7. ✅ **ticketing/** - Ticketing & wallet
8. ✅ **profile/** - User & sponsor profiles
9. ✅ **dashboard/** - Main dashboard

### ⚠️ Pending Migrations

**Major features still in legacy structure:**
- **Comments System** - `CommentModal.tsx` + database migrations
- **Post Creation** - `PostCreator.tsx`, `PostCreatorModal.tsx`
- **Event Management** - `EventManagement.tsx`, `EventFeed.tsx`
- **Organization Management** - `OrganizationCreator.tsx`, `OrganizationTeamPanel.tsx`
- **Guest Management** - `GuestManagement.tsx`, `AddGuestModal.tsx`
- **Scanner** - `ScannerPage.tsx` + scanner routes
- **Search** - `SearchPage.tsx` + search components
- **Campaigns** - `campaigns/` directory (12 files)

### 🎯 Architecture Status

- ✅ **Feature modules**: 9 features fully migrated
- ⚠️ **Legacy components**: ~50+ components still in `components/`
- ⚠️ **Legacy pages**: ~40+ pages still in `pages/`
- ✅ **Shared infrastructure**: UI components, hooks, contexts organized
- ✅ **Backend**: 70+ Edge Functions, 155+ database migrations

### 📋 Migration Priority

**High Priority** (Core User Features):
1. **Comments System** → `features/comments/` - Most used feature, core engagement
2. **Post Creation** → `features/posts/` - Core engagement feature
3. **Event Management** → `features/events/` - Organizer workflow foundation
4. **Search** → `features/search/` - User discovery feature

**Medium Priority** (Organizer Features):
5. **Organization Management** → `features/organizations/` - Consolidate org components
6. **Guest Management** → `features/guests/` - Event guest management
7. **Scanner** → `features/scanner/` - QR code scanning
8. **Campaigns** → `features/campaigns/` - Marketing campaigns

**Low Priority** (Consolidation):
9. **Consolidate Analytics** - Move legacy `analytics/` components into `features/analytics/`
10. **Consolidate Tickets** - Move legacy `tickets/` components into `features/ticketing/`

### 🚀 Next Steps

1. **Migrate Comments System** → `features/comments/`
   - Move `CommentModal.tsx` → `features/comments/components/CommentModal.tsx`
   - Extract hooks → `features/comments/hooks/useComments.ts`
   - Create route → `features/comments/routes/CommentsPage.tsx` (if needed)
   - Map `supabase/functions/comments-add/` → feature

2. **Migrate Post Creation** → `features/posts/`
   - Move `PostCreator.tsx`, `PostCreatorModal.tsx` → feature
   - Extract hooks → `features/posts/hooks/usePostCreation.ts`
   - Map `supabase/functions/posts-create/` → feature

3. **Migrate Event Management** → `features/events/`
   - Consolidate `EventManagement.tsx`, `EventFeed.tsx`, `EventPostsGrid.tsx`
   - Create unified event feature structure
   - Map event-related Supabase functions

---

**Current State: Hybrid Architecture** 🏗️

Liventix is transitioning from type-first to feature-first organization. 9 core features have been migrated, while many legacy components remain in `components/` and `pages/`. The goal is to migrate all domain features into `features/` while keeping truly shared utilities in `components/`, `hooks/`, and `lib/`.

This hybrid approach allows incremental migration without breaking existing functionality.

