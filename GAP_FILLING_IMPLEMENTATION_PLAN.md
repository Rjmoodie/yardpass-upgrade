# Gap Filling Implementation Plan
## Comprehensive Plan to Address Technical Audit Findings

**Date:** January 6, 2025  
**Status:** Planning Phase  
**Priority:** Critical Gaps → High Priority → Medium Priority

---

## Executive Summary

This plan addresses all critical gaps identified in the technical audit, organized by priority and timeline. Each task includes implementation steps, file locations, dependencies, and testing requirements.

**Total Estimated Effort:** ~16-20 weeks  
**Critical Path:** 6-8 weeks (pre-launch)  
**Post-Launch:** 10-12 weeks (ongoing improvements)

**Note:** This plan now includes additional "meta" safety nets and business/compliance edges identified in the review, including age compliance, cookie consent, data retention, price trust fixes, health checks, push notification wiring, CI/CD, admin tools, and operational metrics.

---

## Phase 1: Critical Pre-Launch (Weeks 1-4)

### 1.1 Legal Review & Policy Finalization 🔴 **CRITICAL**

**Priority:** P0 - Blocking Launch  
**Effort:** 1 week (external legal work)  
**Owner:** Legal + Product

**Tasks:**
1. **Legal Review of Existing Policies**
   - Review `src/pages/PrivacyPolicy.tsx`
   - Review `src/pages/TermsOfService.tsx`
   - Review `src/pages/RefundPolicy.tsx`
   - Ensure GDPR/CCPA compliance
   - Verify payment terms accuracy

2. **Create Community Guidelines**
   - Draft Community Guidelines content
   - Create `src/pages/CommunityGuidelines.tsx`
   - Add route in `src/App.tsx`
   - Link from footer/navigation

**Files to Create/Modify:**
- `src/pages/CommunityGuidelines.tsx` (new)
- `src/App.tsx` (add route)
- `src/components/layout/Footer.tsx` (add link, if exists)

**Acceptance Criteria:**
- [ ] All policies reviewed and approved by legal
- [ ] Community Guidelines page created and accessible
- [ ] Policies linked from footer/legal section
- [ ] Last updated dates accurate

**Dependencies:** Legal counsel availability

**Additional Note - Processor/Subprocessor Documentation:**
- This is primarily a legal/documentation task, not code
- Create Data Processing Agreement (DPA) with:
  - Supabase
  - Stripe
  - Mux
  - PostHog
  - Resend
  - OneSignal (if used)
- Add "Subprocessors" section to Privacy Policy
- List all third-party services that process user data
- Update when new services are added

---

### 1.2 GDPR Compliance: Data Export & Deletion 🔴 **CRITICAL**

**Priority:** P0 - Legal Requirement  
**Effort:** 2-3 weeks  
**Owner:** Backend + Frontend

**Note:** This task already covers data export and deletion. Additional compliance items (age gate, cookie consent, data retention) are covered in tasks 1.8-1.10 below.

#### Task 1.2.1: Data Export Functionality

**Implementation Steps:**

1. **Create Data Export Edge Function**
   - File: `supabase/functions/export-user-data/index.ts`
   - Collects all user data from:
     - `user_profiles`
     - `tickets` (user's tickets)
     - `orders` (user's orders)
     - `event_posts` (user's posts)
     - `event_comments` (user's comments)
     - `direct_messages` (user's messages)
     - `notifications` (user's notifications)
   - Formats as JSON
   - Returns download link (signed URL, expires in 24h)

2. **Create Database Function for Data Collection**
   - File: `supabase/migrations/20250107_create_export_user_data_rpc.sql`
   - Function: `export_user_data(p_user_id UUID) RETURNS JSONB`
   - Collects all user data in single query
   - Returns structured JSON

3. **Add UI for Data Export**
   - File: `src/pages/new-design/ProfilePage.tsx` (add export button)
   - Or: `src/components/AccountSettings.tsx` (new component)
   - Button: "Download My Data"
   - Shows progress/status
   - Downloads JSON file when ready

**Files to Create:**
- `supabase/functions/export-user-data/index.ts`
- `supabase/migrations/20250107_create_export_user_data_rpc.sql`
- `src/components/AccountSettings.tsx` (if doesn't exist)

**Files to Modify:**
- `src/pages/new-design/ProfilePage.tsx` (add export button)
- `src/lib/ticketApi.ts` (add export function)

**Testing:**
- [ ] Export includes all user data
- [ ] Export excludes other users' data
- [ ] Download link expires after 24h
- [ ] Large exports (>10MB) handled gracefully
- [ ] RLS policies respected

**Acceptance Criteria:**
- [ ] Users can request data export
- [ ] Export includes all personal data
- [ ] Export is downloadable within 24h
- [ ] Export format is machine-readable (JSON)

#### Task 1.2.2: Account Deletion Functionality

**Implementation Steps:**

1. **Create Account Deletion Edge Function**
   - File: `supabase/functions/delete-user-account/index.ts`
   - Validates user authentication
   - Checks for active orders/tickets (may block deletion)
   - Soft-deletes user data:
     - Anonymizes `user_profiles` (sets display_name to "Deleted User")
     - Deletes `direct_messages` (user's messages)
     - Deletes `notifications` (user's notifications)
     - Removes from `org_memberships` (if not owner)
     - Cancels pending orders
     - Marks tickets as void (if not redeemed)
   - Hard-deletes sensitive data:
     - `user_profiles.phone` → NULL
     - `user_profiles.email` → NULL
   - Deletes auth user via Supabase Admin API

2. **Create Database Function for Account Deletion**
   - File: `supabase/migrations/20250107_create_delete_user_account_rpc.sql`
   - Function: `delete_user_account(p_user_id UUID) RETURNS JSONB`
   - Handles cascading deletes
   - Returns deletion summary

3. **Add UI for Account Deletion**
   - File: `src/components/AccountSettings.tsx` or `src/pages/new-design/ProfilePage.tsx`
   - Button: "Delete My Account"
   - Confirmation dialog with warnings
   - Shows what will be deleted
   - Requires password/OTP confirmation

4. **Handle Edge Cases**
   - Active orders: Block deletion or cancel orders
   - Redeemed tickets: Cannot delete (ticket already used)
   - Organization owner: Transfer ownership or block deletion
   - Pending refunds: Process refunds first

**Files to Create:**
- `supabase/functions/delete-user-account/index.ts`
- `supabase/migrations/20250107_create_delete_user_account_rpc.sql`

**Files to Modify:**
- `src/pages/new-design/ProfilePage.tsx` (add delete button)
- `src/lib/ticketApi.ts` (add delete function)

**Testing:**
- [ ] Account deletion removes all personal data
- [ ] Anonymized data remains (for analytics)
- [ ] Active orders handled correctly
- [ ] Organization ownership transferred
- [ ] Cannot delete if tickets redeemed
- [ ] Auth user deleted from Supabase

**Acceptance Criteria:**
- [ ] Users can delete their accounts
- [ ] All personal data removed/anonymized
- [ ] Edge cases handled gracefully
- [ ] Deletion is irreversible (with confirmation)

**Dependencies:** None  
**Risks:** Organization ownership transfer complexity

---

### 1.3 Error Monitoring Integration 🟡 **HIGH PRIORITY**

**Priority:** P1 - Critical for Production  
**Effort:** 1 week  
**Owner:** Frontend + DevOps

**Implementation Steps:**

1. **Install Sentry SDK**
   ```bash
   npm install @sentry/react @sentry/tracing
   ```

2. **Initialize Sentry in Frontend**
   - File: `src/lib/sentry.ts` (new)
   - Initialize with DSN from env vars
   - Configure release tracking
   - Set up source maps

3. **Add Error Boundaries**
   - File: `src/components/ErrorBoundary.tsx` (may exist, enhance)
   - Wrap main app in error boundary
   - Capture React errors

4. **Add Sentry to Edge Functions**
   - File: `supabase/functions/_shared/sentry.ts` (new)
   - Initialize Sentry for Deno
   - Wrap Edge Functions with error capture

5. **Configure Alerts**
   - Set up Sentry alerts for:
     - Payment failures
     - Ticket generation failures
     - Webhook processing failures
     - High error rates

**Files to Create:**
- `src/lib/sentry.ts`
- `supabase/functions/_shared/sentry.ts`

**Files to Modify:**
- `src/main.tsx` (initialize Sentry)
- `src/App.tsx` (add error boundary)
- All Edge Functions (add Sentry capture)

**Environment Variables:**
- `VITE_SENTRY_DSN` (frontend)
- `SENTRY_DSN` (Edge Functions)

**Testing:**
- [ ] Errors captured in Sentry
- [ ] Source maps work correctly
- [ ] Alerts configured and working
- [ ] No PII in error reports

**Acceptance Criteria:**
- [ ] All errors logged to Sentry
- [ ] Alerts configured for critical errors
- [ ] Source maps enable debugging
- [ ] Error rate monitoring active

**Dependencies:** Sentry account setup  
**Risks:** None

---

### 1.4 Content Reporting System 🟡 **HIGH PRIORITY**

**Priority:** P1 - Required for Scale  
**Effort:** 2 weeks  
**Owner:** Backend + Frontend

**Implementation Steps:**

1. **Create Content Reports Table**
   - File: `supabase/migrations/20250108_create_content_reports.sql`
   - Table: `public.content_reports`
   - Columns:
     - `id` UUID PRIMARY KEY
     - `reporter_user_id` UUID (who reported)
     - `content_type` TEXT ('post' | 'comment' | 'message' | 'user' | 'event')
     - `content_id` UUID (ID of reported content)
     - `reason` TEXT (spam, harassment, inappropriate, etc.)
     - `details` TEXT (optional details)
     - `status` TEXT ('pending' | 'reviewed' | 'resolved' | 'dismissed')
     - `reviewed_by` UUID (admin who reviewed)
     - `reviewed_at` TIMESTAMPTZ
     - `action_taken` TEXT (deleted, warned, no_action, etc.)
     - `created_at` TIMESTAMPTZ

2. **Create Reporting Edge Function**
   - File: `supabase/functions/report-content/index.ts`
   - Validates reporter authentication
   - Creates report record
   - Sends notification to admins (if needed)
   - Returns report ID

3. **Add Reporting UI**
   - File: `src/components/ReportContentDialog.tsx` (new)
   - Trigger: "Report" button on posts/comments/messages
   - Form: Reason dropdown, details textarea
   - Submits to `report-content` function

4. **Add Admin Moderation Dashboard**
   - File: `src/pages/admin/ContentModerationPage.tsx` (new)
   - Lists pending reports
   - Allows review/action
   - Shows report details and content

5. **RLS Policies**
   - Users can create reports
   - Users can view their own reports
   - Admins can view all reports
   - Service role can manage reports

**Files to Create:**
- `supabase/migrations/20250108_create_content_reports.sql`
- `supabase/functions/report-content/index.ts`
- `src/components/ReportContentDialog.tsx`
- `src/pages/admin/ContentModerationPage.tsx`

**Files to Modify:**
- `src/components/post-viewer/FullscreenPostViewer.tsx` (add report button)
- `src/features/comments/components/CommentItem.tsx` (add report button)
- `src/components/messaging/MessagingCenter.tsx` (add report button)
- `src/App.tsx` (add admin route)

**Testing:**
- [ ] Users can report content
- [ ] Reports stored correctly
- [ ] Admins can view reports
- [ ] RLS policies enforced
- [ ] Duplicate reports handled (deduplication)

**Acceptance Criteria:**
- [ ] Reporting UI accessible from posts/comments/messages
- [ ] Reports stored in database
- [ ] Admin dashboard shows pending reports
- [ ] Admins can take action on reports

**Dependencies:** Admin role/permissions system  
**Risks:** None

---

### 1.5 Bundle Size Optimization 🟢 **MEDIUM PRIORITY**

**Priority:** P2 - Performance Improvement  
**Effort:** 1-2 weeks  
**Owner:** Frontend

**Current State:** 560 KB gzipped (target: <200 KB)

**Implementation Steps:**

1. **Further Split Vendor Chunk**
   - File: `vite.config.ts`
   - Extract more libraries:
     - `react-hook-form` + `zod` → 'forms' chunk
     - `date-fns` → 'dates' chunk
     - `@tanstack/react-virtual` → 'virtual' chunk
     - `dompurify` → 'security' chunk
     - `qrcode` → 'qr' chunk
     - `hls.js` → 'hls' chunk

2. **Lazy Load PostHog Completely**
   - File: `src/components/DeferredPostHog.tsx` (already exists, verify it's used)
   - Ensure PostHog loads after initial render
   - Move to separate chunk

3. **Remove Unused Dependencies**
   - Run bundle analyzer
   - Identify unused libraries
   - Remove dead code

4. **Optimize Images**
   - Add image optimization pipeline
   - Use WebP format
   - Lazy load images

5. **Code Splitting Improvements**
   - Lazy load analytics dashboards
   - Lazy load admin tools
   - Lazy load heavy components

**Files to Modify:**
- `vite.config.ts` (enhance manual chunks)
- `package.json` (remove unused deps)
- Image components (add lazy loading)

**Testing:**
- [ ] Bundle size < 200 KB gzipped
- [ ] Initial page load < 2s
- [ ] All features still work
- [ ] No broken imports

**Acceptance Criteria:**
- [ ] Interactive shell < 200 KB gzipped
- [ ] Page load time improved
- [ ] No functionality broken

**Dependencies:** None  
**Risks:** Low - mostly configuration changes

---

### 1.6 Fee & Tax Transparency 🟢 **MEDIUM PRIORITY**

**Priority:** P2 - User Trust  
**Effort:** 1-2 weeks  
**Owner:** Frontend + Backend

**Implementation Steps:**

1. **Add Fee Breakdown to Checkout UI**
   - File: `src/components/EventCheckoutSheet.tsx`
   - Show clear breakdown:
     - Ticket price
     - Platform fee
     - Processing fee
     - Total
   - Update pricing display to show all fees

2. **Add Fee Breakdown to Organizer Dashboard**
   - File: `src/pages/organizer/RevenueDashboard.tsx` (or create)
   - Show:
     - Gross revenue
     - Stripe fees
     - Platform fees
     - Net revenue
   - Per-event and aggregate views

3. **Update Pricing Calculation**
   - File: `supabase/functions/_shared/pricing.ts`
   - Ensure fees calculated correctly
   - Document fee structure

**Files to Create:**
- `src/pages/organizer/RevenueDashboard.tsx` (if doesn't exist)

**Files to Modify:**
- `src/components/EventCheckoutSheet.tsx` (add fee breakdown)
- Organizer dashboard components (add revenue breakdown)

**Testing:**
- [ ] Fee breakdown visible to users
- [ ] Organizer dashboard shows net revenue
- [ ] Fees calculated correctly
- [ ] All fees transparent

**Acceptance Criteria:**
- [ ] Users see all fees before checkout
- [ ] Organizers see net revenue breakdown
- [ ] Fee structure clear and transparent

**Dependencies:** None  
**Risks:** Low

---

### 1.7 Stripe Dispute Webhook Handler 🟡 **HIGH PRIORITY**

**Priority:** P1 - Payment Integrity  
**Effort:** 1 week  
**Owner:** Backend

**Implementation Steps:**

1. **Add Dispute Handler to Webhook**
   - File: `supabase/functions/stripe-webhook/index.ts`
   - Add case for `charge.dispute.created`
   - Add case for `charge.dispute.updated`
   - Add case for `charge.dispute.closed`

2. **Create Dispute Processing Function**
   - File: `supabase/functions/process-dispute/index.ts` (new, or add to existing)
   - Handles dispute creation:
     - Marks order as 'disputed'
     - Creates dispute record in DB
     - Notifies organizer
     - Freezes payout (if applicable)
   - Handles dispute resolution:
     - Updates order status
     - Releases/processes refund
     - Notifies parties

3. **Create Disputes Table**
   - File: `supabase/migrations/20250109_create_disputes_table.sql`
   - Table: `ticketing.disputes`
   - Columns:
     - `id` UUID PRIMARY KEY
     - `order_id` UUID REFERENCES ticketing.orders(id)
     - `stripe_dispute_id` TEXT UNIQUE
     - `status` TEXT ('warning_needs_response' | 'warning_under_review' | 'warning_closed' | 'needs_response' | 'under_review' | 'charge_refunded' | 'won' | 'lost')
     - `reason` TEXT (fraudulent, subscription_canceled, etc.)
     - `amount_cents` INTEGER
     - `created_at` TIMESTAMPTZ
     - `resolved_at` TIMESTAMPTZ

4. **Add Dispute Management UI**
   - File: `src/pages/organizer/DisputesPage.tsx` (new)
   - Shows disputes for organizer's events
   - Allows response submission
   - Shows dispute status

**Files to Create:**
- `supabase/migrations/20250109_create_disputes_table.sql`
- `src/pages/organizer/DisputesPage.tsx`

**Files to Modify:**
- `supabase/functions/stripe-webhook/index.ts` (add dispute handlers)

**Testing:**
- [ ] Dispute webhook received correctly
- [ ] Dispute record created in DB
- [ ] Organizer notified
- [ ] Payout frozen (if applicable)
- [ ] Dispute resolution handled

**Acceptance Criteria:**
- [ ] Disputes automatically tracked
- [ ] Organizers notified of disputes
- [ ] Dispute status visible in dashboard
- [ ] Dispute resolution updates order status

**Dependencies:** None  
**Risks:** Low

---

### 1.8 Automated Webhook Retry Cron 🟢 **MEDIUM PRIORITY**

**Priority:** P2 - Reliability  
**Effort:** 1 week  
**Owner:** Backend + DevOps

**Implementation Steps:**

1. **Verify Retry Queue Exists**
   - File: `supabase/migrations/20250128_create_webhook_retry_queue.sql` (already exists)
   - Verify table structure

2. **Enhance Retry Function**
   - File: `supabase/functions/process-webhook-retries/index.ts` (may exist)
   - Process failed webhooks from queue
   - Exponential backoff
   - Max retry attempts (e.g., 5)
   - Mark as failed after max retries

3. **Set Up Supabase Cron Job**
   - File: `supabase/migrations/20250110_setup_webhook_retry_cron.sql`
   - Cron: Run every 5 minutes
   - Calls `process-webhook-retries` function

4. **Add Monitoring**
   - Log retry attempts
   - Alert on high failure rate
   - Dashboard for retry queue status

**Files to Create:**
- `supabase/migrations/20250110_setup_webhook_retry_cron.sql`

**Files to Modify:**
- `supabase/functions/process-webhook-retries/index.ts` (if exists, enhance)

**Testing:**
- [ ] Cron job runs every 5 minutes
- [ ] Failed webhooks retried
- [ ] Exponential backoff works
- [ ] Max retries enforced
- [ ] Alerts on persistent failures

**Acceptance Criteria:**
- [ ] Webhook retries automated
- [ ] Retry queue processed regularly
- [ ] Failed webhooks eventually succeed or marked failed
- [ ] Monitoring/alerting in place

**Dependencies:** Supabase cron functionality  
**Risks:** Low

---

### 1.8 Age & Region Compliance 🔴 **CRITICAL**

**Priority:** P0 - Legal Requirement  
**Effort:** 1-2 weeks  
**Owner:** Frontend + Backend

**Implementation Steps:**

1. **Add Age Gate to Signup**
   - File: `src/components/auth/SmartAuthModal.tsx`
   - Add birthdate picker or age confirmation checkbox
   - Minimum age: 13+ (COPPA) or 16+ (GDPR, depending on region)
   - Store `date_of_birth` or `age_verified_at` in `user_profiles`
   - Block underage users from creating accounts

2. **Create Age Verification Migration**
   - File: `supabase/migrations/20250111_add_age_verification.sql`
   - Add `date_of_birth` DATE column to `users.user_profiles`
   - Add `age_verified_at` TIMESTAMPTZ column
   - Add `region` TEXT column (for region-aware behavior)
   - Add constraint: `date_of_birth` must be in the past

3. **Region Detection**
   - File: `src/lib/region-detection.ts` (new)
   - Detect region via IP geolocation (optional) or user selection
   - Store in user profile
   - Update UI copy based on region (EU vs US)

4. **Enforce Age Restrictions**
   - File: `supabase/functions/posts-create/index.ts` (add age check)
   - Block users under 13 from posting
   - Block users under 16 from certain features (if GDPR applies)

**Files to Create:**
- `supabase/migrations/20250111_add_age_verification.sql`
- `src/lib/region-detection.ts`

**Files to Modify:**
- `src/components/auth/SmartAuthModal.tsx` (add age gate)
- `supabase/migrations/20251109100000_secure_profile_creation.sql` (add age fields)

**Testing:**
- [ ] Age gate appears in signup flow
- [ ] Underage users blocked from signup
- [ ] Region detected/stored correctly
- [ ] Age restrictions enforced in backend

**Acceptance Criteria:**
- [ ] Age verification required at signup
- [ ] Underage users cannot create accounts
- [ ] Region stored for compliance
- [ ] Age restrictions enforced

**Dependencies:** None  
**Risks:** Medium - legal requirements vary by jurisdiction

---

### 1.9 Cookie & Tracking Consent 🟡 **HIGH PRIORITY**

**Priority:** P1 - GDPR/CCPA Compliance  
**Effort:** 1 week  
**Owner:** Frontend

**Implementation Steps:**

1. **Create Cookie Consent Component**
   - File: `src/components/CookieConsentBanner.tsx` (new)
   - Separate toggles: Necessary, Analytics, Marketing
   - Store preferences in localStorage + database
   - Show on first visit (EU/EEA users)

2. **Wire PostHog to Consent**
   - File: `src/lib/posthog.ts`
   - Check consent before initializing PostHog
   - Only track if "analytics" consent granted
   - Respect opt-out

3. **Wire Internal Analytics to Consent**
   - File: `src/hooks/useAnalytics.tsx`
   - Check consent before tracking events
   - Skip tracking if consent not granted

4. **Create Consent Storage**
   - File: `supabase/migrations/20250112_create_consent_tracking.sql`
   - Table: `public.user_consents` (optional, for audit trail)
   - Store consent preferences per user
   - Track consent changes over time

5. **Add Consent Management UI**
   - File: `src/components/ConsentSettings.tsx` (new)
   - Allow users to update consent preferences
   - Link from Privacy Policy page

**Files to Create:**
- `src/components/CookieConsentBanner.tsx`
- `src/components/ConsentSettings.tsx`
- `supabase/migrations/20250112_create_consent_tracking.sql` (optional)

**Files to Modify:**
- `src/lib/posthog.ts` (check consent)
- `src/hooks/useAnalytics.tsx` (check consent)
- `src/App.tsx` (show banner on first visit)
- `src/pages/PrivacyPolicy.tsx` (link to consent settings)

**Testing:**
- [ ] Consent banner appears for EU users
- [ ] PostHog respects consent
- [ ] Internal analytics respect consent
- [ ] Users can update preferences
- [ ] Consent persisted across sessions

**Acceptance Criteria:**
- [ ] Cookie consent banner functional
- [ ] Analytics only track with consent
- [ ] Users can manage preferences
- [ ] Consent logged for audit

**Dependencies:** Region detection (1.8)  
**Risks:** Low

---

### 1.10 Data Retention Policy (Backend) 🟡 **HIGH PRIORITY**

**Priority:** P1 - Compliance & Performance  
**Effort:** 1-2 weeks  
**Owner:** Backend + DevOps

**Implementation Steps:**

1. **Create Data Retention Migration**
   - File: `supabase/migrations/20250113_create_data_retention_policy.sql`
   - Define retention windows:
     - Logs: 90 days
     - Analytics events: 12 months (aggregate after 3 months)
     - Video errors: 30 days
     - Audit logs: 24 months

2. **Create Retention Cleanup Function**
   - File: `supabase/functions/cleanup-old-data/index.ts`
   - Delete logs older than retention window
   - Aggregate old analytics events
   - Archive before deletion (optional)

3. **Set Up Scheduled Cleanup**
   - File: `supabase/migrations/20250113_setup_retention_cron.sql`
   - Cron: Run daily at 2 AM
   - Calls cleanup function
   - Logs cleanup statistics

4. **Add Retention Monitoring**
   - Track data volume over time
   - Alert if retention fails
   - Dashboard showing data age

**Files to Create:**
- `supabase/migrations/20250113_create_data_retention_policy.sql`
- `supabase/migrations/20250113_setup_retention_cron.sql`
- `supabase/functions/cleanup-old-data/index.ts`

**Testing:**
- [ ] Old logs deleted after retention window
- [ ] Analytics aggregated correctly
- [ ] Cron job runs daily
- [ ] No critical data deleted prematurely

**Acceptance Criteria:**
- [ ] Automatic data retention enforced
- [ ] Old data cleaned up regularly
- [ ] Retention windows configurable
- [ ] Cleanup logged for audit

**Dependencies:** None  
**Risks:** Medium - must ensure critical data not deleted

---

### 1.11 Guest Checkout Price Trust Fix 🔴 **CRITICAL SECURITY**

**Priority:** P0 - Security Vulnerability  
**Effort:** 1 day  
**Owner:** Backend

**Current Issue:** `guest-checkout/index.ts` line 453 trusts client-provided `unit_price_cents`:
```typescript
const unitPrice = typeof item.unit_price_cents === "number" ? item.unit_price_cents : tier.price_cents;
```

**Implementation Steps:**

1. **Fix Price Validation**
   - File: `supabase/functions/guest-checkout/index.ts`
   - **Remove** client price from calculation
   - **Always** use `tier.price_cents` from database
   - Log mismatch if client sends different price (for monitoring)

2. **Update Type Definition**
   - File: `supabase/functions/guest-checkout/index.ts`
   - Remove `unit_price_cents` from `GuestCheckoutRequest` interface (or mark as deprecated)
   - Document that client price is ignored

3. **Add Price Mismatch Alerting**
   - Log when client sends manipulated price
   - Alert if mismatch detected (potential fraud)

**Files to Modify:**
- `supabase/functions/guest-checkout/index.ts` (line 453 - always use tier.price_cents)
- `src/lib/ticketApi.ts` (remove unit_price_cents from request, if present)

**Testing:**
- [ ] Client cannot manipulate prices
- [ ] Server always uses DB price
- [ ] Price mismatches logged
- [ ] Checkout works correctly

**Acceptance Criteria:**
- [ ] Prices always from database
- [ ] Client price manipulation impossible
- [ ] Mismatches detected and logged

**Dependencies:** None  
**Risks:** None - security fix

---

### 1.12 Health Checks & Status Endpoints 🟡 **HIGH PRIORITY**

**Priority:** P1 - Operational Readiness  
**Effort:** 1 week  
**Owner:** Backend + DevOps

**Implementation Steps:**

1. **Create Health Check Edge Function**
   - File: `supabase/functions/health-check/index.ts`
   - Check:
     - Database connectivity
     - Stripe API connectivity (optional)
     - Mux API connectivity (optional)
     - PostHog connectivity (optional)
   - Return status: `healthy`, `degraded`, `unhealthy`

2. **Create Status Page Endpoint**
   - File: `supabase/functions/status/index.ts`
   - Public endpoint for status page
   - Shows:
     - System status
     - Recent incidents
     - Service availability

3. **Set Up Uptime Monitoring**
   - Configure UptimeRobot / Better Stack / Pingdom
   - Monitor health check endpoint
   - Alert on downtime

4. **Add Health Check to CI/CD**
   - Run health check after deployment
   - Fail deployment if health check fails

**Files to Create:**
- `supabase/functions/health-check/index.ts`
- `supabase/functions/status/index.ts`

**Testing:**
- [ ] Health check returns correct status
- [ ] Status page accessible
- [ ] Uptime monitoring configured
- [ ] Alerts work correctly

**Acceptance Criteria:**
- [ ] Health check endpoint functional
- [ ] Status page available
- [ ] Uptime monitoring active
- [ ] Alerts configured

**Dependencies:** None  
**Risks:** Low

---

### 1.13 Push Notification Wiring Verification 🟡 **HIGH PRIORITY**

**Priority:** P1 - User Experience  
**Effort:** 1 week  
**Owner:** Backend + Frontend

**Current State:** Push notification infrastructure exists (`user_devices` table, `send-push-notification` function) but needs verification and completion.

**Implementation Steps:**

1. **Verify Device Registration**
   - File: `src/hooks/usePushNotifications.tsx` (already exists)
   - Ensure tokens stored in `user_devices` table
   - Test token refresh on app restart

2. **Link Notifications to Push**
   - File: `supabase/migrations/20250114_wire_notifications_to_push.sql`
   - Create trigger: When notification created, call `send-push-notification`
   - Only for specific notification types:
     - Ticket purchase ✅
     - New message ✅
     - Follows/likes/comments (optional, batched)

3. **Create Notification Preferences Table**
   - File: `supabase/migrations/20250114_create_notification_preferences.sql`
   - Table: `public.notification_preferences`
   - Columns:
     - `user_id` UUID PRIMARY KEY
     - `push_messages` BOOLEAN DEFAULT true
     - `push_tickets` BOOLEAN DEFAULT true
     - `push_social` BOOLEAN DEFAULT true
     - `push_marketing` BOOLEAN DEFAULT false
     - `updated_at` TIMESTAMPTZ

4. **Add Preferences UI**
   - File: `src/components/NotificationPreferences.tsx` (new)
   - Allow users to toggle push notification types
   - Link from profile settings

5. **Test End-to-End**
   - Purchase ticket → verify push notification sent
   - Receive message → verify push notification sent
   - Test on iOS and Android

**Files to Create:**
- `supabase/migrations/20250114_wire_notifications_to_push.sql`
- `supabase/migrations/20250114_create_notification_preferences.sql`
- `src/components/NotificationPreferences.tsx`

**Files to Modify:**
- `supabase/migrations/20250601000000_notification_triggers.sql` (add push trigger)
- `src/pages/new-design/ProfilePage.tsx` (add preferences link)

**Testing:**
- [ ] Device tokens registered correctly
- [ ] Push notifications sent on ticket purchase
- [ ] Push notifications sent on new messages
- [ ] Preferences respected
- [ ] Works on iOS and Android

**Acceptance Criteria:**
- [ ] Push notifications wired to notifications table
- [ ] Users can manage preferences
- [ ] End-to-end flow works
- [ ] Tested on both platforms

**Dependencies:** Push notification infrastructure (exists)  
**Risks:** Low - infrastructure already in place

---

### 1.14 Support Contact & Policy Integration 🟢 **MEDIUM PRIORITY**

**Priority:** P2 - User Experience  
**Effort:** 1 week  
**Owner:** Frontend + Product

**Implementation Steps:**

1. **Add Support Contact UI**
   - File: `src/components/SupportContact.tsx` (new)
   - "Contact Support" button/link
   - Email form or direct email link
   - Available from:
     - Footer
     - Profile page
     - Help/FAQ page

2. **Link Reporting to Community Guidelines**
   - File: `src/components/ReportContentDialog.tsx`
   - Add link to Community Guidelines
   - Show "Why was this action taken?" copy
   - Reference policy violations

3. **Add Appeal Flow**
   - File: `src/components/AppealBanDialog.tsx` (new)
   - Simple form to appeal bans/content removal
   - Sends email to support with context
   - Shows expected response time

4. **Update Policy Pages**
   - File: `src/pages/PrivacyPolicy.tsx`
   - Add support contact information
   - Add response time expectations
   - Link to consent settings

**Files to Create:**
- `src/components/SupportContact.tsx`
- `src/components/AppealBanDialog.tsx`

**Files to Modify:**
- `src/components/ReportContentDialog.tsx` (add policy links)
- `src/pages/PrivacyPolicy.tsx` (add contact info)
- `src/pages/CommunityGuidelines.tsx` (add appeal info)

**Testing:**
- [ ] Support contact accessible
- [ ] Reporting links to guidelines
- [ ] Appeal flow works
- [ ] Policy pages updated

**Acceptance Criteria:**
- [ ] Support contact visible and accessible
- [ ] Reporting tied to policies
- [ ] Appeal mechanism available
- [ ] Policies include contact info

**Dependencies:** Community Guidelines (1.1), Content Reporting (1.4)  
**Risks:** Low

---

## Phase 2: Post-Launch Improvements (Weeks 5-12)

### 2.1 CI/CD Pipeline Setup 🟡 **HIGH PRIORITY**

**Priority:** P1 - Deployment Safety  
**Effort:** 1-2 weeks  
**Owner:** DevOps + Engineering

**Implementation Steps:**

1. **Create GitHub Actions Workflow**
   - File: `.github/workflows/ci.yml` (new)
   - Run on PR:
     - Type-check (TypeScript)
     - Lint (ESLint)
     - Tests (if present)
     - Supabase migration dry-run

2. **Create Staging Environment**
   - Separate Supabase project for staging
   - Stripe test keys
   - Environment variables configured

3. **Create Deployment Playbook**
   - File: `docs/DEPLOYMENT_PLAYBOOK.md` (new)
   - Order: migrations → Edge functions → frontend
   - Rollback steps if migration fails
   - Rollback steps if function fails

4. **Add Feature Flags (Optional)**
   - File: `src/lib/featureFlags.ts` (new)
   - Use for risky features:
     - Refund automation
     - Ticket transfers
     - New payment flows
   - Allow gradual rollout

**Files to Create:**
- `.github/workflows/ci.yml`
- `docs/DEPLOYMENT_PLAYBOOK.md`
- `src/lib/featureFlags.ts` (optional)

**Testing:**
- [ ] CI runs on every PR
- [ ] Type-check passes
- [ ] Lint passes
- [ ] Migrations validated
- [ ] Staging environment works

**Acceptance Criteria:**
- [ ] CI pipeline functional
- [ ] Staging environment configured
- [ ] Deployment playbook documented
- [ ] Rollback procedures tested

**Dependencies:** None  
**Risks:** Low

---

### 2.2 Admin Support Tools 🟡 **HIGH PRIORITY**

**Priority:** P1 - Operational Efficiency  
**Effort:** 2 weeks  
**Owner:** Backend + Frontend

**Implementation Steps:**

1. **Create Admin Role System**
   - File: `supabase/migrations/20250120_create_admin_roles.sql`
   - Add `is_admin` BOOLEAN to `users.user_profiles`
   - Or create `admin_users` table
   - RLS policies for admin access

2. **Create Admin Support Dashboard**
   - File: `src/pages/admin/SupportTools.tsx` (new)
   - Tools:
     - Manually issue ticket
     - Void ticket
     - Resend confirmation emails
     - Mark user as verified/restricted
     - View user details

3. **Create Admin Audit Log**
   - File: `supabase/migrations/20250120_create_admin_audit_log.sql`
   - Table: `public.admin_audit_log`
   - Columns:
     - `id` UUID PRIMARY KEY
     - `admin_user_id` UUID
     - `action_type` TEXT
     - `target_type` TEXT ('user' | 'ticket' | 'order' | 'event')
     - `target_id` UUID
     - `metadata` JSONB
     - `created_at` TIMESTAMPTZ

4. **Add Audit Logging to Admin Actions**
   - Log all admin actions to audit log
   - Include before/after state
   - Track who made changes

**Files to Create:**
- `supabase/migrations/20250120_create_admin_roles.sql`
- `supabase/migrations/20250120_create_admin_audit_log.sql`
- `src/pages/admin/SupportTools.tsx`

**Files to Modify:**
- `src/App.tsx` (add admin routes)
- Admin action functions (add audit logging)

**Testing:**
- [ ] Admin role system works
- [ ] Support tools functional
- [ ] Audit log captures all actions
- [ ] RLS policies enforce admin-only access

**Acceptance Criteria:**
- [ ] Admin dashboard functional
- [ ] Support tools work correctly
- [ ] All admin actions logged
- [ ] Audit trail complete

**Dependencies:** None  
**Risks:** Medium - permission system complexity

---

### 2.3 Complete Refund Automation 🟡 **HIGH PRIORITY**

**Priority:** P1 - Support Efficiency  
**Effort:** 2-3 weeks  
**Owner:** Backend + Frontend

**Current State:** Partially automated (organizer approval required)

**Implementation Steps:**

1. **Enhance Refund Request Flow**
   - File: `src/pages/new-design/TicketsPage.tsx` (add refund request button)
   - File: `src/components/RefundRequestDialog.tsx` (new)
   - Allow customers to request refunds
   - Show refund policy (time window, fees)

2. **Auto-Approve Logic**
   - File: `supabase/migrations/20251111000011_auto_approve_logic.sql` (may exist)
   - Check if auto-approve enabled for event
   - Check if within refund window
   - Auto-approve if conditions met

3. **Customer Self-Service Refund**
   - File: `supabase/functions/request-refund/index.ts` (may exist as `submit-refund-request`)
   - Allow customers to initiate refunds
   - Check eligibility
   - Create refund request
   - Auto-approve if eligible

4. **Refund Status Tracking**
   - File: `src/components/RefundStatusBadge.tsx` (new)
   - Show refund status on tickets
   - Show refund progress

**Files to Create:**
- `src/components/RefundRequestDialog.tsx`
- `src/components/RefundStatusBadge.tsx`

**Files to Modify:**
- `src/pages/new-design/TicketsPage.tsx` (add refund UI)
- `supabase/functions/submit-refund-request/index.ts` (enhance)

**Testing:**
- [ ] Customers can request refunds
- [ ] Auto-approve works correctly
- [ ] Refund processing automated
- [ ] Status updates visible to customer

**Acceptance Criteria:**
- [ ] Customers can self-service refunds
- [ ] Auto-approve works for eligible refunds
- [ ] Refund status visible to customers
- [ ] Support burden reduced

**Dependencies:** Refund system (already exists)  
**Risks:** Medium - complex business logic

---

### 2.4 Ticket Transfer System 🟢 **MEDIUM PRIORITY**

**Priority:** P2 - User Convenience  
**Effort:** 2 weeks  
**Owner:** Backend + Frontend

**Implementation Steps:**

1. **Create Ticket Transfer Table**
   - File: `supabase/migrations/20250115_create_ticket_transfers.sql`
   - Table: `ticketing.ticket_transfers`
   - Columns:
     - `id` UUID PRIMARY KEY
     - `ticket_id` UUID REFERENCES ticketing.tickets(id)
     - `from_user_id` UUID (original owner)
     - `to_user_id` UUID (new owner)
     - `status` TEXT ('pending' | 'completed' | 'cancelled')
     - `transfer_code` TEXT (for email link)
     - `expires_at` TIMESTAMPTZ
     - `completed_at` TIMESTAMPTZ

2. **Create Transfer Edge Function**
   - File: `supabase/functions/transfer-ticket/index.ts`
   - Validates ticket ownership
   - Checks if ticket is transferable (not redeemed, not refunded)
   - Creates transfer record
   - Sends email to recipient
   - Updates ticket owner on acceptance

3. **Add Transfer UI**
   - File: `src/components/TransferTicketDialog.tsx` (new)
   - Trigger: "Transfer" button on ticket
   - Form: Recipient email
   - Shows transfer status

4. **Add Transfer Acceptance**
   - File: `src/pages/accept-transfer/[code].tsx` (new)
   - Accepts transfer via email link
   - Updates ticket ownership
   - Sends confirmation

**Files to Create:**
- `supabase/migrations/20250115_create_ticket_transfers.sql`
- `supabase/functions/transfer-ticket/index.ts`
- `src/components/TransferTicketDialog.tsx`
- `src/pages/accept-transfer/[code].tsx`

**Files to Modify:**
- `src/pages/new-design/TicketsPage.tsx` (add transfer button)
- `src/App.tsx` (add transfer acceptance route)

**Testing:**
- [ ] Users can initiate transfers
- [ ] Transfer emails sent correctly
- [ ] Recipients can accept transfers
- [ ] Ticket ownership updated
- [ ] Cannot transfer redeemed/refunded tickets

**Acceptance Criteria:**
- [ ] Ticket transfer flow works end-to-end
- [ ] Transfers are secure (email verification)
- [ ] Transfer status visible to both parties
- [ ] Edge cases handled (expired transfers, etc.)

**Dependencies:** Email system  
**Risks:** Medium - email delivery reliability

---

### 2.5 OAuth Authentication (Google/Apple) 🟢 **MEDIUM PRIORITY**

**Priority:** P2 - Conversion Improvement  
**Effort:** 1-2 weeks  
**Owner:** Backend + Frontend

**Implementation Steps:**

1. **Configure Supabase Auth Providers**
   - Enable Google OAuth in Supabase Dashboard
   - Enable Apple OAuth in Supabase Dashboard
   - Configure redirect URLs

2. **Add OAuth Buttons to Auth UI**
   - File: `src/components/auth/SmartAuthModal.tsx`
   - Add "Sign in with Google" button
   - Add "Sign in with Apple" button
   - Handle OAuth callbacks

3. **Handle OAuth Callbacks**
   - File: `src/pages/AuthPage.tsx` or callback handler
   - Process OAuth response
   - Create/update user profile
   - Handle first-time OAuth users

4. **Test OAuth Flow**
   - Test Google OAuth
   - Test Apple OAuth
   - Test error cases

**Files to Modify:**
- `src/components/auth/SmartAuthModal.tsx` (add OAuth buttons)
- `src/pages/AuthPage.tsx` (handle callbacks)

**Testing:**
- [ ] Google OAuth works
- [ ] Apple OAuth works
- [ ] New users created correctly
- [ ] Existing users linked correctly
- [ ] Error handling works

**Acceptance Criteria:**
- [ ] Users can sign in with Google
- [ ] Users can sign in with Apple
- [ ] OAuth flow seamless
- [ ] User profiles created/updated correctly

**Dependencies:** Supabase Auth configuration  
**Risks:** Low

---

### 2.6 Apple/Google Wallet Integration 🟢 **MEDIUM PRIORITY**

**Priority:** P2 - Mobile UX  
**Effort:** 2-3 weeks  
**Owner:** Backend + Mobile

**Implementation Steps:**

1. **Apple Wallet Integration**
   - File: `supabase/functions/generate-apple-wallet-pass/index.ts`
   - Generate `.pkpass` file
   - Include ticket details, QR code, event info
   - Return pass file

2. **Google Wallet Integration**
   - File: `supabase/functions/generate-google-wallet-object/index.ts`
   - Create Google Wallet object
   - Include ticket details, QR code
   - Return add-to-wallet link

3. **Add Wallet Buttons to Tickets**
   - File: `src/pages/new-design/TicketsPage.tsx`
   - Add "Add to Apple Wallet" button (iOS)
   - Add "Add to Google Wallet" button (Android)
   - Detect platform and show appropriate button

4. **Test Wallet Integration**
   - Test on iOS device
   - Test on Android device
   - Verify QR codes work from wallet

**Files to Create:**
- `supabase/functions/generate-apple-wallet-pass/index.ts`
- `supabase/functions/generate-google-wallet-object/index.ts`

**Files to Modify:**
- `src/pages/new-design/TicketsPage.tsx` (add wallet buttons)

**Testing:**
- [ ] Apple Wallet pass generated correctly
- [ ] Google Wallet object created correctly
- [ ] Passes add to wallet successfully
- [ ] QR codes scan correctly from wallet
- [ ] Passes update when ticket status changes

**Acceptance Criteria:**
- [ ] iOS users can add tickets to Apple Wallet
- [ ] Android users can add tickets to Google Wallet
- [ ] Wallet passes work correctly
- [ ] QR codes scan from wallet

**Dependencies:** Apple/Google Wallet API setup  
**Risks:** Medium - API complexity, platform-specific requirements

---

### 2.7 Content Moderation Dashboard 🟡 **HIGH PRIORITY**

**Priority:** P1 - Scale Requirement  
**Effort:** 3-4 weeks  
**Owner:** Backend + Frontend

**Implementation Steps:**

1. **Create Admin Role System**
   - File: `supabase/migrations/20250120_create_admin_roles.sql`
   - Add `is_admin` flag to `user_profiles`
   - Or create `admin_users` table
   - RLS policies for admin access

2. **Create Moderation Dashboard**
   - File: `src/pages/admin/ModerationDashboard.tsx` (new)
   - Lists reported content
   - Shows content preview
   - Allows actions: delete, warn, dismiss
   - Shows user history

3. **Add Moderation Actions**
   - File: `supabase/functions/moderate-content/index.ts`
   - Actions: delete, warn, suspend user
   - Updates content status
   - Sends notifications
   - Logs moderation actions

4. **Add Automated Moderation**
   - File: `supabase/functions/auto-moderate-content/index.ts` (optional)
   - Word filter for profanity
   - Spam detection
   - Auto-flag suspicious content

**Files to Create:**
- `supabase/migrations/20250120_create_admin_roles.sql`
- `src/pages/admin/ModerationDashboard.tsx`
- `supabase/functions/moderate-content/index.ts`

**Files to Modify:**
- `src/App.tsx` (add admin routes)
- RLS policies (add admin access)

**Testing:**
- [ ] Admins can access dashboard
- [ ] Reported content visible
- [ ] Moderation actions work
- [ ] User notifications sent
- [ ] Audit trail maintained

**Acceptance Criteria:**
- [ ] Admin dashboard functional
- [ ] Moderation actions work correctly
- [ ] Audit trail complete
- [ ] Automated moderation (optional) works

**Dependencies:** Admin role system, content reporting (Phase 1)  
**Risks:** Medium - complex permission system

---

### 2.8 User Blocking System 🟢 **MEDIUM PRIORITY**

**Priority:** P2 - User Safety  
**Effort:** 1-2 weeks  
**Owner:** Backend + Frontend

**Implementation Steps:**

1. **Create User Blocks Table**
   - File: `supabase/migrations/20250125_create_user_blocks.sql`
   - Table: `public.user_blocks`
   - Columns:
     - `blocker_user_id` UUID (who blocked)
     - `blocked_user_id` UUID (who is blocked)
     - `created_at` TIMESTAMPTZ
     - PRIMARY KEY (blocker_user_id, blocked_user_id)

2. **Add Blocking Logic**
   - File: `supabase/functions/block-user/index.ts`
   - Creates block record
   - Hides blocked user's content from blocker
   - Prevents messaging between users

3. **Add Block UI**
   - File: `src/components/BlockUserDialog.tsx` (new)
   - Trigger: "Block" button on user profiles
   - Confirmation dialog
   - Shows what blocking does

4. **Filter Blocked Content**
   - File: `supabase/functions/home-feed/index.ts` (modify)
   - Exclude posts from blocked users
   - Exclude comments from blocked users
   - Hide blocked users in search

**Files to Create:**
- `supabase/migrations/20250125_create_user_blocks.sql`
- `supabase/functions/block-user/index.ts`
- `src/components/BlockUserDialog.tsx`

**Files to Modify:**
- `src/pages/new-design/ProfilePage.tsx` (add block button)
- `supabase/functions/home-feed/index.ts` (filter blocked users)

**Testing:**
- [ ] Users can block other users
- [ ] Blocked users' content hidden
- [ ] Blocked users cannot message
- [ ] Block list visible to user
- [ ] Unblock functionality works

**Acceptance Criteria:**
- [ ] Blocking works correctly
- [ ] Blocked content filtered
- [ ] Users can unblock
- [ ] Block list manageable

**Dependencies:** None  
**Risks:** Low

---

### 2.9 Rate Limiting for Posts/Messages 🟢 **MEDIUM PRIORITY**

**Priority:** P2 - Spam Prevention  
**Effort:** 1 week  
**Owner:** Backend

**Implementation Steps:**

1. **Add Rate Limiting to Post Creation**
   - File: `supabase/functions/posts-create/index.ts`
   - Use `_shared/rate-limiter.ts`
   - Limit: 10 posts per hour per user
   - Return error if limit exceeded

2. **Add Rate Limiting to Messages**
   - File: `supabase/functions/messaging-queue/index.ts` (or message sending function)
   - Limit: 20 messages per minute per user
   - Return error if limit exceeded

3. **Add Rate Limiting to Comments**
   - File: `supabase/functions/comments-add/index.ts`
   - Limit: 30 comments per hour per user
   - Return error if limit exceeded

4. **Update Rate Limit Counters**
   - Use existing `rate_limit_counters` table
   - Track per-user, per-action limits

**Files to Modify:**
- `supabase/functions/posts-create/index.ts`
- `supabase/functions/comments-add/index.ts`
- Message sending functions

**Testing:**
- [ ] Rate limits enforced
- [ ] Error messages clear
- [ ] Limits reset after time window
- [ ] Different limits for different actions

**Acceptance Criteria:**
- [ ] Post rate limiting works
- [ ] Message rate limiting works
- [ ] Comment rate limiting works
- [ ] Limits prevent spam

**Dependencies:** Rate limiter utility (exists)  
**Risks:** Low

---

### 2.10 Recurring Events Support 🟢 **MEDIUM PRIORITY**

---

### 2.11 Database Index Review & Optimization 🟢 **MEDIUM PRIORITY**

**Priority:** P2 - Performance  
**Effort:** 1 week  
**Owner:** Backend

**Implementation Steps:**

1. **Review Feed Query Indexes**
   - Analyze feed query performance
   - Add indexes on:
     - `event_posts.created_at`
     - `event_posts.event_id`
     - `event_posts.user_id`

2. **Review Messaging Query Indexes**
   - Analyze message query performance
   - Add indexes on:
     - `direct_messages.conversation_id`
     - `direct_messages.created_at`
     - `direct_messages.sender_user_id`

3. **Review Notifications Query Indexes**
   - Analyze notification query performance
   - Add indexes on:
     - `notifications.user_id`
     - `notifications.created_at`
     - `notifications.read_at`

4. **Set Up Periodic Maintenance**
   - File: `supabase/migrations/20250125_setup_vacuum_maintenance.sql`
   - Schedule VACUUM ANALYZE
   - Monitor index usage

**Files to Create:**
- `supabase/migrations/20250125_add_performance_indexes.sql`
- `supabase/migrations/20250125_setup_vacuum_maintenance.sql`

**Testing:**
- [ ] Feed queries performant
- [ ] Message queries performant
- [ ] Notification queries performant
- [ ] Indexes used correctly

**Acceptance Criteria:**
- [ ] All critical queries indexed
- [ ] Query performance acceptable
- [ ] Maintenance scheduled

**Dependencies:** None  
**Risks:** Low

---

### 2.12 Background Jobs Formalization 🟢 **MEDIUM PRIORITY**

**Priority:** P2 - Scalability  
**Effort:** 1 week  
**Owner:** Backend

**Implementation Steps:**

1. **Document Background Job Strategy**
   - File: `docs/BACKGROUND_JOBS.md` (new)
   - Document:
     - Which operations should be background jobs
     - Queue table structure
     - Worker pattern

2. **Ensure Heavy Operations Use Queues**
   - Data export → queue
   - Analytics aggregation → queue
   - Email batches → queue
   - Large notifications → queue

3. **Set Up Worker Monitoring**
   - Monitor queue depths
   - Alert on stuck jobs
   - Track job completion rates

**Files to Create:**
- `docs/BACKGROUND_JOBS.md`

**Files to Modify:**
- Heavy operation functions (ensure they use queues)

**Testing:**
- [ ] Heavy operations use queues
- [ ] Jobs process correctly
- [ ] Monitoring works
- [ ] Alerts configured

**Acceptance Criteria:**
- [ ] Background job strategy documented
- [ ] Heavy operations offloaded
- [ ] Monitoring in place

**Dependencies:** Queue infrastructure (exists)  
**Risks:** Low

---

### 2.13 Region-Aware Analytics & Cookies 🟢 **MEDIUM PRIORITY**

**Priority:** P2 - Compliance  
**Effort:** 1-2 weeks  
**Owner:** Frontend + Backend

**Implementation Steps:**

1. **Enhance Region Detection**
   - File: `src/lib/region-detection.ts` (from 1.8)
   - Improve IP geolocation
   - Allow user override

2. **Region-Aware Analytics**
   - File: `src/lib/posthog.ts`
   - Disable PostHog for EU users without consent
   - Use different PostHog projects per region (optional)

3. **Region-Aware Cookie Consent**
   - File: `src/components/CookieConsentBanner.tsx` (from 1.9)
   - Show banner for EU/EEA users
   - Different copy for US users
   - Respect regional privacy laws

4. **Update Privacy Policy**
   - File: `src/pages/PrivacyPolicy.tsx`
   - Region-specific sections
   - GDPR section for EU
   - CCPA section for California

**Files to Modify:**
- `src/lib/region-detection.ts` (enhance)
- `src/lib/posthog.ts` (region-aware)
- `src/components/CookieConsentBanner.tsx` (region-aware)
- `src/pages/PrivacyPolicy.tsx` (region-specific)

**Testing:**
- [ ] Region detected correctly
- [ ] Analytics respect region
- [ ] Cookie consent region-aware
- [ ] Privacy policy region-specific

**Acceptance Criteria:**
- [ ] Region-aware behavior works
- [ ] Compliance maintained per region
- [ ] User experience consistent

**Dependencies:** Age & Region Compliance (1.8), Cookie Consent (1.9)  
**Risks:** Medium - legal complexity

---

### 2.14 Operational Metrics & Alerting 🟡 **HIGH PRIORITY**

**Priority:** P1 - Operational Readiness  
**Effort:** 2 weeks  
**Owner:** Backend + DevOps

**Implementation Steps:**

1. **Create Metrics Collection Function**
   - File: `supabase/functions/collect-operational-metrics/index.ts`
   - Collect:
     - Webhook queue backlog
     - Stripe webhook failures (last 10 min)
     - Ticket redemptions (during event start)
     - Payment success rate
     - API latency (p95, p99)

2. **Set Up Business-Level Alerts**
   - Alert on:
     - Webhook queue backlog > N
     - Stripe webhook failures > threshold
     - Ticket redemptions suddenly zero during event
     - Payment success rate drops
     - API latency spikes

3. **Push Metrics to Monitoring**
   - Send to Sentry as custom events
   - Or send to Slack/email
   - Or store in metrics table

4. **Create Metrics Dashboard**
   - File: `src/pages/admin/OperationalMetrics.tsx` (new)
   - Show key metrics
   - Historical trends
   - Alert status

**Files to Create:**
- `supabase/functions/collect-operational-metrics/index.ts`
- `src/pages/admin/OperationalMetrics.tsx`

**Files to Modify:**
- Sentry configuration (add custom events)
- Alerting configuration

**Testing:**
- [ ] Metrics collected correctly
- [ ] Alerts trigger correctly
- [ ] Dashboard shows metrics
- [ ] Historical data available

**Acceptance Criteria:**
- [ ] Operational metrics collected
- [ ] Business-level alerts configured
- [ ] Dashboard functional
- [ ] Alerts actionable

**Dependencies:** Health Checks (1.12), Sentry (1.3)  
**Risks:** Low

**Priority:** P2 - Organizer Efficiency  
**Effort:** 3-4 weeks  
**Owner:** Backend + Frontend

**Implementation Steps:**

1. **Add Recurrence Fields to Events**
   - File: `supabase/migrations/20250130_add_event_recurrence.sql`
   - Add columns to `events.events`:
     - `recurrence_pattern` TEXT ('none' | 'daily' | 'weekly' | 'monthly' | 'custom')
     - `recurrence_end_date` TIMESTAMPTZ
     - `recurrence_count` INTEGER
     - `recurrence_days_of_week` INTEGER[] (for weekly)
     - `recurrence_day_of_month` INTEGER (for monthly)

2. **Create Recurring Event Instances**
   - File: `supabase/functions/create-recurring-instances/index.ts`
   - Generate event instances based on pattern
   - Create `event_instances` table (if needed)
   - Link instances to parent event

3. **Update Event Creation UI**
   - File: `src/components/CreateEventFlow.tsx`
   - Add recurrence options
   - Show preview of instances
   - Allow editing individual instances

4. **Handle Instance Management**
   - Allow editing individual instances
   - Allow canceling individual instances
   - Show instance list in event management

**Files to Create:**
- `supabase/migrations/20250130_add_event_recurrence.sql`
- `supabase/functions/create-recurring-instances/index.ts`

**Files to Modify:**
- `src/components/CreateEventFlow.tsx` (add recurrence UI)
- Event management components

**Testing:**
- [ ] Recurring events created correctly
- [ ] Instances generated properly
- [ ] Individual instances editable
- [ ] Cancellation works for instances

**Acceptance Criteria:**
- [ ] Recurring events work correctly
- [ ] Instances manageable
- [ ] UI intuitive
- [ ] Edge cases handled

**Dependencies:** None  
**Risks:** Medium - complex recurrence logic

---

## Phase 3: Strategic Enhancements (Months 4-6)

### 3.1 Predictive Analytics 🟢 **MEDIUM PRIORITY**

**Priority:** P3 - Differentiator  
**Effort:** 4-6 weeks  
**Owner:** Data Science + Backend

**Implementation Steps:**

1. **Create ML Models**
   - Sales forecasting model
   - Engagement prediction model
   - Churn prediction model

2. **Create Analytics RPCs**
   - File: `supabase/migrations/20250201_add_predictive_analytics.sql`
   - Functions: `predict_event_sales()`, `predict_engagement()`

3. **Add Predictive Dashboard**
   - File: `src/pages/organizer/PredictiveAnalyticsPage.tsx`
   - Show sales forecasts
   - Show engagement predictions
   - Show recommendations

**Files to Create:**
- `supabase/migrations/20250201_add_predictive_analytics.sql`
- `src/pages/organizer/PredictiveAnalyticsPage.tsx`

**Dependencies:** Analytics data, ML infrastructure  
**Risks:** High - complex ML implementation

---

### 3.2 Multi-Currency Support 🟢 **MEDIUM PRIORITY**

**Priority:** P3 - International Expansion  
**Effort:** 2-3 weeks  
**Owner:** Backend + Frontend

**Implementation Steps:**

1. **Add Currency to Events**
   - Add `currency` column to `events.events`
   - Default: 'USD'

2. **Update Pricing Logic**
   - Convert prices based on currency
   - Use Stripe multi-currency

3. **Update UI**
   - Show prices in event currency
   - Currency selector in event creation

**Dependencies:** Stripe multi-currency setup  
**Risks:** Medium - currency conversion complexity

---

### 3.3 Event Templates 🟢 **MEDIUM PRIORITY**

**Priority:** P3 - Organizer Efficiency  
**Effort:** 2-3 weeks  
**Owner:** Backend + Frontend

**Implementation Steps:**

1. **Create Templates Table**
   - Table: `event_templates`
   - Store template configurations

2. **Add Template Selection**
   - UI for selecting templates
   - Pre-fill event creation form

3. **Template Library**
   - Pre-built templates for common event types

**Dependencies:** None  
**Risks:** Low

---

## Implementation Timeline

### Week 1-2: Critical Legal & Compliance
- Legal review of policies
- Create Community Guidelines
- Begin GDPR implementation (data export/deletion)
- Age & region compliance (age gate, region detection)
- Cookie & tracking consent banner

### Week 3-4: Security & Compliance Completion
- Complete data export
- Complete account deletion
- **Guest checkout price trust fix (CRITICAL SECURITY - 1 day)**
- Data retention policy implementation
- Integrate Sentry error monitoring

### Week 5-6: Content Moderation & Operations
- Complete content reporting
- Bundle optimization
- Stripe dispute handling
- Fee & tax transparency
- Health checks & status endpoints
- Webhook retry automation

### Week 7-8: Notifications & Support
- Push notification wiring verification
- Notification preferences
- Support contact & policy integration
- CI/CD pipeline setup
- Admin support tools

### Week 9-12: Post-Launch Improvements
- Refund automation
- Ticket transfers
- OAuth authentication
- Wallet integration
- Moderation dashboard
- User blocking
- Rate limiting
- Database index optimization
- Background jobs formalization

### Month 4-6: Strategic Features & Polish
- Predictive analytics
- Multi-currency
- Event templates
- Region-aware analytics & cookies
- Operational metrics & alerting
- Other enhancements

---

## Risk Mitigation

**High-Risk Items:**
1. **GDPR Implementation** - Complex, legal requirements
   - **Mitigation:** Start early, involve legal counsel
2. **Content Moderation** - Complex permission system
   - **Mitigation:** Start with basic reporting, iterate
3. **Wallet Integration** - Platform-specific complexity
   - **Mitigation:** Start with one platform, expand

**Dependencies:**
- Legal review blocks policy finalization
- Admin role system blocks moderation dashboard
- Email system required for transfers

---

## Success Metrics

**Phase 1 (Pre-Launch):**
- [ ] All policies legally reviewed
- [ ] GDPR compliance verified
- [ ] Error monitoring active
- [ ] Content reporting functional

**Phase 2 (Post-Launch):**
- [ ] Support tickets reduced by 50%
- [ ] User satisfaction improved
- [ ] Platform safety improved

**Phase 3 (Strategic):**
- [ ] Organizer efficiency improved
- [ ] International expansion enabled
- [ ] Competitive differentiation achieved

---

**Document Status:** Planning Complete  
**Next Step:** Begin Phase 1 implementation  
**Owner:** Engineering + Product + Legal

