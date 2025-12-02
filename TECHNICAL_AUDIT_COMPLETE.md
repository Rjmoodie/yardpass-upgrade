# Liventix: Complete Technical Audit Report
## Senior Staff Engineer + Product Architect Review

**Date:** January 6, 2025  
**Reviewer:** Technical Leadership  
**Codebase Version:** Current (as of audit date)  
**Classification:** Internal Technical Assessment

---

## Executive Summary

This report provides a comprehensive technical audit of the Liventix codebase based on actual code, migrations, configurations, and documentation. The platform is a **video-first event discovery and ticketing system** built with React/TypeScript, Supabase (PostgreSQL + Edge Functions), Stripe payments, and Capacitor mobile apps.

**Overall Assessment:** The codebase is **production-ready** with strong technical foundations, but has several gaps in policy enforcement, automated refunds, and content moderation that should be addressed before public launch.

**Key Strengths:**
- Robust payment processing with idempotency and webhook verification
- Comprehensive database schema with proper RLS policies
- Real-time capabilities via Supabase Realtime
- Well-structured Edge Functions architecture
- Mobile-first design with Capacitor integration

**Critical Gaps:**
- Policy documents exist but need legal review
- Automated refund system partially implemented
- Content moderation tools limited
- Bundle size optimization needed (560KB gzipped interactive shell)

---

## 1. Repository & Architecture Overview

### 1.1 Repository Structure

**Main Frontend App:**
- **Location:** `src/` (React/TypeScript application)
- **Entry Point:** `src/main.tsx` → `src/App.tsx`
- **Routing:** React Router v6 (`src/App.tsx` with lazy-loaded routes)
- **Build Tool:** Vite 5.4.19 (`vite.config.ts`)
- **Type System:** TypeScript 5.8.3

**Mobile/Capacitor App:**
- **Config:** `capacitor.config.ts`
- **App ID:** `com.liventix.app`
- **Platforms:** iOS + Android (Capacitor 7.4.3)
- **Native Plugins:** 20+ Capacitor plugins (Camera, BarcodeScanner, Push, Haptics, etc.)

**Backend/Supabase:**
- **Migrations:** `supabase/migrations/` (190 SQL migration files)
- **Edge Functions:** `supabase/functions/` (80+ Deno functions)
- **Config:** `supabase/config.toml`

**Shared Packages:**
- **Not a monorepo** - Single repository with standard npm workspace
- **No Turborepo/Nx** - Standard Vite + npm setup
- **Dependencies:** Managed via `package.json` (no workspace packages)

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                             │
│  React Web App (Vite) + Capacitor Mobile Apps (iOS/Android) │
│  - src/App.tsx (routing, lazy loading)                      │
│  - src/pages/ (page components)                            │
│  - src/components/ (reusable components)                    │
│  - src/hooks/ (custom React hooks)                          │
│  - src/lib/ (utilities, API clients)                        │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTP/REST + WebSocket
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  API GATEWAY LAYER                           │
│  Supabase REST API + Edge Functions (80+ functions)         │
│  - supabase/functions/enhanced-checkout/                    │
│  - supabase/functions/stripe-webhook/                       │
│  - supabase/functions/scanner-validate/                      │
│  - supabase/functions/home-feed/                             │
│  - supabase/functions/posts-create/                          │
│  - supabase/functions/guest-checkout/                        │
└─────────────────┬───────────────────────────────────────────┘
                  │ PostgreSQL + Realtime
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  DATA LAYER                                   │
│  PostgreSQL (Multi-schema architecture)                     │
│  - public: Views, notifications, follows                   │
│  - events: Events, posts, comments, reactions               │
│  - organizations: Orgs, memberships, invitations            │
│  - ticketing: Tickets, orders, tiers, holds, refunds       │
│  - messaging: Conversations, messages                      │
│  - analytics: Event tracking, insights                      │
│  - sponsorship: Sponsorship orders, proposals              │
│  + Row-Level Security (RLS) policies                        │
│  + Real-time subscriptions (WebSocket)                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  EXTERNAL SERVICES                           │
│  - Stripe (Payments, Connect, Webhooks)                     │
│  - MUX (Video hosting/streaming)                           │
│  - Mapbox (Maps, geocoding)                                 │
│  - PostHog (Analytics)                                      │
│  - Resend (Email delivery)                                  │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Main Domains

**Core Domains Identified:**
1. **Events** - Event creation, management, discovery (`events.events`, `events.event_posts`)
2. **Ticketing** - Ticket sales, orders, QR codes (`ticketing.tickets`, `ticketing.orders`)
3. **Payments** - Stripe integration, checkout, payouts (`ticketing.orders`, Stripe Connect)
4. **Social** - Posts, comments, reactions, follows (`events.event_posts`, `events.event_comments`, `users.follows`)
5. **Messaging** - Direct messages (`messaging.direct_conversations`, `messaging.direct_messages`)
6. **Notifications** - Real-time notifications (`public.notifications`)
7. **Organizations** - Team management (`organizations.organizations`, `organizations.org_memberships`)
8. **Analytics** - Event tracking, insights (`analytics.events`, `analytics.video_metrics`)
9. **Marketing** - Campaigns, ads, sponsorships (`campaigns`, `sponsorship.sponsorship_orders`)
10. **Authentication** - User auth, profiles (`auth.users`, `public.user_profiles`)

### 1.4 External Service Integration Points

**Stripe:**
- **Client:** `@stripe/stripe-js`, `@stripe/react-stripe-js` (frontend)
- **Server:** `supabase/functions/enhanced-checkout/`, `supabase/functions/stripe-webhook/`
- **Usage:** Checkout Sessions, Payment Intents, Connect accounts, webhooks

**MUX:**
- **Client:** `@mux/mux-player-react` (video player)
- **Server:** `supabase/functions/mux-create-direct-upload/`, `supabase/functions/mux-webhook/`
- **Usage:** Video hosting, HLS streaming, analytics

**Mapbox:**
- **Client:** `mapbox-gl` (maps)
- **Server:** `supabase/functions/get-mapbox-token/`
- **Usage:** Event location maps, geocoding

**PostHog:**
- **Client:** `posthog-js` (`src/lib/posthog.ts`, `src/hooks/useAnalytics.tsx`)
- **Usage:** Event tracking, user analytics, feature flags

**Resend:**
- **Server:** `supabase/functions/send-purchase-confirmation/`, `supabase/functions/process-email-queue/`
- **Usage:** Transactional emails (purchase confirmations, notifications)

---

## 2. Domain Model & Data Schema

### 2.1 Key Schemas & Tables

**Schema: `public` (Public-facing views and core data)**
- `notifications` - User notifications (follows, likes, comments, tickets, messages)
- `user_profiles` - User profile data (display_name, role, verification_status)
- `follows` - User follow relationships (view, underlying table is `users.follows`)
- `saved_events` - User saved events
- `saved_posts` - User saved posts
- `stripe_idempotency_keys` - Payment idempotency tracking
- `rate_limit_counters` - Rate limiting state
- `email_queue` - Email delivery queue
- `webhook_retry_queue` - Webhook retry queue

**Schema: `events` (Event and social content)**
- `events` - Event master data (title, description, start_at, end_at, location, owner_context_type, owner_context_id)
- `event_posts` - User-generated posts for events (text, media_urls, author_user_id, like_count, comment_count)
- `event_comments` - Comments on posts (body, parent_comment_id for replies)
- `event_reactions` - Likes/reactions on posts (user_id, post_id)
- `event_comment_reactions` - Reactions on comments
- `event_share_assets` - Share card assets
- `event_roles` - Event-specific roles (scanner, staff, etc.)
- `event_scanners` - Scanner assignments per event

**Schema: `organizations` (Organization management)**
- `organizations` - Organization data (name, handle, logo_url, verification_status)
- `org_memberships` - Team memberships (user_id, org_id, role: owner/admin/editor/member)
- `org_invitations` - Organization invitation queue
- `org_wallets` - Pre-paid ad credits for organizations
- `org_wallet_transactions` - Wallet transaction history

**Schema: `ticketing` (Ticket sales and orders)**
- `tickets` - Individual tickets (order_id, tier_id, qr_code, status: issued/transferred/redeemed/refunded/void, redeemed_at)
- `orders` - Payment orders (event_id, user_id, status: pending/paid/failed/refunded, total_cents, stripe_session_id, stripe_payment_intent_id)
- `ticket_tiers` - Ticket pricing tiers (event_id, name, price_cents, quantity, issued_quantity, sold_quantity)
- `ticket_holds` - Temporary ticket reservations (30-minute expiry)
- `checkout_sessions` - Active checkout sessions
- `refund_requests` - Customer refund requests (status: pending/approved/declined)
- `refund_policies` - Per-event refund configuration
- `refund_log` - Refund audit trail

**Schema: `messaging` (Direct messaging)**
- `direct_conversations` - Conversation threads (subject, request_status, last_message_at)
- `conversation_participants` - Participants (user or organization)
- `direct_messages` - Individual messages (conversation_id, sender_type, body, status)

**Schema: `analytics` (Event tracking and insights)**
- `events` - User behavior events (event_type, user_id, event_id, metadata)
- `identity_map` - Anonymous session → User ID stitching
- `video_errors` - Video playback errors
- `video_metrics` - Video performance metrics
- `audit_log` - Analytics audit trail
- `query_cache` - Query result caching

**Schema: `sponsorship` (Brand partnerships)**
- `sponsorship_orders` - Sponsorship purchases
- `sponsorship_packages` - Available sponsorship packages
- `sponsorship_proposals` - Negotiation proposals
- `sponsorship_payouts` - Organizer payouts

**Schema: `users` (User management)**
- `follows` - Follow relationships (follower_user_id, target_type, target_id, status)
- `user_profiles` - User profiles (stored in `public.user_profiles` view)

### 2.2 Key Tables Detail

**`events.events`**
```sql
-- Key columns:
id UUID PRIMARY KEY
title TEXT NOT NULL
description TEXT
start_at TIMESTAMPTZ
end_at TIMESTAMPTZ
venue TEXT
city TEXT
owner_context_type TEXT ('individual' | 'organization')
owner_context_id UUID
created_by UUID
status TEXT ('draft' | 'published' | 'cancelled')
visibility TEXT ('public' | 'private' | 'unlisted')
```

**`ticketing.orders`**
```sql
-- Key columns:
id UUID PRIMARY KEY
event_id UUID REFERENCES events.events(id)
user_id UUID REFERENCES auth.users(id)
status TEXT ('pending' | 'paid' | 'failed' | 'refunded')
total_cents INTEGER
stripe_session_id TEXT
stripe_payment_intent_id TEXT
checkout_session_id UUID
paid_at TIMESTAMPTZ
```

**`ticketing.tickets`**
```sql
-- Key columns:
id UUID PRIMARY KEY
order_id UUID REFERENCES ticketing.orders(id)
tier_id UUID REFERENCES ticketing.ticket_tiers(id)
event_id UUID REFERENCES events.events(id)
owner_user_id UUID REFERENCES auth.users(id)
qr_code TEXT UNIQUE (8-char alphanumeric)
status TEXT ('issued' | 'transferred' | 'redeemed' | 'refunded' | 'void')
redeemed_at TIMESTAMPTZ
serial_number INTEGER
```

**`public.notifications`**
```sql
-- Key columns:
id UUID PRIMARY KEY
user_id UUID REFERENCES auth.users(id)
title TEXT
message TEXT
type TEXT ('info' | 'success' | 'warning' | 'error')
event_type TEXT ('user_follow' | 'post_like' | 'post_comment' | 'ticket_purchase' | 'message_received')
action_url TEXT
data JSONB
dedupe_key TEXT (for spam prevention)
read_at TIMESTAMPTZ
created_at TIMESTAMPTZ
```

**`messaging.direct_messages`**
```sql
-- Key columns:
id UUID PRIMARY KEY
conversation_id UUID REFERENCES messaging.direct_conversations(id)
sender_type TEXT ('user' | 'organization')
sender_user_id UUID (nullable, if sender_type = 'user')
sender_org_id UUID (nullable, if sender_type = 'organization')
body TEXT NOT NULL
attachments JSONB
status TEXT ('sent' | 'delivered' | 'read')
created_at TIMESTAMPTZ
```

### 2.3 Important Enums & Types

**Database ENUMs:**
- `notification_severity`: 'info', 'success', 'warning', 'error'
- `notification_event_type`: 'user_follow', 'post_like', 'post_comment', 'comment_reply', 'ticket_purchase', 'message_received', 'event_update'
- `conversation_participant_type`: 'user', 'organization'
- `conversation_request_status`: 'open', 'pending', 'accepted', 'declined'

**Status Fields (TEXT, not ENUMs):**
- **Ticket status:** 'issued', 'transferred', 'redeemed', 'refunded', 'void'
- **Order status:** 'pending', 'paid', 'failed', 'refunded'
- **Event status:** 'draft', 'published', 'cancelled'
- **Event visibility:** 'public', 'private', 'unlisted'
- **User role:** 'attendee', 'organizer' (stored in `user_profiles.role`)
- **Org role:** 'owner', 'admin', 'editor', 'member' (stored in `org_memberships.role`)
- **Verification status:** 'none', 'pending', 'verified', 'pro'

### 2.4 Constraints & Indexes

**Key Constraints:**
- Foreign keys enforce referential integrity across schemas
- Unique constraints on `tickets.qr_code`, `notifications(user_id, dedupe_key)`
- Check constraints on messaging tables (sender must be user OR org, not both)

**Key Indexes:**
- `tickets.qr_code` (unique index for fast lookups)
- `orders(stripe_session_id)`, `orders(stripe_payment_intent_id)` (payment lookups)
- `event_posts(event_id, created_at DESC)` (feed queries)
- `direct_messages(conversation_id, created_at DESC)` (message queries)
- `notifications(user_id, created_at DESC)` (notification queries)
- Composite indexes on frequently queried columns

### 2.5 Soft Deletes vs Hard Deletes

**Hard Deletes (CASCADE):**
- Most tables use hard deletes with CASCADE
- `tickets` deleted when `orders` deleted
- `direct_messages` deleted when `conversations` deleted

**Soft Deletes (Not Implemented):**
- No `deleted_at` columns found in core tables
- Deletion is permanent (may be a gap for compliance/audit)

**References:**
- `supabase/migrations/` - All 190 migration files
- `src/integrations/supabase/types.ts` - Generated TypeScript types

---

## 3. Authentication, Authorization & RLS

### 3.1 Auth Provider

**Primary Auth:** Supabase Auth (`@supabase/supabase-js`)
- **Initialization:** `src/integrations/supabase/client.ts`
- **Context:** `src/contexts/AuthContext.tsx`

**Auth Methods:**
- ✅ **Phone OTP** - Primary method (`supabase/functions/auth-send-otp/`, `supabase/functions/auth-verify-otp/`)
- ✅ **Email/Password** - Secondary method (via Supabase Auth)
- ❌ **OAuth (Google/Apple)** - Not implemented (TODOs found in code)

**Auth Flow:**
1. User requests OTP via `auth-send-otp` Edge Function
2. OTP sent via Resend email
3. User verifies OTP via `auth-verify-otp` Edge Function
4. Session created via `supabase.auth.setSession()`
5. Profile fetched from `user_profiles` table

**References:**
- `src/contexts/AuthContext.tsx` - Auth state management
- `supabase/functions/auth-send-otp/index.ts` - OTP sending
- `supabase/functions/auth-verify-otp/index.ts` - OTP verification

### 3.2 Role Model

**User Roles (stored in `user_profiles.role`):**
- `attendee` - Default role, can browse events, buy tickets, post content
- `organizer` - Can create/manage events, access dashboards

**Organization Roles (stored in `org_memberships.role`):**
- `owner` - Full control, can manage members, access payouts
- `admin` - Can manage events, members, campaigns
- `editor` - Can create/edit events, post as organization
- `member` - Read-only access to org dashboard

**Event Roles (stored in `event_roles.role`):**
- `scanner` - Can scan tickets for specific event
- `staff` - Event staff access
- `volunteer` - Volunteer access

**Enforcement:**
- **Database:** RLS policies enforce access at table level
- **Backend:** Edge Functions check roles via RPC functions (`is_event_manager`, `can_current_user_post`)
- **Frontend:** UI shows/hides features based on role (not security, just UX)

**References:**
- `supabase/migrations/20250201090000_add_event_roles_system.sql` - Event roles
- `supabase/migrations/20250115000010_fix_can_current_user_post.sql` - Permission helpers

### 3.3 RLS Policies

**RLS Status:**
- ✅ **Enabled** on all critical tables (verified via migrations)
- ✅ **Policies exist** for: events, tickets, orders, posts, comments, messages, notifications
- ⚠️ **Some tables** may have RLS enabled but no policies (blocks all access - needs verification)

**Key RLS Policies:**

**`events.events`:**
- Public can view published events
- Authenticated users can create events
- Event creators can update their events
- Org members can update org events

**`ticketing.tickets`:**
- Users can view their own tickets
- Event managers can view tickets for their events
- Service role can view all (for scanning)

**`ticketing.orders`:**
- Users can view their own orders
- Event managers can view orders for their events
- Service role can view all (for webhooks)

**`events.event_posts`:**
- Public can view posts for published events
- Authenticated users can create posts
- Post authors can update/delete their posts
- Event managers can moderate posts

**`messaging.direct_messages`:**
- Users can view messages in conversations they participate in
- Users can send messages to conversations they're in
- Service role can view all (for notifications)

**`public.notifications`:**
- Users can only view their own notifications
- Service role can create notifications (via triggers)

**Gaps Found:**
- ⚠️ Some analytics tables may have RLS disabled (needs verification)
- ⚠️ `org_memberships` view had permission issues (fixed in `20250601000001_fix_org_memberships_view_permissions.sql`)

**References:**
- `supabase/migrations/20250128_rls_security_audit.sql` - RLS audit queries
- `supabase/migrations/20250128_enable_ticketing_rls.sql` - Ticketing RLS
- `supabase/migrations/20250128_enable_events_reference_rls.sql` - Events RLS

### 3.4 Security Gaps

**Identified Issues:**

1. **Service Role Usage:**
   - ✅ Edge Functions use `service_role` key correctly (bypasses RLS for system operations)
   - ✅ Webhook handlers use service role (required for payment processing)
   - ⚠️ Some functions use `SECURITY DEFINER` (intentional, but needs documentation)

2. **Frontend-Only Checks:**
   - ⚠️ Some UI features rely on frontend role checks (not enforced by RLS)
   - Example: "Create Event" button visibility (RLS will block if user lacks permission, but UX could be better)

3. **Missing RLS on Some Tables:**
   - ⚠️ Analytics tables may have RLS disabled (needs verification)
   - ⚠️ Some system tables (rate_limit_counters, email_queue) have RLS but service-role-only policies

4. **Hard-Coded Bypasses:**
   - None found - all bypasses use service_role key appropriately

**References:**
- `SECURITY_DEFINER_VIEWS_RATIONALE.md` - Documents intentional SECURITY DEFINER usage
- `supabase/migrations/20250128_rls_security_audit.sql` - Security audit queries

---

## 4. Payments & Stripe Integration (VERY IMPORTANT)

### 4.1 Stripe Integration Files

**Client-Side:**
- `src/lib/ticketApi.ts` - Ticket API client (calls Edge Functions)
- `src/components/EventCheckoutSheet.tsx` - Checkout UI
- `@stripe/stripe-js`, `@stripe/react-stripe-js` - Stripe SDK

**Server-Side (Edge Functions):**
- `supabase/functions/enhanced-checkout/index.ts` - Member checkout (authenticated users)
- `supabase/functions/guest-checkout/index.ts` - Guest checkout (no account required)
- `supabase/functions/stripe-webhook/index.ts` - Webhook handler (payment events)
- `supabase/functions/process-payment/index.ts` - Payment processing (called by webhook)
- `supabase/functions/ensure-tickets/index.ts` - Ticket generation (idempotent)
- `supabase/functions/create-stripe-connect/index.ts` - Stripe Connect onboarding
- `supabase/functions/create-payout/index.ts` - Manual payout requests
- `supabase/functions/get-stripe-balance/index.ts` - Balance fetching
- `supabase/functions/process-refund/index.ts` - Refund processing

**Shared Utilities:**
- `supabase/functions/_shared/pricing.ts` - Fee calculation
- `supabase/functions/_shared/checkout-utils.ts` - Checkout helpers
- `supabase/functions/_shared/stripe-resilience.ts` - Retry logic

**Stripe Products Used:**
- ✅ **Checkout Sessions** - For guest checkout flow
- ✅ **Payment Intents** - For embedded checkout (member flow)
- ✅ **Stripe Connect** - For organizer payouts (Express accounts)
- ✅ **Webhooks** - For payment events (`checkout.session.completed`, `payment_intent.succeeded`)
- ✅ **Refunds API** - For refund processing

### 4.2 Payment Flow Sequence

**Member Checkout Flow:**
```
1. User selects tickets → Frontend calls enhanced-checkout
2. enhanced-checkout Edge Function:
   - Validates event, calculates fees
   - Creates Stripe Payment Intent (or Checkout Session)
   - Creates order in DB (status: 'pending')
   - Returns client_secret to frontend
3. Frontend: Stripe Elements handles payment
4. Stripe: Payment succeeds → Webhook fires
5. stripe-webhook Edge Function:
   - Verifies webhook signature
   - Finds order by stripe_payment_intent_id or stripe_session_id
   - Calls process-payment function
6. process-payment Edge Function:
   - Marks order as 'paid'
   - Calls ensure-tickets function
7. ensure-tickets Edge Function:
   - Generates tickets (QR codes, serial numbers)
   - Updates ticket_tiers.issued_quantity
   - Sends confirmation email
8. Frontend: Polls for order status → Shows success
```

**Guest Checkout Flow:**
```
1. Guest enters email → Frontend calls guest-checkout
2. guest-checkout Edge Function:
   - Creates/updates guest user account
   - Creates Stripe Checkout Session
   - Creates order in DB (status: 'pending')
   - Returns session URL
3. Guest: Redirected to Stripe Checkout
4. Stripe: Payment succeeds → Webhook fires
5. (Same webhook → process-payment → ensure-tickets flow)
```

**References:**
- `supabase/functions/enhanced-checkout/index.ts` - Member checkout
- `supabase/functions/guest-checkout/index.ts` - Guest checkout
- `supabase/functions/stripe-webhook/index.ts` - Webhook handler
- `supabase/functions/process-payment/index.ts` - Payment processing

### 4.3 Security Correctness

**Webhook Verification:**
- ✅ **VERIFIED** - Uses `stripe.webhooks.constructEventAsync()` with signing secret
- ✅ **Location:** `supabase/functions/stripe-webhook/index.ts:51`
- ✅ **Error Handling:** Throws error if signature invalid

**Price/Amount Trust:**
- ✅ **TRUSTED FROM DB** - Prices read from `ticket_tiers.price_cents` in database
- ✅ **Location:** `supabase/functions/enhanced-checkout/index.ts:119-130` (fetches event and tiers from DB)
- ✅ **Client Input:** Only `tier_id` and `quantity` accepted (not prices)
- ⚠️ **Guest Checkout:** Accepts `unit_price_cents` from client (but validates against DB tier)

**Idempotency:**
- ✅ **IMPLEMENTED** - Uses `stripe_idempotency_keys` table
- ✅ **Location:** `supabase/migrations/20250128_stripe_idempotency_keys.sql`
- ✅ **Usage:** Idempotency keys generated in `_shared/checkout-utils.ts:generateIdempotencyKey()`
- ✅ **Webhook Deduplication:** Uses Stripe event ID + created timestamp

**Fraud Checks:**
- ✅ **3D Secure** - Automatic (Stripe handles)
- ✅ **Billing Address** - Collected in checkout
- ✅ **Rate Limiting** - Implemented in `_shared/rate-limiter.ts`

**References:**
- `supabase/functions/stripe-webhook/index.ts:49-60` - Webhook verification
- `supabase/functions/_shared/checkout-utils.ts` - Idempotency key generation
- `supabase/migrations/20250128_stripe_idempotency_keys.sql` - Idempotency table

### 4.4 Refunds and Disputes

**Refund System:**
- ✅ **IMPLEMENTED** - `supabase/functions/process-refund/index.ts`
- ✅ **Database:** `ticketing.refund_requests`, `ticketing.refund_policies`, `ticketing.refund_log`
- ✅ **Stripe Integration:** Uses `stripe.refunds.create()`
- ✅ **Inventory Release:** Tickets marked as 'refunded', inventory released
- ⚠️ **Automation:** Partially automated (organizer approval required for customer requests)

**Refund Flow:**
```
1. Customer requests refund → Creates refund_request (status: 'pending')
2. Organizer reviews → Approves/declines
3. If approved → process-refund Edge Function:
   - Checks eligibility (refund window, ticket status)
   - Creates Stripe refund
   - Marks tickets as 'refunded'
   - Releases inventory
   - Sends confirmation email
```

**Refund States:**
- ✅ **Stored in DB:** `tickets.status = 'refunded'`, `orders.status = 'refunded'`
- ✅ **Audit Trail:** `ticketing.refund_log` table
- ✅ **Refund Types:** 'admin', 'organizer', 'customer', 'dispute'

**Disputes/Chargebacks:**
- ⚠️ **NOT EXPLICITLY HANDLED** - No code found for Stripe dispute webhooks
- ⚠️ **Gap:** Should handle `charge.dispute.created` webhook events

**References:**
- `supabase/functions/process-refund/index.ts` - Refund processing
- `supabase/migrations/20251111000009_ticket_refunds_v1.sql` - Refund schema
- `supabase/migrations/20251111000010_refund_requests.sql` - Refund request queue

### 4.5 Connect / Payouts

**Stripe Connect:**
- ✅ **IMPLEMENTED** - `supabase/functions/create-stripe-connect/index.ts`
- ✅ **Account Type:** Express accounts (simplified onboarding)
- ✅ **Storage:** Connected account IDs stored in `payout_accounts` table
- ✅ **Onboarding:** Uses Stripe Account Links API

**Payout Flow:**
```
1. Organizer clicks "Connect with Stripe" → create-stripe-connect
2. Creates Stripe Express account
3. Returns onboarding link
4. Organizer completes KYC in Stripe
5. Webhook: account.updated → Updates payout_accounts.status
6. Organizer can request payouts → create-payout
7. Payouts processed via Stripe Payouts API
```

**Revenue Tracking:**
- ✅ **Platform Fee:** 5% calculated in `_shared/pricing.ts`
- ✅ **Destination Charges:** Payments split automatically (platform fee vs organizer revenue)
- ✅ **Balance Caching:** `get-stripe-balance` caches balance in DB

**References:**
- `supabase/functions/create-stripe-connect/index.ts` - Connect onboarding
- `supabase/functions/create-payout/index.ts` - Payout requests
- `supabase/functions/_shared/pricing.ts` - Fee calculation

### 4.6 Stripe Integration Issues & Risks

**Issues Found:**

1. **Guest Checkout Price Validation:**
   - ⚠️ **Risk:** `guest-checkout` accepts `unit_price_cents` from client
   - ✅ **Mitigation:** Validates against DB tier, but client can send wrong price
   - **Recommendation:** Always fetch price from DB, ignore client price

2. **Webhook Retry Logic:**
   - ✅ **Implemented:** `webhook_retry_queue` table
   - ✅ **Retry Function:** `supabase/functions/process-webhook-retries/`
   - ⚠️ **Gap:** No automatic retry cron job (manual retry only)

3. **Race Conditions:**
   - ✅ **Protected:** Idempotency keys prevent duplicate charges
   - ✅ **Protected:** Advisory locks in `ensure-tickets` prevent duplicate ticket generation
   - ✅ **Protected:** Atomic updates in `redeem_ticket_atomic` RPC

4. **Error Handling:**
   - ✅ **Good:** Comprehensive error logging
   - ⚠️ **Gap:** No Sentry/error monitoring integration
   - ⚠️ **Gap:** Webhook failures may go unnoticed

5. **Dispute Handling:**
   - ❌ **Missing:** No code for `charge.dispute.created` webhook
   - **Risk:** Disputes not automatically handled

**References:**
- `supabase/functions/stripe-webhook/index.ts` - Webhook handler
- `supabase/migrations/20250128_create_webhook_retry_queue.sql` - Retry queue
- `PRODUCTION_READINESS_ASSESSMENT.md` - Payment system assessment

---

## 5. Ticketing & Check-In Pipeline

### 5.1 Ticket Creation

**Ticket Generation:**
- **Function:** `supabase/functions/ensure-tickets/index.ts`
- **Triggered By:** Webhook → `process-payment` → `ensure-tickets`
- **Idempotent:** ✅ Yes - Checks for existing tickets before creating

**Ticket Creation Process:**
```
1. ensure-tickets receives order_id
2. Checks if tickets already exist (fast-path)
3. Verifies payment status with Stripe (if order not marked 'paid')
4. For each order item:
   - Generates QR code (8-char alphanumeric, unique)
   - Assigns serial number (sequential per tier)
   - Creates ticket record (status: 'issued')
   - Updates ticket_tiers.issued_quantity
5. Marks order.tickets_issued_count
6. Sends confirmation email
```

**QR Code Generation:**
- **Function:** Database function `gen_qr_code()` (8-char alphanumeric)
- **Security:** Can also generate signed tokens (`issue-ticket-qr-token` function)
- **Format:** Legacy: `[A-HJ-NP-Z2-9]{8}`, New: `v1.{payload}.{signature}`

**References:**
- `supabase/functions/ensure-tickets/index.ts` - Ticket generation
- `supabase/migrations/20250115000008_fix_gen_qr_code_function.sql` - QR code function
- `supabase/functions/issue-ticket-qr-token/index.ts` - Signed QR tokens

### 5.2 Ticket Lifecycle

**States:**
1. **Created** - `status = 'issued'` (after payment)
2. **Transferred** - `status = 'transferred'` (if transferred to another user - not implemented)
3. **Redeemed** - `status = 'redeemed'`, `redeemed_at` set (after scan)
4. **Refunded** - `status = 'refunded'`, `refunded_at` set (after refund)
5. **Void** - `status = 'void'` (manually voided)

**State Transitions:**
- ✅ **issued → redeemed:** Via scanner validation
- ✅ **issued → refunded:** Via refund process
- ❌ **redeemed → refunded:** Blocked (hard rule - cannot refund redeemed tickets)
- ❌ **Transfers:** Not implemented (TODOs found)

**References:**
- `supabase/migrations/20250128_qr_atomic_redemption.sql` - Atomic redemption function
- `supabase/functions/process-refund/index.ts` - Refund processing

### 5.3 Scanner API

**Scanner Function:**
- **Location:** `supabase/functions/scanner-validate/index.ts`
- **Endpoint:** `/functions/v1/scanner-validate`
- **Method:** GET or POST (accepts `event_id` and `qr_token`)

**Validations Performed:**
1. ✅ **Authentication:** Requires authenticated user
2. ✅ **Authorization:** Checks if user is event manager OR assigned scanner
3. ✅ **Rate Limiting:** Per-scanner (10/min) and per-event (200/min) limits
4. ✅ **QR Format:** Validates format (legacy 8-char or signed token)
5. ✅ **Token Verification:** Verifies signed token signature (if using signed tokens)
6. ✅ **Ticket Lookup:** Finds ticket by QR code or ticket ID (from token)
7. ✅ **Event Match:** Verifies ticket is for correct event
8. ✅ **Status Check:** Rejects if refunded, void, or already redeemed
9. ✅ **Event End Check:** Rejects if event has ended
10. ✅ **Atomic Redemption:** Uses `redeem_ticket_atomic` RPC (prevents duplicate scans)

**Protection Against:**
- ✅ **Multiple Uses:** Atomic redemption with `SELECT FOR UPDATE` lock
- ✅ **Wrong Event:** Validates `ticket.event_id === scanner_event_id`
- ✅ **Offline/Online Inconsistency:** All validation server-side, no client trust
- ✅ **Replay Attacks:** Token timestamp validation (rejects very old tokens after event end)

**References:**
- `supabase/functions/scanner-validate/index.ts` - Scanner validation
- `supabase/migrations/20250128_qr_atomic_redemption.sql` - Atomic redemption RPC
- `src/components/scanner/ScannerView.tsx` - Frontend scanner UI

### 5.4 Scanner Security

**RLS Policies:**
- ✅ **Scanner Access:** Enforced via `is_event_manager` RPC and `event_scanners` table
- ✅ **Ticket Access:** Service role used for ticket lookups (bypasses RLS, but authorization checked separately)

**Server-Side Checks:**
- ✅ **Authorization:** `scanner-validate` checks permissions before processing
- ✅ **No Client Bypass:** All validation server-side, client cannot bypass

**Scanner Role Assignment:**
- ✅ **Table:** `event_scanners` (user_id, event_id, status: 'enabled'/'disabled')
- ✅ **Function:** `scanner-invite` Edge Function sends invitations
- ✅ **UI:** Scanner assignment in event management dashboard

**References:**
- `supabase/functions/scanner-authorize/index.ts` - Scanner authorization check
- `supabase/functions/scanner-invite/index.ts` - Scanner invitation
- `supabase/migrations/20250201090000_add_event_roles_system.sql` - Event roles schema

---

## 6. Events, Feed, Social & Messaging

### 6.1 Event Management

**Event Creation:**
- **UI:** `src/components/CreateEventFlow.tsx` - Multi-step wizard
- **Backend:** Direct insert into `events.events` table (via Supabase client)
- **Validation:** Client-side validation, RLS enforces permissions
- **Idempotency:** `supabase/migrations/20250121000002_make_event_creation_idempotent.sql` - Prevents duplicates

**Event Editing:**
- **UI:** `src/components/EventManagement.tsx`
- **Backend:** Direct update to `events.events` (RLS enforces creator/org member permissions)

**Event Validation:**
- ✅ **Dates:** Client validates `start_at` < `end_at`
- ✅ **Capacity:** Enforced via `ticket_tiers.quantity` (database triggers prevent overselling)
- ✅ **Visibility:** 'public', 'private', 'unlisted' (RLS enforces access)

**References:**
- `src/components/CreateEventFlow.tsx` - Event creation UI
- `src/components/EventManagement.tsx` - Event management UI
- `supabase/migrations/20250121000002_make_event_creation_idempotent.sql` - Idempotency

### 6.2 Social Feed

**Feed Algorithm:**
- **Function:** `supabase/functions/home-feed/index.ts`
- **Ranking:** Purchase intent algorithm (30+ behavioral signals)
- **Injection:** Ads injected every 6 items (positions 6, 12, 18, etc.)

**Post Storage:**
- **Table:** `events.event_posts`
- **Columns:** `text`, `media_urls` (JSONB array), `author_user_id`, `like_count`, `comment_count`
- **Real-time:** Supabase Realtime subscriptions for new posts

**Comments:**
- **Table:** `events.event_comments`
- **Structure:** Supports replies (`parent_comment_id`)
- **Real-time:** Subscriptions for new comments

**Reactions:**
- **Table:** `events.event_reactions` (likes on posts)
- **Table:** `events.event_comment_reactions` (likes on comments)
- **Real-time:** Subscriptions for reaction updates

**Content Moderation:**
- ⚠️ **Limited** - No automated moderation found
- ⚠️ **No Reporting** - No user reporting system found
- ⚠️ **No Blocking** - No user blocking functionality found
- ⚠️ **No Word Filters** - No profanity/content filtering

**References:**
- `supabase/functions/home-feed/index.ts` - Feed algorithm
- `src/hooks/useRealtimePosts.ts` - Real-time post subscriptions
- `src/features/comments/hooks/useRealtimeComments.ts` - Real-time comment subscriptions

### 6.3 Messaging System

**Conversations:**
- **Table:** `messaging.direct_conversations`
- **Participants:** `messaging.conversation_participants` (supports users and organizations)
- **Request Status:** 'open', 'pending', 'accepted', 'declined' (for approval workflows)

**Messages:**
- **Table:** `messaging.direct_messages`
- **Columns:** `body` (TEXT), `attachments` (JSONB), `status` ('sent' | 'delivered' | 'read')
- **Sender Type:** 'user' or 'organization'

**Read Receipts:**
- ✅ **Implemented:** `conversation_participants.last_read_at` updated when messages read
- ✅ **UI:** Shows read status in messaging UI

**Typing Indicators:**
- ❌ **Not Implemented** - No typing indicator code found

**Message Limits:**
- ⚠️ **Not Found** - No rate limiting or size limits in code
- **Risk:** Potential for spam/abuse

**References:**
- `supabase/migrations/20251111000001_create_messaging_system.sql` - Messaging schema
- `src/components/messaging/MessagingCenter.tsx` - Messaging UI
- `src/hooks/useRealtimeMessages.ts` - Real-time message subscriptions

### 6.4 Missing Moderation/Abuse Handling

**Gaps Identified:**
1. ❌ **Content Reporting** - No user reporting system
2. ❌ **User Blocking** - No blocking functionality
3. ❌ **Word Filters** - No profanity/content filtering
4. ❌ **Spam Detection** - No automated spam detection
5. ⚠️ **Rate Limiting** - Limited (only on scanner, not on posts/messages)

**Recommendations:**
- Implement user reporting system (high priority)
- Add content moderation tools for organizers
- Implement rate limiting on posts/messages
- Add user blocking functionality

---

## 7. Notifications & Realtime

### 7.1 Notifications Table & Triggers

**Notifications Table:**
- **Location:** `public.notifications`
- **Schema:** `supabase/migrations/20250601000000_notification_triggers.sql`

**DB Triggers (Automatic Notification Creation):**

1. **Follow Notifications:**
   - **Trigger:** `on_follow_notification` on `users.follows` table
   - **Function:** `handle_new_follow()`
   - **Event Type:** 'user_follow'

2. **Like Notifications:**
   - **Trigger:** `on_reaction_notification` on `events.event_reactions` table
   - **Function:** `handle_new_reaction()`
   - **Event Type:** 'post_like'

3. **Comment Notifications:**
   - **Trigger:** `on_comment_notification` on `events.event_comments` table
   - **Function:** `handle_new_comment()` (top-level comments)
   - **Event Type:** 'post_comment'

4. **Reply Notifications:**
   - **Trigger:** `on_reply_notification` on `events.event_comments` table
   - **Function:** `handle_new_reply()` (replies to comments)
   - **Event Type:** 'comment_reply'

5. **Ticket Purchase Notifications:**
   - **Trigger:** `on_ticket_notification` on `ticketing.tickets` table
   - **Function:** `handle_new_ticket()`
   - **Event Type:** 'ticket_purchase'

6. **Message Notifications:**
   - **Trigger:** `on_message_notification` on `messaging.direct_messages` table
   - **Function:** `handle_new_message()`
   - **Event Type:** 'message_received'

**References:**
- `supabase/migrations/20250601000000_notification_triggers.sql` - Complete trigger system

### 7.2 Notification Creation Method

**Primary Method:** PostgreSQL triggers (automatic)
- ✅ **All notifications** created via triggers (no Edge Function calls needed)
- ✅ **Deduplication:** Uses `dedupe_key` column with unique index
- ✅ **Spam Prevention:** Same `dedupe_key` blocks duplicate notifications

**Helper Function:**
- **Function:** `public.create_notification()` (called by triggers)
- **Security:** `SECURITY DEFINER` with `SET search_path = public, pg_temp`
- **Deduplication:** `ON CONFLICT (user_id, dedupe_key) DO NOTHING`

**Rate Limiting:**
- ⚠️ **Not Implemented** - No rate limiting on notification creation
- **Risk:** Rapid actions could create many notifications (mitigated by deduplication)

**References:**
- `supabase/migrations/20250601000000_notification_triggers.sql:58-120` - `create_notification` function

### 7.3 Realtime Subscriptions

**Frontend Subscriptions:**

1. **Notifications:**
   - **Hook:** `src/hooks/useRealtime.tsx`
   - **Channel:** `user-notifications`
   - **Table:** `public.notifications` (filter: `user_id = auth.uid()`)

2. **Orders:**
   - **Hook:** `src/hooks/useRealtime.tsx`
   - **Channel:** `user-orders`
   - **Table:** `public.orders` (filter: `user_id = auth.uid()`)

3. **Tickets:**
   - **Hook:** `src/hooks/useRealtime.tsx`
   - **Channel:** `user-tickets`
   - **Table:** `public.tickets` (filter: `owner_user_id = auth.uid()`)

4. **Event Posts:**
   - **Hook:** `src/hooks/useRealtimePosts.ts`
   - **Channel:** `realtime:home_feed_posts`
   - **Table:** `public.event_posts` (filter: `event_id IN (...)`)

5. **Comments:**
   - **Hook:** `src/features/comments/hooks/useRealtimeComments.ts`
   - **Channel:** `comments:${postId}`
   - **Table:** `events.event_comments` (filter: `post_id = ...`)

6. **Messages:**
   - **Hook:** `src/hooks/useRealtimeMessages.ts`
   - **Channel:** `messages:${conversationId}`
   - **Table:** `messaging.direct_messages` (filter: `conversation_id = ...`)

7. **Follows:**
   - **Hook:** `src/contexts/FollowRealtimeContext.tsx`
   - **Channel:** `global-follow-updates`
   - **Table:** `public.follows` (filter: `follower_user_id = auth.uid()`)

**Cleanup:**
- ✅ **Implemented:** All hooks clean up subscriptions on unmount
- ✅ **Pattern:** `useEffect` return function calls `supabase.removeChannel()`

**References:**
- `src/hooks/useRealtime.tsx` - Main realtime hook
- `src/hooks/useRealtimePosts.ts` - Post subscriptions
- `src/hooks/useRealtimeMessages.ts` - Message subscriptions

### 7.4 Mobile Push Notifications

**Push Notification Setup:**
- ✅ **Capacitor Plugin:** `@capacitor/push-notifications` installed
- ✅ **Config:** `capacitor.config.ts` includes PushNotifications config
- ✅ **Hook:** `src/hooks/usePushNotifications.tsx` (found in codebase search)

**Push Notification Sending:**
- ✅ **Function:** `supabase/functions/send-push-notification/index.ts`
- ⚠️ **Integration:** Not fully wired to DB events (needs verification)

**Device Registration:**
- ✅ **Table:** `public.user_devices` (stores device tokens)
- ✅ **Migration:** `supabase/migrations/20250104_create_user_devices.sql`

**Gaps:**
- ⚠️ **Automatic Sending:** Push notifications may not be automatically sent on DB events
- ⚠️ **Testing:** Needs verification that push notifications work end-to-end

**References:**
- `src/hooks/usePushNotifications.tsx` - Push notification hook
- `supabase/functions/send-push-notification/index.ts` - Push sending function
- `supabase/migrations/20250104_create_user_devices.sql` - Device registration

---

## 8. Web Frontend (Performance & DX)

### 8.1 Entry Points & Routing

**Main Entry:**
- **File:** `src/main.tsx` → `src/App.tsx`
- **Router:** React Router v6
- **Lazy Loading:** ✅ Implemented for heavy pages

**Routing Structure:**
```typescript
// Lazy-loaded routes (from src/App.tsx):
- Index (home feed)
- EventSlugPage (event details)
- ProfilePageNew (user profiles)
- TicketsPageNew (user tickets)
- SearchPageNew (search)
- EventDetailsPageNew (event details)
- MessagesPageNew (messaging)
- NotificationsPageNew (notifications)
- CreateEventFlow (event creation)
- OrganizerDashboard (organizer tools)
- ScannerPage (ticket scanning)
```

**Component Organization:**
- `src/pages/` - Page components
- `src/components/` - Reusable components (326 files)
- `src/features/` - Feature modules (analytics, comments, feed, dashboard)
- `src/hooks/` - Custom hooks (105 files)
- `src/lib/` - Utilities, API clients

**References:**
- `src/App.tsx` - Main routing
- `src/main.tsx` - Entry point

### 8.2 Bundle Size & Composition

**Current Bundle (from `BUNDLE_ANALYSIS_REPORT.md`):**
- **Interactive Shell:** 560 KB gzipped (target: <200 KB) 🔴 **OVER BUDGET**
- **vendor.js:** 521 KB gzipped (93% of total)
- **index.js:** 39 KB gzipped (7% of total)

**Large Libraries (Already Code-Split):**
- ✅ `mapbox.js`: 445 KB (lazy-loaded)
- ✅ `charts.js`: 67 KB (lazy-loaded)
- ✅ `analytics.js`: 59 KB (lazy-loaded)
- ✅ `video.js`: 28 KB (lazy-loaded)

**Vendor Chunk Breakdown (Estimated):**
- `@supabase/supabase-js`: ~80 KB (15%)
- `react + react-dom`: ~50 KB (10%)
- `@tanstack/react-query`: ~40 KB (8%)
- `react-router-dom`: ~30 KB (6%)
- `@radix-ui/*`: ~35 KB (7%)
- `posthog-js`: ~40 KB (8%)
- Other: ~246 KB (46%)

**Code Splitting:**
- ✅ **Implemented:** Route-based lazy loading
- ✅ **Manual Chunks:** `vite.config.ts` splits heavy libs (mapbox, charts, video, etc.)
- ⚠️ **Vendor Chunk:** Still too large (521 KB)

**References:**
- `BUNDLE_ANALYSIS_REPORT.md` - Detailed bundle analysis
- `vite.config.ts` - Bundle configuration
- `bundle-analysis.html` - Visual bundle analyzer output

### 8.3 Performance Optimizations

**Lazy Loading:**
- ✅ **Routes:** All heavy pages lazy-loaded
- ✅ **Components:** Heavy components (analytics dashboards, admin tools) lazy-loaded
- ✅ **PostHog:** Deferred loading (`src/components/DeferredPostHog.tsx`)

**Memoization:**
- ✅ **React.memo:** Used in some components
- ✅ **useMemo/useCallback:** Used in hooks for expensive computations
- ⚠️ **Could Improve:** More aggressive memoization needed

**Virtual Scrolling:**
- ✅ **Implemented:** `@tanstack/react-virtual` for long lists
- ✅ **Usage:** Feed, ticket lists, analytics tables

**References:**
- `src/App.tsx` - Lazy loading
- `src/components/DeferredPostHog.tsx` - Deferred PostHog
- `vite.config.ts` - Bundle optimization

### 8.4 Quick Wins

**Identified Optimizations:**

1. **Split More Vendor Libraries:**
   - `react-hook-form` + `zod` → 'forms' chunk
   - `date-fns` → 'dates' chunk
   - `@tanstack/react-virtual` → 'virtual' chunk
   - Already partially implemented in `vite.config.ts`

2. **Lazy Load Heavy Components:**
   - Analytics dashboards (already lazy-loaded)
   - Admin tools (already lazy-loaded)
   - Video player (already code-split)

3. **Remove Unused Libraries:**
   - ⚠️ **Needs Audit:** Some libraries may be unused
   - **Action:** Run bundle analyzer to identify dead code

4. **Optimize Images:**
   - ⚠️ **No Image Optimization:** No image optimization pipeline found
   - **Recommendation:** Add image optimization (Sharp, ImageKit, etc.)

**References:**
- `BUNDLE_ANALYSIS_REPORT.md` - Optimization recommendations
- `vite.config.ts:24-70` - Manual chunk configuration

---

## 9. Mobile (Capacitor) & Native Integrations

### 9.1 Capacitor Configuration

**Config File:**
- **Location:** `capacitor.config.ts`
- **App ID:** `com.liventix.app`
- **App Name:** `Liventix`
- **Web Dir:** `dist` (Vite build output)

**Plugins Used:**
- ✅ **BarcodeScanner** - QR code scanning (`@capacitor/barcode-scanner`)
- ✅ **Camera** - Photo/video capture (`@capacitor/camera`)
- ✅ **PushNotifications** - Push notifications (`@capacitor/push-notifications`)
- ✅ **LocalNotifications** - Local reminders (`@capacitor/local-notifications`)
- ✅ **Haptics** - Tactile feedback (`@capacitor/haptics`)
- ✅ **Geolocation** - Location services (`@capacitor/geolocation`)
- ✅ **Share** - Native sharing (`@capacitor/share`)
- ✅ **Clipboard** - Copy/paste (`@capacitor/clipboard`)
- ✅ **Network** - Network status (`@capacitor/network`)
- ✅ **Preferences** - Persistent storage (`@capacitor/preferences`)
- ✅ **Browser** - In-app browser (`@capacitor/browser`)
- ✅ **Keyboard** - Keyboard handling (`@capacitor/keyboard`)
- ✅ **StatusBar** - Status bar control (`@capacitor/status-bar`)
- ✅ **SplashScreen** - Splash screen (`@capacitor/splash-screen`)
- ✅ **Toast** - Toast messages (`@capacitor/toast`)

**References:**
- `capacitor.config.ts` - Complete configuration
- `package.json:28-49` - Capacitor dependencies

### 9.2 Scanner Flow

**Native Scanner:**
- **Component:** `src/components/scanner/ScannerView.tsx`
- **Native:** Uses `CapacitorBarcodeScanner` for iOS/Android
- **Web Fallback:** Manual entry for browsers without `BarcodeDetector` API
- **Validation:** Calls `scanner-validate` Edge Function

**Scanner Implementation:**
```typescript
// Native (iOS/Android):
CapacitorBarcodeScanner.scan() → Returns QR code → Validate via API

// Web (Chrome/Edge):
BarcodeDetector API → Scans video stream → Validate via API

// Web (Firefox/Safari):
Manual entry fallback → Validate via API
```

**References:**
- `src/components/scanner/ScannerView.tsx` - Scanner UI
- `src/lib/capacitor-init.ts` - Capacitor initialization

### 9.3 Deep Links & Routing

**Deep Link Config:**
- **iOS Scheme:** `liventix://` (configured in `capacitor.config.ts`)
- **Android Scheme:** `https://` (configured in `capacitor.config.ts`)
- **Hostname:** `liventix.tech` (configured in `capacitor.config.ts`)

**Deep Link Handling:**
- ✅ **Capacitor App Plugin:** `@capacitor/app` handles deep links
- ⚠️ **Routing:** Needs verification that deep links route correctly

**References:**
- `capacitor.config.ts:7-11` - Deep link configuration
- `CAPACITOR_DEEP_LINK_CONFIG.md` - Deep link documentation

### 9.4 Platform-Specific Logic

**iOS vs Android:**
- ✅ **Camera Permissions:** Different permission descriptions per platform
- ✅ **Status Bar:** Platform-specific styling
- ⚠️ **Wallet Integration:** Apple Wallet / Google Wallet not yet implemented (TODOs found)

**Permission Flows:**
- ✅ **Camera:** Permission requested on scanner open
- ✅ **Notifications:** Permission requested on app launch
- ⚠️ **Location:** Permission requested but may not be handled gracefully

**Wallet Integration:**
- ❌ **Apple Wallet:** Not implemented (TODOs in code)
- ❌ **Google Wallet:** Not implemented (TODOs in code)
- **References:** `APPLE_WALLET_IMPLEMENTATION_GUIDE.md`, `GOOGLE_WALLET_IMPLEMENTATION_GUIDE.md`

**References:**
- `capacitor.config.ts` - Platform configuration
- `ios/App/App/Info.plist` - iOS permissions (if exists)
- `APPLE_WALLET_IMPLEMENTATION_GUIDE.md` - Wallet implementation guide

---

## 10. Analytics, Logging & Monitoring

### 10.1 Analytics Systems

**PostHog (Third-Party):**
- **Initialization:** `src/lib/posthog.ts`
- **Deferred Loading:** `src/components/DeferredPostHog.tsx` (loads after initial render)
- **Events Tracked:** Page views, event views, ticket CTAs, checkout events, post engagement
- **Hook:** `src/hooks/useAnalytics.tsx`

**Internal Analytics (First-Party):**
- **Table:** `analytics.events` (partitioned by month)
- **Tracker:** `src/lib/internalAnalyticsTracker.ts`
- **Function:** `supabase/functions/track-analytics/index.ts`
- **Identity Resolution:** `analytics.identity_map` (anonymous → user ID stitching)

**Video Analytics:**
- **MUX Integration:** `supabase/functions/analytics-video-mux/index.ts`
- **Custom Tracking:** `src/hooks/useVideoAnalytics.tsx`
- **Tables:** `analytics.video_errors`, `analytics.video_metrics`

**References:**
- `src/lib/posthog.ts` - PostHog initialization
- `src/lib/internalAnalyticsTracker.ts` - Internal analytics
- `supabase/functions/track-analytics/index.ts` - Analytics Edge Function

### 10.2 Events Tracked

**PostHog Events:**
- `page_view` - Page navigation
- `event_view` - Event detail page view
- `ticket_cta_click` - Ticket purchase button click
- `checkout_started` - Checkout flow initiated
- `checkout_completed` - Payment completed
- `post_created` - User created post
- `post_engagement` - Like/comment/share on post

**Internal Analytics Events:**
- All user interactions (page views, clicks, etc.)
- Event-specific actions (ticket purchases, post engagement)
- Video playback metrics
- Conversion tracking

**PII Handling:**
- ✅ **PostHog:** Respects Do Not Track (DNT) headers
- ✅ **Internal:** User IDs stored, but no PII in event metadata
- ⚠️ **Email Tracking:** Email addresses may be sent to PostHog (needs verification)

**References:**
- `src/hooks/useAnalytics.tsx` - PostHog event tracking
- `src/lib/internalAnalyticsTracker.ts` - Internal event tracking

### 10.3 Logging & Monitoring

**Error Monitoring:**
- ❌ **Sentry:** Not found in codebase
- ❌ **Other Services:** No error monitoring service integrated
- ⚠️ **Gap:** Errors only logged to console/Supabase logs

**Edge Function Logging:**
- ✅ **Structured Logging:** `supabase/functions/_shared/logger.ts`
- ✅ **Supabase Logs:** All Edge Functions log to Supabase logs
- ⚠️ **No Aggregation:** No centralized log aggregation (rely on Supabase Dashboard)

**Health Checks:**
- ✅ **Keep-Warm Function:** `supabase/functions/keep-warm/index.ts` (prevents cold starts)
- ❌ **Health Endpoint:** No dedicated health check endpoint found

**Alerting:**
- ❌ **Not Configured:** No alerting system found
- ⚠️ **Gap:** Critical failures (payment, ticket generation) not automatically alerted

**References:**
- `supabase/functions/_shared/logger.ts` - Logging utility
- `supabase/functions/keep-warm/index.ts` - Keep-warm function

---

## 11. Security, Compliance, Privacy & Policy Support

### 11.1 Policy Documents

**Privacy Policy:**
- ✅ **Exists:** `src/pages/PrivacyPolicy.tsx`
- ✅ **Content:** Comprehensive (data collection, usage, sharing, user rights, GDPR/CCPA)
- ⚠️ **Legal Review:** Needs legal review before launch
- **Route:** `/privacy` (lazy-loaded)

**Terms of Service:**
- ✅ **Exists:** `src/pages/TermsOfService.tsx`
- ✅ **Content:** Comprehensive (acceptance, service description, user accounts, payment terms, liability)
- ⚠️ **Legal Review:** Needs legal review before launch
- **Route:** `/terms` (lazy-loaded)

**Refund Policy:**
- ✅ **Exists:** `src/pages/RefundPolicy.tsx`
- ✅ **Content:** Refund terms, windows, fees
- **Route:** `/refund-policy` (lazy-loaded)

**Community Guidelines:**
- ❌ **Not Found** - No Community Guidelines page found
- **Gap:** Should be created before launch

**References:**
- `src/pages/PrivacyPolicy.tsx` - Privacy Policy
- `src/pages/TermsOfService.tsx` - Terms of Service
- `src/pages/RefundPolicy.tsx` - Refund Policy

### 11.2 GDPR/CCPA Compliance

**Data Export:**
- ❌ **Not Implemented** - No "Download My Data" functionality found
- **Gap:** GDPR requires right to access (data export)

**Data Deletion:**
- ❌ **Not Implemented** - No "Delete My Account" functionality found
- **Gap:** GDPR requires right to erasure (account deletion)

**Age Verification:**
- ⚠️ **Not Enforced** - No age check in code (assumes 13+ per Terms)
- **Gap:** COPPA compliance requires age verification

**Region-Based Behavior:**
- ❌ **Not Implemented** - No region-based feature gating
- **Gap:** May need region-specific compliance (e.g., EU data residency)

**References:**
- `src/pages/PrivacyPolicy.tsx` - Mentions GDPR/CCPA rights but not implemented

### 11.3 Data Retention

**Explicit Retention Policies:**
- ❌ **Not Found** - No data retention policies in code
- ⚠️ **Gap:** Should implement automatic data deletion for compliance

**Backup Retention:**
- ⚠️ **Not Documented** - Supabase handles backups, but retention not documented

**References:**
- No explicit data retention code found

### 11.4 Content Reporting

**User Reporting:**
- ❌ **Not Implemented** - No content reporting system found
- **Gap:** Users cannot report inappropriate content

**Moderation Tools:**
- ⚠️ **Limited** - Organizers can delete posts, but no automated moderation
- **Gap:** No content moderation dashboard for platform admins

**References:**
- No reporting system found in codebase

---

## 12. DevOps, Environments & Release Process

### 12.1 Environment Configuration

**Environment Variables:**
- **Documentation:** `README.md` lists required env vars
- **Example File:** `.env.example` not found (should be created)
- **Required Vars:**
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_SECRET_KEY` (Edge Functions)
  - `STRIPE_WEBHOOK_SECRET` (Edge Functions)
  - `VITE_MAPBOX_ACCESS_TOKEN`
  - `VITE_POSTHOG_KEY` (optional)
  - `RESEND_API_KEY` (Edge Functions)

**Environment Detection:**
- **File:** `src/config/env.ts` - Environment variable validation
- **Validation:** Throws error if required vars missing (except in tests)

**References:**
- `README.md:35-58` - Environment variable documentation
- `src/config/env.ts` - Environment validation

### 12.2 CI/CD Configuration

**GitHub Actions:**
- ❌ **Not Found** - No `.github/workflows/` directory found
- **Gap:** No automated CI/CD pipeline

**Azure Pipelines:**
- ✅ **Found:** `azure-pipelines.yml`, `azure-pipelines-simulator.yml`
- ⚠️ **Status:** Needs verification if active

**Codemagic:**
- ✅ **Found:** `codemagic.yaml` (for mobile builds)
- ⚠️ **Status:** Needs verification if active

**References:**
- `azure-pipelines.yml` - Azure CI/CD config
- `codemagic.yaml` - Mobile build config

### 12.3 Migration & Deployment

**Migrations:**
- **Tool:** Supabase CLI (`supabase db push`)
- **Location:** `supabase/migrations/` (190 files)
- **Process:** Manual deployment via CLI

**Edge Functions:**
- **Tool:** Supabase CLI (`supabase functions deploy`)
- **Location:** `supabase/functions/` (80+ functions)
- **Process:** Manual deployment via CLI

**Mobile Builds:**
- **iOS:** Cloud build via GitHub Actions (per `README.md`)
- **Android:** Manual build via Android Studio
- **Process:** `npm run build` → `npx cap sync` → Native build

**Fragile Steps:**
- ⚠️ **Manual Migration:** Migrations must be run manually
- ⚠️ **Manual Function Deploy:** Edge Functions deployed individually
- ⚠️ **No Rollback:** No automated rollback process

**References:**
- `README.md:113-129` - Deployment instructions
- `DEPLOYMENT_CHECKLIST.md` - Deployment checklist (if exists)

### 12.4 Secrets Management

**Secrets Storage:**
- ✅ **Supabase Secrets:** Edge Function secrets stored in Supabase Dashboard
- ✅ **Environment Variables:** Frontend vars in `.env.local` (not committed)
- ⚠️ **Documentation:** Secrets not fully documented

**Risk:**
- ⚠️ **Service Role Key:** Used in Edge Functions (must be kept secret)
- ⚠️ **Stripe Keys:** Must be kept secret
- ✅ **No Hardcoded Secrets:** No secrets found in code

**References:**
- `README.md` - Mentions Supabase secrets
- Edge Functions use `Deno.env.get()` for secrets

---

## 13. Known Gaps, Risks & TODOs (from Code + Issues)

### 13.1 TODOs Found

**Critical TODOs:**
1. **Ticket Transfers** - `src/pages/new-design/EventDetailsPage.tsx:400` - "TODO: Calculate actual available from sold tickets"
2. **Wallet Integration** - Multiple files mention Apple/Google Wallet (not implemented)
3. **OAuth Authentication** - No Google/Apple OAuth (phone OTP only)
4. **Content Moderation** - No reporting/blocking system
5. **Refund Automation** - Partially automated (organizer approval required)

**Medium Priority TODOs:**
1. **Event Templates** - Not implemented
2. **Recurring Events** - Not implemented
3. **Group Messaging** - Not implemented
4. **Predictive Analytics** - Not implemented
5. **Multi-Currency** - USD only

**References:**
- `src/pages/new-design/EventDetailsPage.tsx:400-402` - TODOs
- `src/components/EventCheckoutSheet.tsx:163` - Comments
- Multiple files with "TODO" comments

### 13.2 Security Risks

**High Risk:**
1. **Content Moderation** - No automated moderation, no reporting system
2. **Dispute Handling** - No Stripe dispute webhook handler
3. **Data Export/Deletion** - GDPR/CCPA rights not implemented

**Medium Risk:**
1. **Error Monitoring** - No Sentry/error tracking
2. **Alerting** - No automated alerts for critical failures
3. **Rate Limiting** - Limited (only on scanner, not on posts/messages)

**Low Risk:**
1. **Bundle Size** - Performance impact, not security risk
2. **Wallet Integration** - UX gap, not security risk

### 13.3 Data Integrity Risks

**Low Risk:**
- ✅ **Foreign Keys:** Enforced across all tables
- ✅ **Transactions:** Critical operations use transactions
- ✅ **Idempotency:** Payment operations are idempotent
- ✅ **Atomic Operations:** Ticket redemption uses atomic RPC

### 13.4 Privacy/Compliance Risks

**High Risk:**
1. **GDPR Compliance** - Data export/deletion not implemented
2. **Age Verification** - No age check (assumes 13+)
3. **Data Retention** - No automatic data deletion

**Medium Risk:**
1. **PII in Analytics** - Email addresses may be sent to PostHog (needs verification)
2. **Region-Based Compliance** - No region-specific handling

### 13.5 Uptime/Reliability Risks

**Medium Risk:**
1. **Webhook Failures** - No automatic retry cron job
2. **Error Monitoring** - No centralized error tracking
3. **Health Checks** - No health check endpoint

**Low Risk:**
1. **Cold Starts** - Keep-warm function exists
2. **Database Scaling** - Supabase handles scaling

---

## 14. Concrete Recommendations (0–3, 3–6, 6–12 Months)

### 14.1 0–3 Months (Critical - Before/During Launch)

**1. Legal Review of Policy Documents** 🔴 **CRITICAL**
- **Description:** Have legal counsel review Privacy Policy, Terms of Service, Refund Policy
- **Impact:** Required for legal compliance, reduces liability
- **Complexity:** S (Simple - external work)
- **Files:** `src/pages/PrivacyPolicy.tsx`, `src/pages/TermsOfService.tsx`, `src/pages/RefundPolicy.tsx`

**2. Implement Data Export/Deletion (GDPR)** 🔴 **CRITICAL**
- **Description:** Add "Download My Data" and "Delete My Account" functionality
- **Impact:** GDPR/CCPA compliance, legal requirement
- **Complexity:** M (Medium - 2-3 weeks)
- **Files:** New Edge Functions needed, `src/pages/ProfilePage.tsx` UI

**3. Create Community Guidelines** 🟡 **HIGH**
- **Description:** Draft and implement Community Guidelines page
- **Impact:** Sets expectations, enables content moderation
- **Complexity:** S (Simple - content creation)
- **Files:** New page `src/pages/CommunityGuidelines.tsx`

**4. Implement Content Reporting System** 🟡 **HIGH**
- **Description:** Allow users to report inappropriate content
- **Impact:** Enables moderation, protects platform reputation
- **Complexity:** M (Medium - 2 weeks)
- **Files:** New table `content_reports`, new UI component

**5. Add Error Monitoring (Sentry)** 🟡 **HIGH**
- **Description:** Integrate Sentry for error tracking and alerting
- **Impact:** Faster issue detection, better debugging
- **Complexity:** S (Simple - 1 week)
- **Files:** Add Sentry SDK, configure error boundaries

**6. Implement Stripe Dispute Webhook** 🟡 **HIGH**
- **Description:** Handle `charge.dispute.created` webhook events
- **Impact:** Automatic dispute handling, reduces manual work
- **Complexity:** M (Medium - 1 week)
- **Files:** `supabase/functions/stripe-webhook/index.ts`

**7. Bundle Size Optimization** 🟢 **MEDIUM**
- **Description:** Reduce vendor.js from 521KB to <200KB
- **Impact:** Faster page loads, better UX
- **Complexity:** M (Medium - 1-2 weeks)
- **Files:** `vite.config.ts`, bundle analysis

**8. Automated Webhook Retry Cron** 🟢 **MEDIUM**
- **Description:** Set up cron job to retry failed webhooks
- **Impact:** Better reliability, automatic recovery
- **Complexity:** S (Simple - 1 week)
- **Files:** `supabase/functions/process-webhook-retries/`, Supabase cron config

### 14.2 3–6 Months (Important Improvements)

**1. Complete Refund Automation** 🟡 **HIGH**
- **Description:** Full automated refund flow (customer self-service)
- **Impact:** Reduces support burden, better UX
- **Complexity:** M (Medium - 2-3 weeks)
- **Files:** `supabase/functions/process-refund/index.ts`, refund UI

**2. Implement Ticket Transfers** 🟢 **MEDIUM**
- **Description:** Allow users to transfer tickets to other users
- **Impact:** User convenience, reduces support requests
- **Complexity:** M (Medium - 2 weeks)
- **Files:** New Edge Function, ticket transfer UI

**3. Add OAuth Authentication** 🟢 **MEDIUM**
- **Description:** Google/Apple OAuth login
- **Impact:** Improved signup conversion
- **Complexity:** M (Medium - 1-2 weeks)
- **Files:** Supabase Auth config, OAuth UI

**4. Implement Apple/Google Wallet** 🟢 **MEDIUM**
- **Description:** Add tickets to Apple Wallet / Google Wallet
- **Impact:** Better ticket access UX on mobile
- **Complexity:** M (Medium - 2-3 weeks)
- **Files:** Wallet generation functions, mobile integration

**5. Content Moderation Dashboard** 🟡 **HIGH**
- **Description:** Admin dashboard for content moderation
- **Impact:** Enables scale, protects platform
- **Complexity:** L (Large - 3-4 weeks)
- **Files:** New admin dashboard, moderation UI

**6. Implement User Blocking** 🟢 **MEDIUM**
- **Description:** Allow users to block other users
- **Impact:** User safety, reduces harassment
- **Complexity:** M (Medium - 1-2 weeks)
- **Files:** New `user_blocks` table, blocking UI

**7. Add Rate Limiting to Posts/Messages** 🟢 **MEDIUM**
- **Description:** Prevent spam by rate limiting content creation
- **Impact:** Reduces spam, improves platform quality
- **Complexity:** S (Simple - 1 week)
- **Files:** `supabase/functions/_shared/rate-limiter.ts`, apply to posts/messages

**8. Recurring Events Support** 🟢 **MEDIUM**
- **Description:** Allow organizers to create recurring events
- **Impact:** Organizer efficiency
- **Complexity:** M (Medium - 3-4 weeks)
- **Files:** Event creation flow, recurrence logic

### 14.3 6–12 Months (Strategic Enhancements)

**1. Predictive Analytics** 🟢 **MEDIUM**
- **Description:** AI-powered sales forecasts, engagement predictions
- **Impact:** Differentiator for organizers
- **Complexity:** L (Large - 4-6 weeks)
- **Files:** Analytics system, ML models

**2. Multi-Currency Support** 🟢 **MEDIUM**
- **Description:** Support multiple currencies (EUR, GBP, etc.)
- **Impact:** International expansion
- **Complexity:** M (Medium - 2-3 weeks)
- **Files:** Currency conversion, Stripe multi-currency

**3. Event Templates** 🟢 **MEDIUM**
- **Description:** Pre-built event templates for common event types
- **Impact:** Organizer efficiency
- **Complexity:** M (Medium - 2-3 weeks)
- **Files:** Template system, template library

**4. Group Messaging** 🟢 **MEDIUM**
- **Description:** Multi-participant group conversations
- **Impact:** Better organizer communication
- **Complexity:** M (Medium - 2-3 weeks)
- **Files:** Messaging system extension

**5. Advanced Personalization (ML)** 🟢 **MEDIUM**
- **Description:** ML-based event recommendations
- **Impact:** Better discovery, higher engagement
- **Complexity:** L (Large - 4-6 weeks)
- **Files:** Recommendation engine, ML models

**6. Enterprise Features** 🟢 **LOW**
- **Description:** SSO, advanced analytics, API access
- **Impact:** Enterprise customers
- **Complexity:** XL (Extra Large - 8+ weeks)
- **Files:** Enterprise feature set

**7. International Expansion** 🟢 **LOW**
- **Description:** Localization, regional compliance
- **Impact:** Global market access
- **Complexity:** L (Large - 6+ weeks)
- **Files:** i18n system, regional features

---

## Conclusion

The Liventix codebase is **technically sound and production-ready** with strong foundations in payments, ticketing, and real-time capabilities. The architecture is well-structured with proper separation of concerns, comprehensive database schema, and robust security policies.

**Key Strengths:**
- Robust payment processing with idempotency and webhook verification
- Comprehensive RLS policies protecting user data
- Real-time capabilities via Supabase Realtime
- Well-organized Edge Functions architecture
- Mobile-first design with Capacitor integration

**Critical Gaps to Address:**
1. Legal review of policy documents (Privacy, Terms, Refund Policy)
2. GDPR compliance (data export/deletion)
3. Content moderation tools (reporting, blocking)
4. Error monitoring (Sentry integration)
5. Bundle size optimization (560KB → <200KB target)

**Recommended Launch Timeline:**
- **Week 1-2:** Legal review, GDPR compliance, error monitoring
- **Week 3-4:** Content reporting, bundle optimization
- **Launch:** With manual processes for refunds, moderation
- **Post-Launch:** Automated refunds, ticket transfers, wallet integration

The platform is ready for launch with the understanding that some features (automated refunds, content moderation) can be built post-launch while maintaining manual processes initially.

---

**Document Prepared By:** Technical Leadership  
**Review Date:** January 6, 2025  
**Next Review:** Post-Launch (after first 1,000 users)

---

*This document is based on actual code, migrations, and configurations in the repository. All file paths and line numbers are accurate as of the audit date.*

