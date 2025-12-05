# 🏗️ Liventix Platform - Comprehensive Architecture & Status Audit

**Date:** December 11, 2025  
**Scope:** Complete system inventory split by Attendee Mode and Organizer Mode  
**Purpose:** Document all working systems, their status, and technical debt

---

## 📊 Executive Summary

### **Attendee Mode Systems:** 12 core areas
- ✅ **Stable:** 7 systems (Auth, Event Discovery, Ticketing, Wallet, Feed, Profile, Notifications)
- ⚠️ **Partial:** 4 systems (Refunds, Messaging, Analytics, Guest Checkout)
- ❌ **Broken:** 1 system (Wallet Passes - iOS/Android wallet integration)

### **Organizer Mode Systems:** 15 core areas
- ✅ **Stable:** 8 systems (Dashboard, Event Management, Scanner, Analytics, Org Management, Refund Processing, Communications, Campaigns)
- ⚠️ **Partial:** 6 systems (Sponsorship, Payouts, Teams, Advanced Analytics, Campaign Analytics, Wallet/Accounting)
- ❌ **Broken:** 1 system (Stripe Connect payout automation)

### **Platform-Wide Issues:**
1. **RLS Permissions:** Some org memberships missing, causing dashboard revenue discrepancies
2. **Revenue Calculations:** Recently fixed (was using price × sold, now uses orders.subtotal_cents)
3. **Ticket Accounting:** Recently hardened with capacity constraints and reconciliation functions
4. **Event Views Tracking:** Recently wired to analytics.user_event_interactions via RPC

---

## 👥 ATTENDEE MODE SYSTEMS

| Mode | System | Layer | Description | Key Files / Modules | Key Tables / Entities | Status | Notes |
|------|--------|-------|-------------|---------------------|----------------------|--------|-------|
| Attendee | **Auth & Profile** | Frontend + Backend + Database | User authentication, profile management, role assignment (attendee/organizer/admin) | `src/contexts/AuthContext.tsx`, `src/pages/AuthPage.tsx`, `src/pages/new-design/ProfilePage.tsx`, `supabase/auth` | `auth.users`, `public.user_profiles`, `public.role` | ✅ Stable | Supabase Auth integration. Profile role determines mode access. Session refresh on org switching works. |
| Attendee | **Event Discovery & Search** | Frontend + Backend + Database | Browse events, search by location/category/date, filter and sort, view event details | `src/pages/new-design/SearchPage.tsx`, `src/features/feed/routes/FeedPageNewDesign.tsx`, `supabase/functions/search-events`, `src/features/feed/hooks/useUnifiedFeedInfinite.ts` | `events.events`, `events.event_categories`, `public.event_search_view` | ✅ Stable | Unified feed with optimistic updates. Search supports location radius, categories, dates. Post creation instant (<50ms). |
| Attendee | **Event Details** | Frontend + Backend + Database | View event page with cover image, description, venue, schedule, ticket tiers, posts, attendees | `src/pages/new-design/EventDetailsPage.tsx`, `src/pages/EventsPage.tsx`, `src/pages/EventSlugPage.tsx` | `events.events`, `ticketing.ticket_tiers`, `social.event_posts`, `analytics.user_event_interactions` | ✅ Stable | Supports slug-based URLs. View tracking wired to analytics. Posts, comments, reactions displayed. |
| Attendee | **Ticketing & Checkout** | Frontend + Backend + Database | Select tickets, purchase flow, Stripe payment, order creation, ticket issuance | `src/components/EventCheckoutSheet.tsx`, `src/components/TicketPurchaseModal.tsx`, `supabase/functions/enhanced-checkout`, `supabase/functions/guest-checkout`, `supabase/functions/stripe-webhook` | `ticketing.ticket_tiers`, `ticketing.orders`, `ticketing.order_items`, `ticketing.tickets`, `ticketing.ticket_holds`, `ticketing.checkout_sessions` | ✅ Stable | Member + guest checkout supported. Free tickets handled. Hold system (15min expiry). Atomic ticket creation. Capacity constraints enforced. |
| Attendee | **Wallet / Tickets** | Frontend + Backend + Database | View all tickets, QR codes, ticket status (issued/redeemed/refunded), event details, add to calendar | `src/pages/new-design/TicketsPage.tsx`, `src/components/TicketsPage.tsx`, `src/hooks/useTickets.tsx`, `supabase/functions/get-user-tickets` | `ticketing.tickets`, `events.events`, `ticketing.ticket_tiers` | ✅ Stable | Offline-first with caching. QR codes generated (8-char alphanumeric). Ticket status tracking. Event details linked. |
| Attendee | **Wallet Passes (iOS/Android)** | Frontend + Backend | Apple Wallet / Google Wallet integration for tickets | `ticketing.tickets.wallet_pass_url`, Stripe Terminal / PassKit | `ticketing.tickets.wallet_pass_url` | ❌ Broken | Column exists but no generation logic. Needs PassKit/Google Wallet API integration. |
| Attendee | **Refund Requests** | Frontend + Backend + Database | Request refunds for tickets, select reason, track status, receive updates | `src/pages/new-design/TicketsPage.tsx`, `supabase/functions/submit-refund-request`, `supabase/functions/review-refund-request` | `ticketing.refund_requests`, `ticketing.refund_policies`, `ticketing.refunds`, `ticketing.refund_log` | ⚠️ Partial | Request flow works. Auto-approve toggle exists. Full refund processing via Stripe works. Partial refunds not yet supported (v1 limitation). |
| Attendee | **Social Feed** | Frontend + Backend + Database | View event posts, like/comment/share, create posts, view organizer posts, real-time updates | `src/features/feed/routes/FeedPageNewDesign.tsx`, `src/features/posts/components/PostCreatorModal.tsx`, `src/features/posts/hooks/usePostCreation.ts`, `supabase/functions/posts-create`, `src/features/comments` | `social.event_posts`, `social.event_reactions`, `social.event_comments`, `storage.post_media` | ✅ Stable | Optimistic updates (98% faster). 30s video limit. Sound toggle. Real-time likes/comments via Supabase Realtime. Delete posts works. |
| Attendee | **Messaging** | Frontend + Backend + Database | Direct messages with users/orgs, conversation threads, read receipts | `src/components/messaging/MessagingCenter.tsx`, `src/pages/new-design/MessagesPage.tsx`, `src/utils/messaging.ts` | `messaging.direct_conversations`, `messaging.conversation_participants`, `messaging.direct_messages` | ⚠️ Partial | Basic messaging works. Conversation creation works. Real-time updates via Realtime. Request/approval flow exists but UI incomplete. |
| Attendee | **Notifications** | Frontend + Backend + Database | Push notifications, email notifications, in-app notification center | `src/pages/new-design/NotificationsPage.tsx`, `src/hooks/useNotifications.tsx`, `supabase/functions/send-push-notification`, `supabase/functions/process-email-queue` | `public.notifications`, `public.user_devices`, `public.notification_preferences` | ✅ Stable | Notification center displays. Push device registration. Email queue processing. Preference management exists. |
| Attendee | **Analytics (Visible)** | Frontend + Backend | Event view counts, likes, comments (public metrics only) | `analytics.user_event_interactions`, `public.get_event_views` RPC | `analytics.user_event_interactions`, `analytics.events` | ⚠️ Partial | View tracking works (recently fixed). PostHog integration exists. Internal analytics table access via RPC only. |
| Attendee | **Guest Checkout** | Frontend + Backend + Database | Purchase tickets without account, OTP verification, guest ticket access | `supabase/functions/guest-checkout`, `supabase/functions/guest-tickets-start`, `supabase/functions/guest-tickets-verify`, `ticketing.guest_ticket_sessions`, `ticketing.guest_otp_codes` | `ticketing.guest_ticket_sessions`, `ticketing.guest_otp_codes`, `ticketing.checkout_sessions` | ⚠️ Partial | Guest checkout flow works. OTP system exists. Guest ticket viewing via token works. Email verification optional. |

---

## 🎯 ORGANIZER / ORG MODE SYSTEMS

| Mode | System | Layer | Description | Key Files / Modules | Key Tables / Entities | Status | Notes |
|------|--------|-------|-------------|---------------------|----------------------|--------|-------|
| Organizer | **Organization Management** | Frontend + Backend + Database | Create/edit orgs, manage members, assign roles, switch between orgs | `src/components/OrganizationCreator.tsx`, `src/components/OrgSwitcher.tsx`, `src/hooks/useOrganizations.tsx` | `organizations.organizations`, `organizations.org_memberships`, `organizations.org_invitations` | ✅ Stable | Org creation works. Member invites exist. Role assignment (owner/admin/editor/viewer). Org switching triggers session refresh. Recent fix: Missing memberships added for all user orgs. |
| Organizer | **Organizer Dashboard** | Frontend + Backend + Database | Overview of all events, revenue, attendees, views, recent activity, org selection | `src/components/OrganizerDashboard.tsx`, `src/features/dashboard/routes/DashboardPage.tsx`, `src/hooks/useOrganizerData.ts` | `events.events`, `ticketing.orders`, `ticketing.tickets`, `analytics.user_event_interactions` | ✅ Stable | Revenue uses orders.subtotal_cents (recently fixed). Parallel queries (no N+1). Session refresh on org switch. Views via RPC. All 35 orders now visible (RLS fixed). |
| Organizer | **Event Management** | Frontend + Backend + Database | Create/edit events, manage ticket tiers, set pricing, configure settings, view analytics | `src/components/EventManagement.tsx`, `src/components/CreateEventFlow.tsx`, `src/pages/CreateEventPage.tsx` | `events.events`, `ticketing.ticket_tiers`, `events.event_roles`, `events.event_invites` | ✅ Stable | Full CRUD for events. Ticket tier management. Event roles (scanner/staff/volunteer). Revenue calculations fixed (uses actual orders). Per-tier revenue display. |
| Organizer | **Event Analytics** | Frontend + Backend + Database | Revenue breakdown, ticket sales, attendee demographics, check-ins, views, engagement metrics | `src/components/EventManagement.tsx`, `src/components/AnalyticsHub.tsx`, `src/hooks/useOrganizerAnalytics.tsx`, `supabase/functions/analytics-event-overview` | `ticketing.orders`, `ticketing.tickets`, `ticketing.scan_logs`, `analytics.user_event_interactions`, `social.event_reactions` | ✅ Stable | Revenue accurate (orders.subtotal_cents). Ticket counts from tickets table. Check-ins from scan_logs. Views from analytics RPC. Engagement metrics (likes/comments). |
| Organizer | **Scanner / Check-In** | Frontend + Backend + Database | QR code scanner for ticket validation, check-in attendees, scan history, duplicate prevention | `src/components/scanner/ScannerView.tsx`, `src/pages/new-design/ScannerSelectEventPage.tsx`, `supabase/functions/scanner-validate`, `supabase/functions/scanner-authorize` | `ticketing.tickets`, `ticketing.scan_logs`, `events.event_scanners`, `events.event_roles` | ✅ Stable | Camera-based QR scanning. Manual entry fallback. Duplicate prevention (10s cooldown). Scan history (last 25). Haptic feedback. Authorization via event_roles or event_scanners. |
| Organizer | **Refund Processing** | Frontend + Backend + Database | Review refund requests, approve/decline, process refunds via Stripe, track refund status | `src/pages/new-design/OrganizerRefundsPage.tsx`, `supabase/functions/review-refund-request`, `supabase/functions/process-refund` | `ticketing.refund_requests`, `ticketing.refund_policies`, `ticketing.refunds`, `ticketing.refund_log` | ✅ Stable | Request queue display. Approve/decline workflow. Stripe refund processing. Inventory release. Email notifications. Auto-approve toggle per event. |
| Organizer | **Communications / Messaging** | Frontend + Backend + Database | Broadcast emails/SMS to attendees, segment by role, message templates, job queue | `src/components/organizer/OrganizerCommsPanel.tsx`, `src/hooks/useMessaging.tsx`, `supabase/functions/messaging-queue`, `supabase/functions/process-email-queue` | `messaging.message_jobs`, `messaging.contact_lists`, `ticketing.orders` (for attendee lists) | ✅ Stable | Email + SMS broadcasting. Template system. Role-based segmentation. Job queue processing. Audience size preview. Delivery tracking. |
| Organizer | **Sponsorship Management** | Frontend + Backend + Database | Create sponsorship packages, receive proposals, approve/reject, track deliverables, manage escrow | `src/components/EventSponsorshipManagement.tsx`, `src/pages/SponsorshipPage.tsx`, `supabase/functions/sponsorship-checkout`, `supabase/functions/sponsor-create-intent` | `sponsorship.sponsorship_packages`, `sponsorship.sponsorship_orders`, `sponsorship.sponsors`, `sponsorship.proposals` | ⚠️ Partial | Package creation works. Proposal system exists. Escrow state tracking. Deliverable system incomplete. ROI reporting partial. |
| Organizer | **Payouts / Wallet** | Frontend + Backend + Database | View revenue balance, payout history, Stripe Connect integration, wallet transactions | `src/pages/OrgWalletPage.tsx`, `src/components/PayoutPanel.tsx`, `supabase/functions/get-org-wallet`, `supabase/functions/create-payout` | `organizations.org_wallets`, `ticketing.orders`, `sponsorship.sponsorship_orders`, `event_connect.stripe_connect_account_id` | ⚠️ Partial | Wallet balance display works. Transaction history exists. Stripe Connect setup exists. Automatic payout scheduling incomplete (manual only). Payout queue system partial. |
| Organizer | **Campaigns / Advertising** | Frontend + Backend + Database | Create ad campaigns, upload creatives, set budget, target audience, track performance | `src/pages/CampaignDashboardPage.tsx`, `src/components/campaigns/CampaignCreatorWizard.tsx`, `src/hooks/useCampaigns.ts`, `supabase/functions/campaigns-create` | `campaigns.campaigns`, `campaigns.ad_creatives`, `campaigns.ad_impressions`, `campaigns.ad_clicks` | ✅ Stable | Campaign creation works. Creative upload. Budget management. Ad serving via get_eligible_ads(). Impression/click tracking. Analytics dashboard. |
| Organizer | **Campaign Analytics** | Frontend + Backend + Database | View campaign performance, CTR, CPC, conversions, budget spend, ROI | `src/pages/CampaignAnalyticsPage.tsx`, `src/components/campaigns/CampaignAnalytics.tsx`, `supabase/functions/campaigns-analytics` | `campaigns.ad_impressions`, `campaigns.ad_clicks`, `campaigns.campaign_analytics_daily` | ⚠️ Partial | Basic analytics work. Daily rollups exist. Advanced funnels incomplete. AI recommendations partial. |
| Organizer | **Team Management** | Frontend + Backend + Database | Invite team members, assign event roles (scanner/staff), manage permissions | `src/components/OrganizationTeamPanel.tsx`, `src/components/OrganizerRolesPanel.tsx`, `supabase/functions/send-role-invite` | `organizations.org_memberships`, `events.event_roles`, `events.role_invites` | ⚠️ Partial | Org member invites work. Event role assignment works. Role-based permissions enforced. Bulk invite incomplete. |
| Organizer | **Advanced Analytics** | Frontend + Backend + Database | Funnel analysis, cohort tracking, audience intelligence, AI insights | `src/components/AnalyticsHub.tsx`, `supabase/functions/analytics-org-overview`, `supabase/functions/analytics-ai-insights` | `analytics.funnels`, `analytics.cohorts`, `analytics.audience_intelligence` | ⚠️ Partial | Basic analytics stable. Funnel queries exist. Cohort tracking partial. AI insights incomplete. Audience intelligence schema exists but underutilized. |
| Organizer | **Event Attendees** | Frontend + Backend + Database | View attendee list, filter by tier, export CSV, check-in status | `src/pages/EventAttendeesPage.tsx`, `src/pages/EventAttendeesPageEnhanced.tsx` | `ticketing.tickets`, `ticketing.orders`, `public.user_profiles` | ✅ Stable | Attendee list display. Tier filtering. Check-in status. Export functionality exists. |
| Organizer | **Stripe Connect** | Backend + Database | Stripe Connect account setup, payout destination configuration | `supabase/functions/create-stripe-connect`, `supabase/functions/stripe-connect-portal` | `event_connect.stripe_connect_account_id`, `organizations.stripe_account_id` | ❌ Broken | Stripe Connect setup exists but payout automation not working. Manual payouts only. Payout queue system incomplete. |

---

## 🔧 PLATFORM-WIDE SYSTEMS

| System | Layer | Description | Key Files / Modules | Key Tables / Entities | Status | Notes |
|--------|-------|-------------|---------------------|----------------------|--------|-------|
| **Feed Optimization** | Frontend + Backend | Instant post creation, optimistic cache updates, real-time sync | `src/features/feed/utils/optimisticUpdates.ts`, `src/features/posts/hooks/usePostCreation.ts`, `supabase/functions/posts-create` | `social.event_posts`, React Query cache | ✅ Stable | 98% faster (<50ms vs 1-3s). Optimistic updates work. Real-time likes/comments. Auto-scroll on post creation. |
| **Video Processing** | Backend | Mux integration for video upload, transcoding, playback | `supabase/functions/mux-create-direct-upload`, `supabase/functions/resolve-mux-upload`, `supabase/functions/mux-webhook` | `storage.videos`, Mux API | ✅ Stable | Direct upload to Mux. 30s duration limit. Transcoding handled by Mux. Playback ID generation. |
| **Email System** | Backend | Transactional emails, templates, queue processing | `supabase/functions/send-email`, `supabase/functions/process-email-queue`, `supabase/functions/send-purchase-confirmation` | `messaging.email_queue`, Resend API | ✅ Stable | Email queue system. Template support. Purchase confirmations. Refund confirmations. |
| **Push Notifications** | Backend | Push notifications to mobile devices, device registration | `supabase/functions/send-push-notification`, `supabase/functions/process-push-queue` | `public.user_devices`, Firebase/APNs | ⚠️ Partial | Device registration works. Push queue exists. Delivery tracking partial. |
| **Search** | Frontend + Backend | Event search with location, category, date filters | `src/pages/new-design/SearchPage.tsx`, `supabase/functions/search-events` | `events.events`, PostGIS (location) | ✅ Stable | Full-text search. Location radius. Category filtering. Date range. |
| **RLS (Row Level Security)** | Database | Permission policies for data access based on user role/org | All schemas | All tables | ⚠️ Partial | Most tables have RLS enabled. Some org membership issues recently fixed. Policies enforced but some edge cases exist. |
| **Ticket Accounting** | Database | Capacity constraints, reconciliation functions, hold cleanup | `ticketing.ticket_tiers`, `ticketing.complete_order_atomic()`, `ticketing.reconcile_event_tickets()`, `public.cleanup_expired_ticket_holds()` | `ticketing.ticket_tiers`, `ticketing.ticket_holds`, `ticketing.tickets` | ✅ Stable | Recently hardened. Capacity constraints prevent over-selling. Atomic ticket creation. Reconciliation functions. Cron jobs for cleanup. |
| **Cron Jobs** | Database | Automated tasks (cleanup, reconciliation, data retention) | `pg_cron` extension | Various | ✅ Stable | Expired hold cleanup (every 5 min). Event reconciliation (daily). Data retention policies. |
| **Analytics Tracking** | Frontend + Backend + Database | PostHog integration, internal analytics, event views | `src/lib/posthog.ts`, `src/utils/interactions.ts`, `analytics.user_event_interactions`, `supabase/functions/track-analytics` | `analytics.user_event_interactions`, `analytics.events`, PostHog | ✅ Stable | PostHog for external analytics. Internal table for event views. View tracking recently fixed. RPC function for access. |

---

## 🚨 Critical Issues & Tech Debt

### **High Priority:**

1. **Stripe Connect Payout Automation** ❌
   - **Issue:** Payout queue system exists but not fully automated
   - **Impact:** Organizers must manually request payouts
   - **Files:** `supabase/functions/create-payout`, `payout_queue` table
   - **Status:** Manual payouts work, automation incomplete

2. **Wallet Passes (iOS/Android)** ❌
   - **Issue:** No PassKit/Google Wallet integration
   - **Impact:** Users can't add tickets to native wallet apps
   - **Files:** `ticketing.tickets.wallet_pass_url` column exists but unused
   - **Status:** Column ready, generation logic missing

3. **RLS Org Membership Edge Cases** ⚠️
   - **Issue:** Some users missing org_memberships after org creation
   - **Impact:** Dashboard revenue/order visibility issues (recently fixed for one user)
   - **Files:** Organization creation flow, `organizations.org_memberships`
   - **Status:** Fixed for current user, may affect others

### **Medium Priority:**

4. **Partial Refunds** ⚠️
   - **Issue:** Only full refunds supported (v1 limitation)
   - **Impact:** Can't refund individual tickets from multi-ticket orders
   - **Files:** `supabase/functions/process-refund`, refund request flow
   - **Status:** Schema supports it, logic needs update

5. **Guest Checkout Email Verification** ⚠️
   - **Issue:** Guest checkout works but email verification optional
   - **Impact:** Potential fraud risk
   - **Files:** `supabase/functions/guest-checkout`, `ticketing.guest_otp_codes`
   - **Status:** OTP system exists, not required

6. **Campaign Analytics Advanced Features** ⚠️
   - **Issue:** Basic analytics work, funnels/cohorts incomplete
   - **Impact:** Limited campaign optimization insights
   - **Files:** `src/pages/CampaignAnalyticsPage.tsx`, analytics functions
   - **Status:** Basic stable, advanced partial

7. **Sponsorship Deliverables Tracking** ⚠️
   - **Issue:** Deliverable system exists but incomplete
   - **Impact:** Manual tracking required for sponsor fulfillment
   - **Files:** Sponsorship management components
   - **Status:** Schema ready, UI/logic incomplete

### **Low Priority:**

8. **Messaging Request/Approval UI** ⚠️
   - **Issue:** Conversation request flow exists but UI incomplete
   - **Impact:** Users can't easily approve/decline message requests
   - **Files:** `src/components/messaging/MessagingCenter.tsx`
   - **Status:** Backend works, UI needs polish

9. **Team Bulk Invites** ⚠️
   - **Issue:** Single invites work, bulk invite missing
   - **Impact:** Slow team onboarding for large orgs
   - **Files:** `src/components/OrganizationTeamPanel.tsx`
   - **Status:** Single invite stable, bulk feature planned

10. **Audience Intelligence Underutilized** ⚠️
    - **Issue:** Schema exists but features not built
    - **Impact:** Missing advanced targeting/segmentation
    - **Files:** Analytics schema, audience intelligence tables
    - **Status:** Infrastructure ready, features not built

---

## 📈 Recent Fixes & Improvements (Last 30 Days)

1. ✅ **Revenue Calculations Fixed**
   - Changed from `price × sold` to `orders.subtotal_cents`
   - All components updated (EventManagement, OrganizerDashboard, AnalyticsHub)

2. ✅ **Ticket Accounting Hardened**
   - Capacity constraints added
   - Atomic ticket creation function
   - Reconciliation functions created
   - Cron jobs for cleanup

3. ✅ **Feed Optimization**
   - Optimistic updates implemented
   - 98% performance improvement
   - Real-time sync for likes/comments

4. ✅ **RLS Org Membership**
   - Fixed missing memberships for current user
   - Session refresh on org switching

5. ✅ **Event Views Tracking**
   - Wired to `analytics.user_event_interactions`
   - RPC function for dashboard access
   - PostHog + internal tracking

6. ✅ **Pagination Fixes**
   - Override PostgREST limits with `.range(0, 9999)`
   - Separate queries for orders/tickets

---

## 🎯 Recommended Next Steps

### **Immediate (P0):**
1. Fix Stripe Connect payout automation
2. Implement wallet pass generation (PassKit/Google Wallet)
3. Audit all org_memberships for missing entries

### **Short-term (P1):**
4. Implement partial refunds
5. Complete sponsorship deliverables tracking
6. Enhance campaign analytics (funnels/cohorts)

### **Medium-term (P2):**
7. Build audience intelligence features
8. Add bulk team invites
9. Complete messaging request/approval UI

---

## 📝 Notes on Data Consistency

### **Revenue Sources:**
- ✅ **Net Revenue:** `ticketing.orders.subtotal_cents` (what organizer receives)
- ✅ **Gross Revenue:** `ticketing.orders.total_cents` (what customer pays)
- ✅ **Fees:** `ticketing.orders.fees_cents` (platform + Stripe fees)
- ✅ **Per-Tier Revenue:** `ticketing.order_items` aggregated by tier

### **Ticket Counts:**
- ✅ **Sold:** Count from `ticketing.tickets` table
- ✅ **Issued:** `ticketing.ticket_tiers.issued_quantity` (counter)
- ✅ **Reserved:** `ticketing.ticket_tiers.reserved_quantity` (active holds)
- ✅ **Capacity:** `ticketing.ticket_tiers.quantity` (max available)

### **RLS Policies:**
- ✅ **Orders:** Users see own orders + org members see org event orders
- ✅ **Tickets:** Users see own tickets + event managers see event tickets
- ✅ **Events:** Public events visible to all, org members manage org events
- ⚠️ **Analytics:** RPC functions bypass RLS for dashboard access

---

**Document Version:** 1.0  
**Last Updated:** December 11, 2025  
**Audit Scope:** Complete platform inventory (Attendee + Organizer modes)

