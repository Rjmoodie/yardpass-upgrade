# Liventix Sponsorship System Structure

## Overview
Liventix's sponsorship wing is an **enterprise-grade marketplace** that connects sponsors with events through intelligent matching, proposal negotiation, deliverable tracking, and automated payouts. It's designed to create a data-driven sponsorship economy on the platform.

---

## Core Components

### 1. Sponsor Management
**Tables:**
- `sponsors` - Base sponsor accounts
- `sponsor_profiles` - Deep targeting profiles (industry, budget, brand objectives, target audience)
- `sponsor_public_profiles` - Public-facing sponsor pages with slug, badges, verification
- `sponsor_members` - Team members with roles (owner, admin, editor, viewer)

**Features:**
- Multi-account management (sponsors can manage multiple brands)
- Team collaboration with role-based permissions
- Verification system (`none` | `pending` | `verified` | `revoked`)
- Public visibility controls (`hidden` | `limited` | `full`)
- Brand values, objectives, and case studies
- Industry categorization and company size tracking

**Files:**
- `src/types/sponsorship-complete.ts` - TypeScript types
- `src/components/sponsor/SponsorDashboard.tsx` - Main dashboard
- `src/components/sponsor/SponsorProfileManager.tsx` - Profile editor
- `src/hooks/useSponsorAccounts.ts` - Account management hook
- `src/hooks/useSponsorMode.ts` - Sponsor mode toggle

---

### 2. Sponsorship Packages
**Tables:**
- `sponsorship_packages` - Package definitions (tier, price, benefits, inventory)
- `package_templates` - Reusable package templates for organizers
- `package_variants` - Different variants of packages (e.g., Silver, Gold, Platinum)

**Features:**
- Tiered pricing (Bronze, Silver, Gold, Platinum, Custom)
- Expected reach and engagement metrics
- Quality scoring (0-100 based on historical performance)
- Inventory management
- Package types: `digital`, `onsite`, `hybrid`
- Visibility controls (`private`, `org`, `public`)
- Stat snapshots for historical tracking

**Files:**
- `src/components/sponsorship/SponsorshipMarketplace.tsx` - Browse packages
- `src/components/organizer/PackageEditor.tsx` - Create/edit packages
- `src/components/sponsor/PackagesGrid.tsx` - Package browsing UI
- `supabase/migrations/20251021_0001_sponsorship_foundation.sql` - Schema

**Key Columns:**
```sql
sponsorship_packages:
  - id, event_id, tier, title, description
  - price_cents, currency, inventory, sold_count
  - expected_reach, avg_engagement_score
  - package_type, quality_score
  - benefits (jsonb), visibility
```

---

### 3. Intelligent Matching System
**Tables:**
- `sponsorship_matches` - Pairwise sponsor-event fit scores
- `event_audience_insights` - Aggregated behavioral & demographic data
- `match_features` - Feature vectors for ML matching
- `match_feedback` - User feedback for improving algorithm
- `fit_recalc_queue` - Queue for incremental score updates

**Matching Algorithm:**
1. **Budget Fit** - Sponsor budget vs package price
2. **Audience Overlap** - Demographic & psychographic alignment
3. **Geographic Fit** - Sponsor regions vs event location
4. **Engagement Quality** - Historical engagement metrics
5. **Objectives Similarity** - NLP matching on brand objectives & event description
6. **Semantic Search** - Vector embeddings for objectives (via `objectives_embedding`)

**Match Statuses:**
- `pending` - Initial algorithmic match
- `suggested` - Shown to sponsor
- `accepted` - Sponsor interested
- `rejected` - Not a fit

**Files:**
- `src/components/sponsorship/MatchAlgorithm.tsx` - Match UI
- `src/hooks/useMarketplaceSponsorships.ts` - Marketplace hook
- `supabase/migrations/20251021_0002_sponsorship_views.sql` - Views & RPC functions

**Quality Metrics:**
```sql
event_audience_insights:
  - attendee_count, avg_dwell_time_ms
  - geo_distribution, age_segments
  - engagement_score (0..1)
  - ticket_conversion_rate (0..1)
  - social_mentions, sentiment_score (-1..1)
```

---

### 4. Proposal & Negotiation System
**Tables:**
- `proposal_threads` - Conversation threads between sponsors & organizers
- `proposal_messages` - Individual messages with offers and attachments
- `proposal_status`: `draft` | `sent` | `counter` | `accepted` | `rejected` | `expired`

**Features:**
- Multi-round negotiation
- Structured offer format (price, benefits, deliverables)
- Attachment support (PDFs, images, contracts)
- Real-time updates
- Expiration management

**Files:**
- `src/components/sponsorship/ProposalNegotiation.tsx` - Negotiation UI
- `supabase/migrations/20251022_0003_sponsorship_enterprise_features.sql` - Schema

**Workflow:**
```
Organizer → Creates package
   ↓
Sponsor → Browses marketplace
   ↓
Match suggested (AI)
   ↓
Sponsor → Sends proposal / organizer counter-offers
   ↓
Accept → Creates sponsorship order
```

---

### 5. Orders & Payment System
**Tables:**
- `sponsorship_orders` - Purchase records
- `sponsorship_payouts` - Organizer payouts
- `payout_configuration` - Organizer payout settings
- `payout_queue` - Queue for processing payouts

**Payment Flow:**
1. **Order Creation** - When proposal accepted or direct purchase
2. **Stripe Payment** - Sponsor pays via Stripe
3. **Escrow State** - Funds held until deliverables completed
4. **Milestone Tracking** - Optional multi-stage payments
5. **Payout Processing** - Organizer receives funds via Stripe Connect
6. **Platform Fee** - Liventix takes % (configurable per organizer)

**Escrow States:**
- `pending` - Order created, awaiting payment
- `funded` - Payment received, held in escrow
- `locked` - Deliverables pending
- `released` - Funds sent to organizer
- `refunded` - Sponsor refunded

**Files:**
- `src/components/sponsor/SponsorCheckoutButton.tsx` - Checkout UI
- `src/components/sponsor/SponsorshipCheckoutModal.tsx` - Modal
- `src/components/sponsorship/PaymentEscrowManager.tsx` - Escrow management
- `supabase/functions/create-sponsorship-checkout/` - Edge function
- `supabase/functions/process-sponsorship-payout/` - Edge function

**Key Columns:**
```sql
sponsorship_orders:
  - id, event_id, sponsor_id, package_id
  - amount_cents, currency, status
  - milestone (jsonb), proof_assets (jsonb)
  - escrow_state, payout_status
  - version_number (optimistic locking)
```

---

### 6. Deliverables & SLA Tracking
**Tables:**
- `deliverables` - Required sponsor deliverables (logo, mentions, content)
- `deliverable_proofs` - Evidence of completion (screenshots, metrics)
- `sponsorship_slas` - Service-level agreements with breach policies

**Deliverable Types:**
- Logo placement (website, posters, signage)
- Social media mentions
- Product sampling
- Speaking slot
- Booth space
- Email blast
- Custom activations

**Workflow:**
```
Package includes deliverables
   ↓
Order placed
   ↓
Organizer fulfills (uploads proof)
   ↓
Sponsor reviews & approves
   ↓
Escrow released → Payout
```

**Files:**
- `src/components/sponsorship/AnalyticsDashboard.tsx` - Deliverable tracking
- `src/components/EventSponsorshipManagement.tsx` - Organizer view
- `supabase/migrations/20251022_0003_sponsorship_enterprise_features.sql` - Schema

**Key Columns:**
```sql
deliverables:
  - id, event_id, sponsor_id, type
  - spec (jsonb), status, due_at
  - evidence_required (boolean)

deliverable_proofs:
  - id, deliverable_id, asset_url
  - metrics (jsonb), submitted_at, approved_at
```

---

### 7. Analytics & Reporting
**Tables:**
- `event_stat_snapshots` - Time-series metrics
- `sponsorship_analytics_daily` - Aggregated daily stats
- `event_quality_scores` - Computed event quality tiers

**Metrics Tracked:**
- Impressions & reach
- Engagement (clicks, shares, comments)
- Conversion rates
- ROI calculations
- Quality tier: `low` | `medium` | `high` | `premium`
- Sentiment analysis

**Files:**
- `src/components/sponsorship/AnalyticsDashboard.tsx` - Dashboard
- `src/components/campaigns/CampaignAnalytics.tsx` - Campaign view
- `src/hooks/useCampaignAnalytics.ts` - Analytics hook
- `src/lib/api/campaigns.ts` - API utilities

**Views & RPCs:**
```sql
-- Aggregated package cards with event data
sponsorship_package_cards_view

-- Quality scoring with engagement metrics
event_quality_scores_view

-- RPC: Get campaign daily analytics
rpc_campaign_analytics_daily(campaign_id)
```

---

### 8. Marketplace & Discovery
**Features:**
- Search & filters (category, price range, location, quality tier)
- Semantic search (vector embeddings)
- Sort by: price, quality, relevance, date
- Faceted navigation
- Quality badges (premium, high, medium)
- Verification badges
- Recommendations based on sponsor profile

**Files:**
- `src/components/sponsorship/SponsorshipMarketplace.tsx` - Main marketplace
- `src/components/sponsor/SponsorMarketplace.tsx` - Sponsor view
- `src/pages/SponsorshipPage.tsx` - Public page
- `src/integrations/supabase/sponsorship-client.ts` - Client SDK

**API:**
```typescript
sponsorshipClient.getPackages(filters, pagination)
sponsorshipClient.searchSponsorships(query, filters)
sponsorshipClient.createMatch(eventId, sponsorId)
sponsorshipClient.updateMatchStatus(matchId, status)
```

---

### 9. Notifications & Real-Time Updates
**Tables:**
- `sponsorship_notifications` - In-app notifications
- Real-time subscriptions via Supabase Realtime

**Notification Types:**
- `match_suggested` - New match for sponsor
- `proposal_received` - Organizer received proposal
- `proposal_accepted` - Sponsor's proposal accepted
- `deliverable_due` - Deliverable deadline approaching
- `deliverable_submitted` - Organizer submitted proof
- `payout_completed` - Funds released to organizer

**Files:**
- `src/components/sponsorship/NotificationSystem.tsx` - Notification center
- `supabase/functions/send-sponsorship-notification/` - Edge function

---

### 10. Campaign Advertising (Integrated)
**Tables:**
- `campaigns` - Ad campaigns
- `campaign_creatives` - Ad creatives (images, videos)
- `campaign_boosts` - Boost campaigns for events
- `campaign_impressions` - Impression tracking
- `campaign_analytics_daily` - Daily rollups

**Features:**
- Sponsored event placements in feed
- Targeted advertising
- Budget & schedule management
- Creative management (upload, preview, A/B test)
- Performance analytics (CTR, CPC, conversions)

**Integration:**
- Campaigns can be created from sponsorship orders
- Sponsors can promote their sponsored events
- Unified analytics dashboard

**Files:**
- `src/components/campaigns/CampaignDashboard.tsx` - Campaign manager
- `src/components/campaigns/CreativeManager.tsx` - Creative uploads
- `src/components/campaigns/CampaignAnalytics.tsx` - Analytics
- `src/hooks/useCampaigns.ts` - Campaign hook
- `src/lib/adTracking.ts` - Impression & click tracking

---

## User Roles & Permissions

### Sponsor Roles
- **Owner** - Full access, billing, team management
- **Admin** - Manage deals, proposals, deliverables
- **Editor** - View deals, submit deliverables
- **Viewer** - Read-only access

### Organizer Permissions
- Create packages
- Review proposals
- Accept/reject matches
- Upload deliverable proofs
- Configure payout settings
- View analytics

### Platform Admin
- Review sponsor verifications
- Monitor fraud
- Adjust match algorithms
- Set platform fees
- Manage escrow disputes

---

## Key Workflows

### Sponsor Onboarding
1. Create sponsor account
2. Complete profile (industry, budget, objectives)
3. Add team members
4. Request verification (optional)
5. Browse marketplace

### Package Creation
1. Organizer creates event
2. Define sponsorship packages (tiers, pricing, benefits)
3. Set deliverables & SLAs
4. Publish to marketplace
5. AI suggests matches

### Purchase Flow
1. Sponsor discovers package (marketplace or match)
2. Review package details & event insights
3. Send proposal OR direct purchase
4. Negotiate (if proposal)
5. Accept terms → Create order
6. Payment via Stripe
7. Funds held in escrow

### Fulfillment Flow
1. Organizer receives deliverable requirements
2. Fulfill deliverables (logos, mentions, etc.)
3. Upload proof (screenshots, metrics)
4. Sponsor reviews & approves
5. Escrow releases funds
6. Payout processed to organizer

---

## Technical Architecture

### Database Layer
- **PostgreSQL** (via Supabase)
- **Row-Level Security** for multi-tenancy
- **JSONB** for flexible schema (benefits, deliverables, metrics)
- **GIN indexes** for array/JSONB queries
- **Materialized views** for analytics
- **pgvector** extension for semantic search (embeddings)

### API Layer
- **Supabase Edge Functions** (Deno)
- RESTful endpoints + RPC functions
- Stripe integration for payments
- Webhook handlers for real-time updates

### Frontend Layer
- **React + TypeScript**
- **TanStack Query** for data fetching
- **Zustand** for state management (sponsor mode)
- **Tailwind CSS** for styling
- Lazy-loaded components for performance

### Integration Points
- **Stripe Connect** - Organizer payouts
- **Stripe Checkout** - Sponsor payments
- **Mux** - Video analytics (for engagement metrics)
- **Mapbox** - Geographic targeting
- **OpenAI** (optional) - Semantic matching via embeddings

---

## Security & Compliance

### Row-Level Security (RLS)
- Sponsors can only see their own data
- Organizers can only manage their events
- Public marketplace respects visibility settings

### Payment Security
- PCI compliance via Stripe
- Escrow system protects both parties
- Refund policies enforced programmatically

### Data Privacy
- Audience insights are **aggregated only**
- No PII shared with sponsors
- GDPR/CCPA compliant consent tracking

---

## Performance Optimizations

### Caching
- Package listings cached (5 min)
- Match scores precomputed
- Analytics views materialized

### Indexes
- Composite indexes on frequently queried fields
- GIN indexes for JSONB/array queries
- Partial indexes for active packages

### Queues
- `fit_recalc_queue` - Async match score updates
- `payout_queue` - Batch payout processing
- Background jobs for analytics rollups

---

## Future Enhancements (Roadmap)

### Phase 2 Features
- [ ] Multi-currency support
- [ ] Advanced fraud detection
- [ ] Automated A/B testing for packages
- [ ] AI-generated package recommendations
- [ ] Contract templates & e-signatures
- [ ] Dispute resolution system

### Phase 3 Features
- [ ] Blockchain-based proof of delivery (NFTs)
- [ ] Carbon offset tracking for events
- [ ] Integration with CRM systems (Salesforce, HubSpot)
- [ ] White-label marketplace for large organizers
- [ ] Predictive ROI modeling

---

## Files & Directories

### Core Types
```
src/types/
  - sponsorship-complete.ts (511 lines)
  - db-sponsorship.ts
  - campaigns.ts
  - sponsors.ts
```

### Components
```
src/components/
  sponsorship/
    - SponsorshipMarketplace.tsx (472 lines)
    - ProposalNegotiation.tsx
    - MatchAlgorithm.tsx
    - AnalyticsDashboard.tsx
    - PaymentEscrowManager.tsx
    - NotificationSystem.tsx
  
  sponsor/
    - SponsorDashboard.tsx
    - SponsorMarketplace.tsx
    - SponsorCheckoutButton.tsx
    - SponsorAnalytics.tsx
    - SponsorTeam.tsx
    - PackagesGrid.tsx
  
  campaigns/
    - CampaignDashboard.tsx
    - CampaignCreator.tsx
    - CreativeManager.tsx
    - CampaignAnalytics.tsx
```

### Hooks
```
src/hooks/
  - useSponsorAccounts.ts
  - useSponsorMode.ts
  - useSponsorDeals.ts
  - useMarketplaceSponsorships.ts
  - useEventSponsorships.ts
  - useCampaigns.ts
  - useCampaignAnalytics.ts
```

### Pages
```
src/pages/
  - SponsorshipPage.tsx
  - SponsorLanding.tsx
  - CampaignDashboardPage.tsx
```

### Database
```
supabase/migrations/
  - 20251021_0000_sponsorship_system_fixed.sql
  - 20251021_0001_sponsorship_foundation.sql (194 lines)
  - 20251021_0002_sponsorship_views.sql
  - 20251022_0001_optimized_sponsorship_system.sql
  - 20251022_0002_sponsorship_cleanup_and_constraints.sql
  - 20251022_0003_sponsorship_enterprise_features.sql
  - 20251022_0004_sponsorship_final_polish.sql
  - 20251022_0005_sponsorship_ship_blockers.sql
```

### Edge Functions
```
supabase/functions/
  - create-sponsorship-checkout/
  - process-sponsorship-payout/
  - send-sponsorship-notification/
  - recalc-match-scores/
```

---

## Key Metrics & KPIs

### Business Metrics
- **GMV** (Gross Merchandise Value) - Total sponsorship revenue
- **Take Rate** - Platform fee as % of GMV
- **Match Acceptance Rate** - % of suggested matches accepted
- **Conversion Rate** - Marketplace visits → orders
- **Average Deal Size** - Mean sponsorship order value
- **Fulfillment Rate** - % of deliverables completed on time

### Technical Metrics
- **Match Computation Time** - Time to calculate fit scores
- **API Response Time** - P95 latency for key endpoints
- **Search Relevance** - Click-through rate on search results
- **Payout Success Rate** - % of payouts completed without error

---

## Summary
Liventix's sponsorship system is a **full-stack marketplace** with:
- ✅ Intelligent AI matching
- ✅ Proposal negotiation
- ✅ Escrow & milestone payments
- ✅ Deliverable tracking & proof of work
- ✅ Real-time analytics
- ✅ Quality scoring & reputation
- ✅ Campaign advertising integration

It's designed to scale from small local events to enterprise sponsorships, with strong data privacy, security, and compliance built in from the ground up.

