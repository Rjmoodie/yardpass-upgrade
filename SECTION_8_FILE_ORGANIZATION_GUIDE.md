# Section 8: File Organization - Feature-First Architecture (Elaborated)

## Overview

Section 8 of the Liventix specification calls for a **feature-first file organization** that groups routes, components, hooks, and services by domain (feature) rather than by type. This approach keeps related code co-located and makes the codebase more maintainable as it scales.

---

## Current vs. Proposed Structure

### Current Structure (Type-First)
```
src/
├── components/          # All components mixed together
│   ├── EventCard.tsx
│   ├── TicketCard.tsx
│   ├── sponsorship/
│   │   ├── SponsorshipMarketplace.tsx
│   │   ├── MatchAlgorithm.tsx
│   │   └── ProposalNegotiation.tsx
│   ├── campaigns/
│   ├── tickets/
│   └── ui/
├── pages/               # All pages mixed together
│   ├── Index.tsx
│   ├── EventSlugPage.tsx
│   ├── SponsorshipPage.tsx
│   └── TicketsPage.tsx
├── hooks/               # All hooks mixed together
│   ├── useEvents.ts
│   ├── useTickets.ts
│   └── useSponsorships.ts
└── lib/                 # All utilities mixed together
    ├── api.ts
    ├── utils.ts
    └── eventHelpers.ts
```

**Problems with Type-First:**
- 🔴 Related code scattered across multiple directories
- 🔴 Hard to find all code related to one feature
- 🔴 Difficult to delete/refactor entire features
- 🔴 No clear boundaries between features
- 🔴 Import paths are long and confusing
- 🔴 Hard to code-split by feature

---

### Proposed Structure (Feature-First)

```
src/
├── app/                              # Application shell
│   ├── providers/
│   │   ├── ThemeProvider.tsx         # Dark mode, theme context
│   │   ├── AuthProvider.tsx          # Authentication state
│   │   └── QueryProvider.tsx         # TanStack Query setup
│   ├── layouts/
│   │   ├── WebLayout.tsx             # Desktop shell (TopBar + Sidebar)
│   │   ├── MobileLayout.tsx          # Mobile shell (BottomTabs)
│   │   └── AppLayout.tsx             # Platform-aware wrapper
│   └── routes.tsx                    # Main routing configuration
│
├── features/                         # Feature modules (domain-driven)
│   │
│   ├── marketplace/                  # Sponsorship marketplace
│   │   ├── routes/
│   │   │   └── MarketplacePage.tsx   # Main route component
│   │   ├── components/
│   │   │   ├── PackageCard.tsx       # Package display card
│   │   │   ├── PackageGrid.tsx       # Grid layout
│   │   │   ├── MarketplaceFilters.tsx # Filter panel
│   │   │   └── QualityBadge.tsx      # Quality tier badge
│   │   ├── hooks/
│   │   │   ├── useMarketplaceQuery.ts # Data fetching
│   │   │   ├── usePackageFilters.ts   # Filter state
│   │   │   └── useSavePackage.ts      # Save/unsave logic
│   │   ├── api/
│   │   │   └── marketplaceApi.ts      # API client functions
│   │   ├── types/
│   │   │   └── marketplace.ts         # TypeScript types
│   │   └── utils/
│   │       └── packageHelpers.ts      # Helper functions
│   │
│   ├── matches/                      # AI-powered matching
│   │   ├── routes/
│   │   │   └── MatchesPage.tsx
│   │   ├── components/
│   │   │   ├── MatchCard.tsx          # Match display card
│   │   │   ├── MatchScoreRing.tsx     # Score visualization
│   │   │   ├── ExplainabilityPanel.tsx # Why this match
│   │   │   └── MatchActions.tsx       # Accept/Reject buttons
│   │   ├── hooks/
│   │   │   ├── useMatches.ts
│   │   │   ├── useMatchScore.ts
│   │   │   └── useMatchAction.ts
│   │   └── utils/
│   │       └── scoreCalculator.ts
│   │
│   ├── proposals/                    # Proposal & negotiation
│   │   ├── routes/
│   │   │   ├── ProposalsPage.tsx
│   │   │   └── ProposalDetailPage.tsx
│   │   ├── components/
│   │   │   ├── ProposalThread.tsx     # Message thread
│   │   │   ├── ProposalMessage.tsx    # Individual message
│   │   │   ├── OfferComparator.tsx    # Side-by-side comparison
│   │   │   ├── OfferCard.tsx          # Offer display
│   │   │   ├── ProposalComposer.tsx   # Create/reply
│   │   │   └── AcceptDialog.tsx       # Confirmation modal
│   │   ├── hooks/
│   │   │   ├── useProposals.ts
│   │   │   ├── useProposalThread.ts
│   │   │   └── useProposalActions.ts
│   │   └── api/
│   │       └── proposalsApi.ts
│   │
│   ├── deals/                        # Deals & escrow management
│   │   ├── routes/
│   │   │   ├── DealsPage.tsx
│   │   │   └── DealDetailPage.tsx
│   │   ├── components/
│   │   │   ├── DealBoard.tsx          # Kanban view
│   │   │   ├── DealTable.tsx          # Table view
│   │   │   ├── DealCard.tsx           # Deal summary card
│   │   │   ├── EscrowTimeline.tsx     # Payment timeline
│   │   │   ├── MilestonesView.tsx     # Milestone tracking
│   │   │   └── DealStatusBadge.tsx    # Status indicator
│   │   ├── hooks/
│   │   │   ├── useDeals.ts
│   │   │   ├── useDealDetail.ts
│   │   │   ├── useEscrowState.ts
│   │   │   └── useMilestones.ts
│   │   └── types/
│   │       └── deals.ts
│   │
│   ├── analytics/                    # Analytics & reporting
│   │   ├── routes/
│   │   │   ├── AnalyticsPage.tsx
│   │   │   └── ReportsPage.tsx
│   │   ├── components/
│   │   │   ├── KpiCard.tsx            # Key metric display
│   │   │   ├── TrendChart.tsx         # Line/area charts
│   │   │   ├── FunnelChart.tsx        # Conversion funnel
│   │   │   ├── AttributionView.tsx    # UTM tracking
│   │   │   ├── ExportButton.tsx       # CSV/PDF export
│   │   │   └── DateRangePicker.tsx    # Date selection
│   │   ├── hooks/
│   │   │   ├── useAnalytics.ts
│   │   │   ├── useKpis.ts
│   │   │   ├── useTrends.ts
│   │   │   └── useExport.ts
│   │   └── utils/
│   │       ├── chartHelpers.ts
│   │       └── exportHelpers.ts
│   │
│   ├── ticketing/                    # Ticketing system
│   │   ├── routes/
│   │   │   ├── TicketingPage.tsx      # Discovery
│   │   │   ├── CheckoutPage.tsx       # Purchase flow
│   │   │   └── WalletPage.tsx         # My tickets
│   │   ├── components/
│   │   │   ├── TicketCard.tsx         # Ticket display
│   │   │   ├── TicketCheckout.tsx     # Checkout form
│   │   │   ├── TicketQR.tsx           # QR code display
│   │   │   ├── Wallet.tsx             # Wallet view
│   │   │   ├── CheckInScanner.tsx     # Staff scanner
│   │   │   ├── SeatMap.tsx            # Seat selection
│   │   │   └── PassDownload.tsx       # Apple/Google Wallet
│   │   ├── hooks/
│   │   │   ├── useTickets.ts
│   │   │   ├── useCheckout.ts
│   │   │   ├── useWallet.ts
│   │   │   └── useScanner.ts
│   │   ├── api/
│   │   │   └── ticketingApi.ts
│   │   └── types/
│   │       └── tickets.ts
│   │
│   ├── feed/                         # Activity feed (NEW)
│   │   ├── routes/
│   │   │   └── FeedPage.tsx
│   │   ├── components/
│   │   │   ├── FeedItemCard.tsx       # Feed item display
│   │   │   ├── FeedComposer.tsx       # Create post
│   │   │   ├── FeedFilters.tsx        # Filter controls
│   │   │   ├── MentionList.tsx        # @mention dropdown
│   │   │   ├── InlineActions.tsx      # Reply, approve, etc.
│   │   │   └── UnreadSeparator.tsx    # New items divider
│   │   ├── hooks/
│   │   │   ├── useFeed.ts             # Main feed query
│   │   │   ├── useFeedInfinite.ts     # Infinite scroll
│   │   │   ├── useFeedFilters.ts      # Filter state
│   │   │   └── useFeedActions.ts      # Like, reply, etc.
│   │   ├── api/
│   │   │   └── feedApi.ts
│   │   └── types/
│   │       └── feed.ts
│   │
│   ├── profile/                      # User/sponsor profiles
│   │   ├── routes/
│   │   │   ├── ProfilePage.tsx
│   │   │   └── EditProfilePage.tsx
│   │   ├── components/
│   │   │   ├── ProfileHeader.tsx
│   │   │   ├── ProfileStats.tsx
│   │   │   ├── ProfileTabs.tsx
│   │   │   └── ProfileEditor.tsx
│   │   ├── hooks/
│   │   │   ├── useProfile.ts
│   │   │   └── useUpdateProfile.ts
│   │   └── types/
│   │       └── profile.ts
│   │
│   ├── settings/                     # App settings
│   │   ├── routes/
│   │   │   └── SettingsPage.tsx
│   │   ├── components/
│   │   │   ├── SettingsNav.tsx
│   │   │   ├── AccountSettings.tsx
│   │   │   ├── NotificationSettings.tsx
│   │   │   ├── PrivacySettings.tsx
│   │   │   └── TeamSettings.tsx
│   │   └── hooks/
│   │       └── useSettings.ts
│   │
│   └── dashboard/                    # Main dashboard (overview)
│       ├── routes/
│       │   └── DashboardPage.tsx
│       ├── components/
│       │   ├── DashboardSummary.tsx
│       │   ├── QuickActions.tsx
│       │   ├── RecentActivity.tsx
│       │   └── UpcomingEvents.tsx
│       └── hooks/
│           └── useDashboard.ts
│
├── components/                       # Shared components only
│   ├── nav/
│   │   ├── TopBar.tsx                # Desktop top navigation
│   │   ├── BottomTabs.tsx            # Mobile bottom navigation
│   │   ├── AppSidebar.tsx            # Desktop left sidebar
│   │   ├── Breadcrumbs.tsx           # Navigation breadcrumbs
│   │   └── CommandK.tsx              # Command palette (⌘K)
│   ├── gates/
│   │   ├── WebOnly.tsx               # Desktop-only wrapper
│   │   └── MobileOnly.tsx            # Mobile-only wrapper
│   ├── ui/                           # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── data-table.tsx
│   │   ├── responsive-dialog.tsx
│   │   ├── responsive-bottom-sheet.tsx
│   │   ├── tag-combobox.tsx
│   │   ├── money-input.tsx
│   │   ├── percentage-input.tsx
│   │   ├── range-filter.tsx
│   │   ├── file-dropzone.tsx
│   │   ├── progress-ring.tsx
│   │   └── mini-sparkline.tsx
│   └── Upsells.tsx                   # Platform upsell messages
│
├── hooks/                            # Shared hooks only
│   ├── usePlatform.ts                # Platform detection
│   ├── useCapabilities.ts            # Hardware capabilities
│   ├── useAuth.ts                    # Authentication
│   ├── useToast.ts                   # Toast notifications
│   └── useMediaQuery.ts              # Responsive breakpoints
│
├── lib/                              # Shared utilities only
│   ├── api/
│   │   ├── client.ts                 # Base API client
│   │   └── supabase.ts               # Supabase client
│   ├── utils/
│   │   ├── cn.ts                     # Class name utility
│   │   ├── formatters.ts             # Date, currency, etc.
│   │   └── validators.ts             # Form validation
│   └── constants/
│       └── config.ts                 # App configuration
│
├── styles/
│   └── index.css                     # Global styles & tokens
│
└── types/
    ├── global.ts                     # Global TypeScript types
    └── supabase.ts                   # Generated Supabase types
```

---

## Benefits of Feature-First Organization

### 1. **Co-Location** 🎯
All code related to a feature lives in one place:
```
features/marketplace/
  ├── MarketplacePage.tsx     ← Route
  ├── PackageCard.tsx          ← Component
  ├── useMarketplaceQuery.ts   ← Hook
  └── marketplaceApi.ts        ← API
```

**Before (Type-First):**
```
pages/MarketplacePage.tsx
components/PackageCard.tsx
hooks/useMarketplaceQuery.ts
lib/marketplaceApi.ts
```
*4 different directories!*

---

### 2. **Feature Boundaries** 🔒
Clear separation prevents unintended dependencies:
```typescript
// ✅ GOOD: Feature imports from within itself
import { PackageCard } from '../components/PackageCard';
import { useMarketplaceQuery } from '../hooks/useMarketplaceQuery';

// ✅ GOOD: Feature imports shared components
import { Button } from '@/components/ui/button';

// ❌ BAD: Feature imports from another feature (creates coupling)
import { DealCard } from '@/features/deals/components/DealCard';
```

---

### 3. **Easy Refactoring & Deletion** 🗑️
Want to remove the entire marketplace feature?
```bash
# Feature-first: Delete one directory
rm -rf src/features/marketplace/

# Type-first: Hunt across 5+ directories
rm pages/MarketplacePage.tsx
rm components/PackageCard.tsx
rm components/PackageGrid.tsx
rm hooks/useMarketplaceQuery.ts
rm hooks/usePackageFilters.ts
rm lib/marketplaceApi.ts
# ... and hunt for more files
```

---

### 4. **Code Splitting** 📦
Easy to lazy-load entire features:
```typescript
// Lazy load entire marketplace feature
const MarketplacePage = lazy(() => 
  import('@/features/marketplace/routes/MarketplacePage')
);

// Bundle splits automatically by feature
// marketplace.chunk.js
// proposals.chunk.js
// deals.chunk.js
```

---

### 5. **Team Collaboration** 👥
Teams can own entire features:
```
Team Sponsorship owns:
- features/marketplace/
- features/matches/
- features/proposals/
- features/deals/

Team Events owns:
- features/ticketing/
- features/feed/
```

**Fewer merge conflicts!** Teams rarely touch the same files.

---

### 6. **Shorter Import Paths** 📏
```typescript
// Feature-first (relative imports within feature)
import { PackageCard } from '../components/PackageCard';
import { useMarketplaceQuery } from '../hooks/useMarketplaceQuery';

// Type-first (long absolute paths)
import { PackageCard } from '@/components/sponsorship/marketplace/PackageCard';
import { useMarketplaceQuery } from '@/hooks/sponsorship/useMarketplaceQuery';
```

---

## Migration Strategy

### Phase 1: Create New Structure (Week 1)
```bash
# 1. Create feature directories
mkdir -p src/features/{marketplace,matches,proposals,deals,analytics,ticketing,feed,profile,settings,dashboard}

# 2. Create subdirectories for each feature
for feature in marketplace matches proposals deals analytics ticketing feed profile settings dashboard; do
  mkdir -p "src/features/$feature/{routes,components,hooks,api,types,utils}"
done

# 3. Create app directory
mkdir -p src/app/{providers,layouts}
```

### Phase 2: Move Shared Components (Week 1)
```bash
# Keep only truly shared components in src/components/
# Move feature-specific components to their features

# Example: Move sponsorship marketplace components
mv src/components/sponsorship/SponsorshipMarketplace.tsx \
   src/features/marketplace/routes/MarketplacePage.tsx

mv src/components/sponsorship/PackageCard.tsx \
   src/features/marketplace/components/PackageCard.tsx
```

### Phase 3: Migrate by Feature (Weeks 2-4)
Migrate one feature at a time to minimize disruption:

**Week 2: Marketplace + Matches**
```bash
# Move marketplace
mv src/pages/SponsorshipPage.tsx \
   src/features/marketplace/routes/MarketplacePage.tsx

mv src/hooks/useMarketplace*.ts \
   src/features/marketplace/hooks/

# Move matches
mv src/components/sponsorship/MatchAlgorithm.tsx \
   src/features/matches/routes/MatchesPage.tsx
```

**Week 3: Proposals + Deals**
```bash
# Move proposals
mv src/components/sponsorship/ProposalNegotiation.tsx \
   src/features/proposals/components/ProposalThread.tsx

# Move deals
mv src/components/sponsorship/PaymentEscrowManager.tsx \
   src/features/deals/components/EscrowTimeline.tsx
```

**Week 4: Analytics + Ticketing + Feed**
```bash
# Move analytics
mv src/components/sponsorship/AnalyticsDashboard.tsx \
   src/features/analytics/routes/AnalyticsPage.tsx

# Move ticketing
mv src/components/tickets/*.tsx \
   src/features/ticketing/components/

# Create new feed feature
# (This is entirely new, so build from scratch)
```

### Phase 4: Update Imports (Week 5)
```typescript
// Use a tool like jscodeshift or manually update imports

// Before:
import { PackageCard } from '@/components/sponsorship/PackageCard';

// After:
import { PackageCard } from '@/features/marketplace/components/PackageCard';
```

### Phase 5: Clean Up (Week 6)
```bash
# Remove old empty directories
rm -rf src/components/sponsorship/
rm -rf src/components/tickets/
rm -rf src/components/campaigns/

# Verify no broken imports
npm run build
npm run test
```

---

## Import Conventions

### Within a Feature (Relative Imports)
```typescript
// In features/marketplace/components/PackageGrid.tsx
import { PackageCard } from './PackageCard';          // Same directory
import { useMarketplaceQuery } from '../hooks/useMarketplaceQuery';  // Up one level
import { MarketplacePage } from '../routes/MarketplacePage';  // Sibling directory
```

### Shared Components (Absolute Imports)
```typescript
// Import from shared components
import { Button } from '@/components/ui/button';
import { WebOnly } from '@/components/gates/WebOnly';
import { TopBar } from '@/components/nav/TopBar';

// Import shared hooks
import { usePlatform } from '@/hooks/usePlatform';
import { useAuth } from '@/hooks/useAuth';

// Import shared utilities
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/formatters';
```

### Cross-Feature Imports (Avoid When Possible)
```typescript
// ⚠️ Try to avoid cross-feature imports
// If needed, consider moving to shared components

// Less ideal:
import { DealCard } from '@/features/deals/components/DealCard';

// Better: Move to shared if used by multiple features
import { DealCard } from '@/components/shared/DealCard';

// Or: Use composition and pass as props
<MarketplacePage 
  dealCardComponent={<DealCard />} 
/>
```

---

## File Naming Conventions

### Route Files
```
MarketplacePage.tsx        ✅ Suffix with "Page"
ProposalDetailPage.tsx     ✅ Descriptive names
AnalyticsPage.tsx          ✅ Matches URL route
```

### Component Files
```
PackageCard.tsx            ✅ PascalCase, descriptive
OfferComparator.tsx        ✅ Clear purpose
EscrowTimeline.tsx         ✅ Matches feature domain
```

### Hook Files
```
useMarketplaceQuery.ts     ✅ Prefix with "use"
useProposalActions.ts      ✅ Describes what it does
useDealDetail.ts           ✅ Singular for detail views
```

### API Files
```
marketplaceApi.ts          ✅ Suffix with "Api"
proposalsApi.ts            ✅ Plural for collections
ticketingApi.ts            ✅ Matches feature name
```

### Type Files
```
marketplace.ts             ✅ Matches feature name
deals.ts                   ✅ Contains all deal types
feed.ts                    ✅ Contains all feed types
```

---

## Feature Module Template

Each feature should follow this structure:

```typescript
// features/[feature-name]/

routes/
  └── [Feature]Page.tsx        # Main route component

components/
  ├── [Feature]Card.tsx        # Display card
  ├── [Feature]List.tsx        # List view
  ├── [Feature]Detail.tsx      # Detail view
  ├── [Feature]Form.tsx        # Create/edit form
  └── [Feature]Actions.tsx     # Action buttons

hooks/
  ├── use[Feature].ts          # Main query hook
  ├── use[Feature]Mutation.ts  # Create/update/delete
  └── use[Feature]State.ts     # Local state management

api/
  └── [feature]Api.ts          # API client functions

types/
  └── [feature].ts             # TypeScript types

utils/
  └── [feature]Helpers.ts      # Helper functions
```

**Example: Marketplace Feature**
```typescript
features/marketplace/
  routes/
    └── MarketplacePage.tsx
  components/
    ├── PackageCard.tsx
    ├── PackageGrid.tsx
    ├── MarketplaceFilters.tsx
    └── QualityBadge.tsx
  hooks/
    ├── useMarketplaceQuery.ts
    ├── useSavePackage.ts
    └── usePackageFilters.ts
  api/
    └── marketplaceApi.ts
  types/
    └── marketplace.ts
  utils/
    └── packageHelpers.ts
```

---

## Automated Migration Script

Here's a Node.js script to help automate the migration:

```javascript
// migrate-to-features.js
const fs = require('fs-extra');
const path = require('path');

const migrations = [
  // Marketplace
  {
    from: 'src/components/sponsorship/SponsorshipMarketplace.tsx',
    to: 'src/features/marketplace/routes/MarketplacePage.tsx'
  },
  {
    from: 'src/components/sponsorship/PackageCard.tsx',
    to: 'src/features/marketplace/components/PackageCard.tsx'
  },
  // Matches
  {
    from: 'src/components/sponsorship/MatchAlgorithm.tsx',
    to: 'src/features/matches/routes/MatchesPage.tsx'
  },
  // Proposals
  {
    from: 'src/components/sponsorship/ProposalNegotiation.tsx',
    to: 'src/features/proposals/components/ProposalThread.tsx'
  },
  // Deals
  {
    from: 'src/components/sponsorship/PaymentEscrowManager.tsx',
    to: 'src/features/deals/components/EscrowTimeline.tsx'
  },
  // Analytics
  {
    from: 'src/components/sponsorship/AnalyticsDashboard.tsx',
    to: 'src/features/analytics/routes/AnalyticsPage.tsx'
  },
  // Add more migrations...
];

async function migrate() {
  for (const { from, to } of migrations) {
    console.log(`Moving ${from} -> ${to}`);
    
    // Ensure destination directory exists
    await fs.ensureDir(path.dirname(to));
    
    // Move file
    await fs.move(from, to, { overwrite: false });
    
    // TODO: Update imports in the moved file
    // TODO: Find and update all imports to this file
  }
  
  console.log('✅ Migration complete!');
}

migrate().catch(console.error);
```

Run with:
```bash
node migrate-to-features.js
```

---

## Testing During Migration

### 1. Keep Tests Passing
```bash
# Run tests after each migration step
npm run test

# If tests fail, fix imports immediately
```

### 2. Update Test Files
```bash
# Move test files with their components
mv src/components/sponsorship/__tests__/PackageCard.test.tsx \
   src/features/marketplace/components/__tests__/PackageCard.test.tsx
```

### 3. Feature-Level Tests
```typescript
// features/marketplace/__tests__/marketplace.test.tsx
describe('Marketplace Feature', () => {
  it('renders marketplace page', () => {
    // Test entire feature
  });
  
  it('filters packages', () => {
    // Test feature behavior
  });
});
```

---

## Gradual Migration Approach

You don't have to migrate everything at once. Use a **gradual approach**:

### Step 1: New Features → Feature-First
All new features go in `src/features/`:
```bash
# New feed feature
src/features/feed/
  ├── routes/FeedPage.tsx
  ├── components/FeedItemCard.tsx
  └── hooks/useFeed.ts
```

### Step 2: Active Development → Migrate Next
Migrate features currently under active development:
```bash
# If working on proposals, migrate it
src/features/proposals/
```

### Step 3: Legacy Code → Migrate When Touched
Only migrate old code when you need to modify it:
```bash
# Working on analytics? Migrate it then
src/features/analytics/
```

### Step 4: Old Code → Can Stay
Code that's stable and rarely changes can stay in old structure until needed.

---

## Backward Compatibility

During migration, maintain backward compatibility:

```typescript
// src/components/sponsorship/SponsorshipMarketplace.tsx (deprecated)
/**
 * @deprecated Use @/features/marketplace/routes/MarketplacePage instead
 */
export { MarketplacePage as SponsorshipMarketplace } from '@/features/marketplace/routes/MarketplacePage';
```

This allows old imports to keep working while you migrate:
```typescript
// Old code still works (with deprecation warning)
import { SponsorshipMarketplace } from '@/components/sponsorship/SponsorshipMarketplace';

// New code uses new path
import { MarketplacePage } from '@/features/marketplace/routes/MarketplacePage';
```

---

## Summary

### Why Feature-First?
✅ **Co-location** - Related code lives together
✅ **Clear boundaries** - Features are self-contained
✅ **Easy refactoring** - Delete entire features easily
✅ **Code splitting** - Automatic bundle optimization
✅ **Team ownership** - Clear responsibility
✅ **Shorter imports** - Relative paths within features

### Migration Timeline
- **Week 1:** Create structure + move shared components
- **Weeks 2-4:** Migrate features one by one
- **Week 5:** Update all imports
- **Week 6:** Clean up + verify

### Current Status
✅ Architecture foundation ready (platform detection, gates, tokens)
⚠️ File structure still type-first (`src/components/`, `src/pages/`)
📋 Feature-first migration is next logical step

The feature-first organization makes Liventix more maintainable as it scales from 10 features to 100+ features. 🚀

