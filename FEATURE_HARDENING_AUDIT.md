# 🔒 Feature Hardening Audit - Detailed Review

**Date:** January 28, 2025  
**Status:** 🔍 In Progress - Phase 2  
**Scope:** Comprehensive security, error handling, and reliability review

---

## 📋 Executive Summary

This document provides a detailed audit of 5 critical features that need hardening:
1. Stripe Integration
2. QR Code Generation & Validation
3. Email Service
4. Analytics Dashboard
5. Push Notifications

Each feature is analyzed for:
- **Security vulnerabilities**
- **Error handling gaps**
- **Performance bottlenecks**
- **Reliability issues**
- **Testing coverage**
- **Rollout strategies**
- **SLIs/SLOs**

---

## 🎯 Cross-Cutting Patterns & Shared Primitives

### Resilience Primitives (Shared Library)

To avoid reinventing retry/queue/rate-limit logic per feature, establish shared primitives:

#### 1. **Shared Retry Helper**
**Location:** `supabase/functions/_shared/retry-utils.ts`

```typescript
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    operationName: string;
    maxRetries?: number;
    backoffSchedule?: number[]; // [1000, 5000, 30000] ms
    retryable?: (error: any) => boolean;
  }
): Promise<T>
```

**Used by:** Email sends, webhook processing, push notifications

---

#### 2. **Shared Queue Abstraction**
**Location:** `supabase/functions/_shared/queue-utils.ts`

```typescript
export async function enqueueWithDLQ<T>(
  queueTable: string,
  item: T,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    retrySchedule?: number[];
  }
): Promise<UUID>
```

**Used by:** Email queue, webhook retry queue

---

#### 3. **Shared Rate Limiter**
**Location:** `supabase/functions/_shared/rate-limiter.ts`

```typescript
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }>
```

**Used by:** Checkout endpoints, email sends, push notifications

---

#### 4. **Standard Logging Helper**
**Location:** `supabase/functions/_shared/logger.ts`

```typescript
export function logWithContext(
  level: 'info' | 'warn' | 'error',
  message: string,
  context: {
    feature: string;
    requestId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  }
)
```

**Used by:** All Edge Functions

---

### SLIs/SLOs (Service Level Indicators/Objectives)

| Feature | Primary SLI | SLO Target | Measurement |
|---------|-------------|------------|-------------|
| **Stripe Checkout** | Payment success rate | >99% | (Successful payments / Total attempts) |
| **QR Code Validation** | Scan success rate | >99.9% | (Valid scans / Total scans) |
| **Email Delivery** | Email send success rate | >98% | (Sent emails / Queued emails) |
| **Analytics Dashboard** | Query success rate | >99% | (Successful queries / Total queries) |
| **Push Notifications** | Delivery success rate | >95% | (Delivered / Attempted sends) |

**Response Time SLOs:**
- Stripe checkout: <2s (90th percentile)
- QR code validation: <500ms (90th percentile)
- Analytics queries: <3s (90th percentile)
- Email queue processing: <30s from queue to send

---

### Ownership & Effort Estimates

| Area | Owner | Phase 2.1 Effort | Notes |
|------|-------|------------------|-------|
| **Stripe DLQ** | Backend | 0.5-1 day | Needs admin UI follow-up (Phase 2.3) |
| **QR HMAC + Atomic** | Backend | 1-1.5 days | Careful rollout needed - backwards compatibility |
| **Email Queue** | Backend | 1-2 days | Ties into existing messaging-queue system |
| **Analytics Error Handling** | Frontend | 0.5-1 day | Mostly UI + error boundaries |
| **Push Retries** | Mobile/BE | 0.5-1 day | Requires device testing |

**Total Phase 2.1 Effort:** 4-6.5 days

---

## 🏦 1. STRIPE INTEGRATION

### Current State

**Files:**
- `supabase/functions/enhanced-checkout/index.ts`
- `supabase/functions/guest-checkout/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/create-payout/index.ts`
- `supabase/functions/_shared/stripe-resilience.ts`
- `supabase/functions/_shared/pricing.ts`

**Grade:** A- (92/100) ✅ **Good** - Most issues already addressed in previous audit

---

### ✅ Strengths

1. **Resilience Layer** ✅
   - Circuit breaker implementation exists
   - Retry logic with exponential backoff
   - Idempotency keys for critical operations

2. **Security** ✅
   - Webhook signature verification
   - RLS policies on payment tables
   - Proper authentication checks

3. **Fee Calculation** ✅
   - Unified pricing in `_shared/pricing.ts`
   - Consistent across all checkout flows

4. **Audit Trail** ✅
   - Payout request logging
   - Payment metadata tracking

---

### ⚠️ Hardening Opportunities

#### 1.1 Webhook Error Recovery (DLQ Pattern)
**Issue:** If webhook processing fails, there's no automatic retry mechanism

**Current:** Webhook failures logged but not retried
**Risk:** Lost payments, orders stuck in 'pending'
**Impact:** Critical - affects revenue and customer experience

**Implementation Pattern:**

**Step 1: Create `webhook_retry_queue` table**
```sql
CREATE TABLE webhook_retry_queue (
  id UUID PRIMARY KEY,
  webhook_type TEXT, -- 'stripe', 'resend'
  webhook_event_id TEXT, -- Stripe event ID
  payload JSONB NOT NULL,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  status TEXT, -- 'pending', 'processing', 'processed', 'dead_letter'
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Step 2: Update `stripe-webhook` function**
```typescript
try {
  // Process webhook...
} catch (error) {
  // Insert into retry queue
  await supabaseService.from('webhook_retry_queue').insert({
    webhook_type: 'stripe',
    webhook_event_id: event.id,
    payload: { type: event.type, data: event.data },
    status: 'pending',
    next_retry_at: calculateRetryTime(0), // Immediate retry
  });
  
  // Return 200 to Stripe (prevent Stripe from retrying)
  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

**Step 3: Create retry processor function**
- Runs via pg_cron every 5 minutes
- Fetches pending webhooks where `next_retry_at <= now()`
- Retries with exponential backoff: 1m, 5m, 30m, 2h, 24h
- Moves to `dead_letter` after max attempts

**Step 4: Admin UI (Phase 2.3)**
- View dead letter queue
- Manual retry capability
- Resolve stuck orders

**Recommendation:**
- Use shared `enqueueWithDLQ` helper (see Cross-Cutting Patterns)
- Log all retry attempts with context (request ID, user ID)
- Alert on dead letter queue size > 10

**Priority:** 🔴 High  
**Effort:** 0.5-1 day  
**Owner:** Backend

---

#### 1.2 Payment Intent Timeout Handling
**Issue:** No explicit timeout handling for Stripe PaymentIntent creation

**Current:** Relies on default fetch timeout
**Risk:** Hanging requests, poor UX, stuck checkout sessions

**Implementation:**
```typescript
// Wrap PaymentIntent creation with timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

try {
  const paymentIntent = await stripeCallWithResilience(
    supabaseClient,
    () => stripe.paymentIntents.create({
      // ... config
    }, { signal: controller.signal }),
    { operationName: 'payment_intent.create' }
  );
  clearTimeout(timeoutId);
} catch (error) {
  clearTimeout(timeoutId);
  
  if (error.name === 'AbortError') {
    // Timeout occurred
    logWithContext('error', 'PaymentIntent creation timeout', {
      feature: 'stripe',
      userId: user.id,
      orderId: order.id,
    });
    
    return {
      error: 'TIMEOUT',
      userMessage: 'We\'re having trouble contacting Stripe. Your card has not been charged. Please try again.',
      retryable: true
    };
  }
  throw error;
}
```

**User-Facing UX:**
- Show: "We're having trouble contacting Stripe. Your card has not been charged. Please try again."
- Include retry button
- Log timeout with full context (user ID, order ID, environment)

**Recommendation:**
- Use shared `retryWithBackoff` helper
- Integrate with existing circuit breaker
- Monitor timeout rate (alert if >1% of requests timeout)

**Priority:** 🟡 Medium  
**Effort:** 0.5 day  
**Owner:** Backend

---

#### 1.3 Partial Payment Scenarios
**Issue:** No handling for partial refunds or chargebacks

**Current:** Full refunds only
**Risk:** Cannot handle partial disputes

**Recommendation:**
- Add partial refund support
- Track refund amounts in audit log
- Update order status accordingly

**Priority:** 🟢 Low

---

#### 1.4 Rate Limiting Enhancement
**Issue:** Current rate limiting only for payouts (3/hour)

**Risk:** Checkout spam could overwhelm system

**Recommendation:**
- Add rate limiting to checkout endpoints
- Per-user: 10 checkouts/hour
- Per-IP: 20 checkouts/hour
- Use Supabase rate limiting or Edge Function throttling

**Priority:** 🟡 Medium

---

#### 1.5 Idempotency Key Validation (Enhanced)
**Issue:** Idempotency keys may not be unique across all operations

**Current:** Uses `order_id:timestamp` format (not globally unique)
**Risk:** Potential duplicate key conflicts, missed duplicate detection

**Implementation Pattern:**

**Step 1: Per-operation-type idempotency keys**
```typescript
// Instead of generic UUID, use structured keys:
const idempotencyKey = `checkout:create:${orderId}:${uuidv4()}`;
// or
const idempotencyKey = `payout:create:${payoutId}:${uuidv4()}`;
```

**Step 2: Database enforcement**
```sql
CREATE TABLE idempotency_keys (
  id UUID PRIMARY KEY,
  operation_type TEXT NOT NULL, -- 'checkout:create', 'payout:create'
  operation_id TEXT NOT NULL,   -- order_id, payout_id
  stripe_idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(operation_type, operation_id) -- Prevent duplicate operations
);
```

**Step 3: Check before Stripe call**
```typescript
// Check if operation already completed
const existing = await supabase
  .from('idempotency_keys')
  .select('stripe_idempotency_key')
  .eq('operation_type', 'checkout:create')
  .eq('operation_id', orderId)
  .maybeSingle();

if (existing) {
  // Operation already completed, return cached result
  return existingResult;
}

// Create new idempotency key
const key = `${operationType}:${operationId}:${uuidv4()}`;
await supabase.from('idempotency_keys').insert({
  operation_type: 'checkout:create',
  operation_id: orderId,
  stripe_idempotency_key: key,
});

// Use key in Stripe API call
```

**Recommendation:**
- Use combination: `operation_type + stable_internal_id + UUID`
- Enforce uniqueness in database per operation type
- Store Stripe response for idempotent retries
- TTL cleanup (remove keys older than 24 hours)

**Priority:** 🟡 Medium (upgraded from Low)  
**Effort:** 0.5 day  
**Owner:** Backend

---

### 🎯 Hardening Checklist

- [ ] Add webhook retry mechanism with DLQ
- [ ] Add explicit timeouts to PaymentIntent creation
- [ ] Implement partial refund support
- [ ] Add rate limiting to checkout endpoints
- [ ] Improve idempotency key generation
- [ ] Add comprehensive error logging with context
- [ ] Add monitoring/alerting for payment failures
- [ ] Create admin dashboard for payment issue resolution

---

## 📱 2. QR CODE GENERATION & VALIDATION

### Current State

**Files:**
- `supabase/functions/scanner-validate/index.ts`
- `supabase/migrations/*gen_qr_code*.sql`
- `src/components/TicketsPage.tsx` (QR generation)
- `src/lib/ticketApi.ts` (validation)

**Grade:** B+ (85/100) 🟡 **Good** - Needs security enhancements

---

### ✅ Strengths

1. **Validation Logic** ✅
   - Checks ticket status (redeemed/valid)
   - Validates event ownership
   - Scanner authorization checks

2. **Logging** ✅
   - Scan logs with results
   - Error tracking

---

### ⚠️ Hardening Opportunities

#### 2.1 QR Code Security
**Issue:** QR codes may not be cryptographically signed

**Current:** Uses ticket ID or UUID
**Risk:** QR codes could be forged or reused

**Recommendation:**
- Implement HMAC signing: `HMAC-SHA256(ticket_id + event_id, SECRET_KEY)`
- Validate signature on scan
- Include expiration timestamp in signed payload

**Priority:** 🔴 High

---

#### 2.2 Replay Attack Prevention
**Issue:** No timestamp validation for QR codes

**Current:** Only checks if ticket is redeemed
**Risk:** Screenshot replay attacks possible

**Recommendation:**
- Add `created_at` timestamp to QR payload
- Reject scans older than 5 minutes (time window)
- Store last scan timestamp to detect rapid re-scans

**Priority:** 🔴 High

---

#### 2.3 Duplicate Scan Detection (Already Fixed ✅)
**Status:** ✅ **IMPLEMENTED** - Atomic redemption with SELECT FOR UPDATE already in place

**Current Implementation:** (See `scanner-validate/index.ts` lines 304-356)
```typescript
// Atomic redemption (prevents double-scan races)
const { data: redeemedRow, error: updErr } = await admin
  .from('tickets')
  .update({ redeemed_at: now(), status: 'redeemed' })
  .eq('id', ticket.id)
  .is('redeemed_at', null)  // Atomic guard - only update if not redeemed
  .select('id, redeemed_at')
  .maybeSingle();

if (!redeemedRow) {
  // Already redeemed - return duplicate error with timestamp
  const { data: fresh } = await admin
    .from('tickets')
    .select('redeemed_at')
    .eq('id', ticket.id)
    .single();
    
  return {
    success: false,
    result: 'duplicate',
    message: `Already scanned at ${new Date(fresh.redeemed_at).toLocaleString()}`,
  };
}
```

**Enhancement Opportunity:**
- Consider adding `SELECT FOR UPDATE` at transaction start for explicit row locking
- Add database-level unique constraint on `redeemed_at` WHERE `status = 'redeemed'` (optional)

**Priority:** ✅ Already Fixed  
**Effort:** 0 (already implemented)

---

#### 2.4 QR Code Generation Errors
**Issue:** QR generation failures not handled gracefully

**Current:** Try/catch but no retry or fallback
**Risk:** Tickets without QR codes

**Recommendation:**
- Retry QR generation (3 attempts)
- Log failures for manual review
- Provide manual code entry fallback

**Priority:** 🟡 Medium

---

#### 2.5 Scanner Authorization
**Issue:** Authorization checks may be bypassed

**Current:** Checks event_manager and event_scanners
**Risk:** Privilege escalation

**Recommendation:**
- Use RLS policies on scan_logs table
- Verify authorization in database function
- Add rate limiting per scanner

**Priority:** 🟡 Medium

---

### 🎯 Hardening Checklist

- [ ] Implement HMAC signing for QR codes
- [ ] Add timestamp validation to prevent replay
- [ ] Fix race condition with SELECT FOR UPDATE
- [ ] Add retry logic for QR generation failures
- [ ] Strengthen scanner authorization checks
- [ ] Add rate limiting per scanner (10 scans/minute)
- [ ] Implement scan analytics and anomaly detection
- [ ] Add admin tools for QR code regeneration

---

## 📧 3. EMAIL SERVICE

### Current State

**Files:**
- `supabase/functions/send-email/index.ts`
- `supabase/functions/send-purchase-confirmation/index.ts`
- `supabase/functions/messaging-queue/index.ts`
- `src/lib/emailService.ts`

**Grade:** B (80/100) 🟡 **Fair** - Needs retry and rate limiting

---

### ✅ Strengths

1. **Basic Retry** ✅
   - `fetchWithRetry` function exists (3 attempts)
   - Timeout handling (10 seconds)

2. **Error Logging** ✅
   - Failed sends logged
   - Error messages stored

---

### ⚠️ Hardening Opportunities

#### 3.1 Email Queue & Retry Strategy (Unified Pattern)
**Issue:** No persistent queue, retry only in-memory during function execution

**Current:** Direct send with `fetchWithRetry` (3 attempts, 250ms delay)
**Risk:** Lost emails if function crashes, no retry after failure

**Architecture Pattern:**

**Responsibility Separation:**
- **Edge Functions:** Enqueue emails into `email_queue` table (single source of truth)
- **Queue Processor:** Separate job/worker processes queue in batches
- **Provider Calls:** Only made by queue processor

**Implementation:**

**Step 1: Update `send-email` function**
```typescript
// All email sending paths must use email_queue
const { data: queueItem } = await supabaseService
  .from('email_queue')
  .insert({
    to_email: to,
    subject,
    html,
    from_email: from || 'Liventix <noreply@liventix.tech>',
    reply_to: replyTo || 'support@liventix.tech',
    email_type: email_type || 'generic',
    status: 'pending',
    next_retry_at: now(), // Process immediately
  })
  .select('id')
  .single();

return { queued: true, queue_id: queueItem.id };
```

**Step 2: Create `process-email-queue` function**
- Runs via pg_cron every 1 minute
- Fetches batch using `get_email_queue_batch(50)` helper
- Respects rate limits (100 emails/minute global, 10/minute per recipient)
- Uses shared `retryWithBackoff` helper:
  - Schedule: [1000, 5000, 30000, 300000, 1800000] ms (1s, 5s, 30s, 5m, 30m)
  - Retry on: 5xx errors, 429 rate limits, network errors
  - Don't retry: 4xx errors (invalid email, etc.)

**Step 3: Update status based on result**
- Success → `mark_email_sent(queue_id)`
- Failure → `mark_email_failed(queue_id, error_message)` (schedules retry)
- Max attempts → Move to `dead_letter` status

**Recommendation:**
- **Deprecate:** Direct provider calls from random functions
- **Migrate:** All email sending → `send-email` function → queue
- **Use:** Shared `enqueueWithDLQ` and `retryWithBackoff` helpers
- **Monitor:** Queue size, processing latency, dead letter count

**Priority:** 🔴 High  
**Effort:** 1-2 days  
**Owner:** Backend

---

#### 3.2 Rate Limiting (Integrated with Queue)
**Issue:** No rate limiting on email sends

**Current:** Sends emails immediately (via `send-email` function)
**Risk:** Hitting Resend API limits (100 emails/second), account suspension

**Implementation Pattern:**

**Step 1: Use shared rate limiter in queue processor**
```typescript
// In process-email-queue function
const batch = await getEmailQueueBatch(50);

for (const email of batch) {
  // Global rate limit: 100 emails/minute
  const globalLimit = await checkRateLimit('email:global', 100, 60);
  if (!globalLimit.allowed) {
    // Re-queue with delay
    await updateEmailQueue(email.id, {
      status: 'pending',
      next_retry_at: globalLimit.resetAt,
    });
    continue;
  }
  
  // Per-recipient limit: 10 emails/minute
  const recipientLimit = await checkRateLimit(
    `email:recipient:${email.to_email}`,
    10,
    60
  );
  if (!recipientLimit.allowed) {
    await updateEmailQueue(email.id, {
      status: 'pending',
      next_retry_at: recipientLimit.resetAt,
    });
    continue;
  }
  
  // Send email...
}
```

**Step 2: Rate limit storage**
- Use database table: `rate_limit_counters`
- Or use Redis (if available)
- TTL-based cleanup (counters expire after window)

**Recommendation:**
- Use shared `checkRateLimit` helper
- Batch processing: 50 emails per run
- Queue processing frequency: Every 1 minute (adjust based on load)
- Monitor: Rate limit hits, queue backlog size

**Priority:** 🔴 High (integrated with 3.1)  
**Effort:** Included in 3.1

---

#### 3.3 Email Delivery Status Tracking
**Issue:** No delivery confirmation or bounce handling

**Current:** Marks as "sent" immediately
**Risk:** No visibility into actual delivery

**Recommendation:**
- Use webhooks from email provider (Resend)
- Track delivery status (sent, delivered, bounced, failed)
- Handle bounces (mark email as invalid)
- Retry failed deliveries after delay

**Priority:** 🟡 Medium

---

#### 3.4 Template Validation
**Issue:** No validation of email templates before sending

**Current:** Templates may have missing variables
**Risk:** Broken emails with `{{undefined}}` placeholders

**Recommendation:**
- Validate template variables before rendering
- Test templates in staging environment
- Fallback to plain text if HTML render fails
- Log template errors for review

**Priority:** 🟡 Medium

---

#### 3.5 Email Queue Management
**Issue:** No persistent queue for email retries

**Current:** Retries happen in-memory during function execution
**Risk:** Lost emails if function crashes

**Recommendation:**
- Create `email_queue` table
- Store failed emails with retry count
- Background job to process queue
- Dead letter queue for permanently failed emails

**Priority:** 🟡 Medium

---

### 🎯 Hardening Checklist

- [ ] Implement exponential backoff retry strategy
- [ ] Add rate limiting (100 emails/minute)
- [ ] Create persistent email queue table
- [ ] Add delivery status webhook handling
- [ ] Implement bounce handling
- [ ] Add template validation
- [ ] Create email queue processing job
- [ ] Add monitoring dashboard for email stats

---

## 📊 4. ANALYTICS DASHBOARD

### Current State

**Files:**
- `src/analytics/components/*.tsx`
- `src/analytics/hooks/useAnalytics.ts`
- `supabase/migrations/*analytics*.sql`
- `supabase/functions/refresh-analytics/index.ts`

**Grade:** B+ (87/100) 🟡 **Good** - Needs error handling and caching

---

### ✅ Strengths

1. **Performance** ✅
   - Materialized views for fast queries
   - Auto-refresh every 5 minutes
   - Zero-filled time series

2. **Data Accuracy** ✅
   - Aggregations use proper SQL
   - Calendar spine prevents gaps

---

### ⚠️ Hardening Opportunities

#### 4.1 Query Error Handling
**Issue:** Query failures not handled gracefully

**Current:** Errors bubble up to UI
**Risk:** Blank dashboard, poor UX

**Recommendation:**
- Try/catch around all queries
- Show user-friendly error messages
- Retry failed queries (3 attempts)
- Cache last successful result as fallback

**Priority:** 🔴 High

---

#### 4.2 Data Staleness Handling (UX Enhancement)
**Issue:** No indication when data is stale

**Current:** Materialized view refreshes every 5 min, no UI indicator
**Risk:** Users don't know if data is up-to-date, confusion about data freshness

**SLO:** Data freshness should be <5 minutes for 95% of queries

**Implementation:**

**UI Components:**
1. **Freshness Badge**
   ```tsx
   <Badge variant={isStale ? "secondary" : "default"}>
     {isRefreshing ? (
       <Spinner className="mr-1 h-3 w-3" />
     ) : null}
     Last updated: {formatTimeAgo(lastUpdated)}
   </Badge>
   ```

2. **Manual Refresh Button**
   ```tsx
   <Button
     onClick={handleRefresh}
     disabled={isRefreshing}
     variant="outline"
   >
     {isRefreshing ? "Refreshing..." : "Refresh"}
   </Button>
   ```

3. **Refresh Status Indicator**
   - Show spinner during refresh
   - Toast notification on success/error
   - Update `lastUpdated` timestamp

**Recommendation:**
- Track `materialized_view_last_refreshed_at` timestamp
- Compare with current time to determine staleness
- Auto-refresh on page focus (if stale > 10 minutes)
- Include in degraded mode banner if using cached data

**Priority:** 🟡 Medium  
**Effort:** 0.25 day (UX work)  
**Owner:** Frontend

---

#### 4.3 Large Dataset Performance
**Issue:** No pagination or limit on time ranges

**Current:** Loads all data for selected range
**Risk:** Slow queries for large campaigns (100+ days)

**Recommendation:**
- Add query timeout (5 seconds)
- Limit date range selection (max 90 days)
- Implement pagination for creative breakdown
- Use cursor-based pagination for time series

**Priority:** 🟡 Medium

---

#### 4.4 Calculation Validation
**Issue:** No validation of calculation results

**Current:** Trusts SQL calculations
**Risk:** Division by zero, NaN, Infinity values

**Recommendation:**
- Validate all calculations in frontend
- Handle edge cases (0 impressions, 0 clicks)
- Show "N/A" for invalid metrics
- Log calculation errors

**Priority:** 🟡 Medium

---

#### 4.5 Refresh Job Failure Handling
**Issue:** No error handling if refresh job fails

**Current:** Cron job runs every 5 minutes
**Risk:** Stale data if refresh fails silently

**Recommendation:**
- Log refresh failures
- Alert on consecutive failures (3+)
- Retry failed refreshes
- Monitor refresh job health

**Priority:** 🟡 Medium

---

### 🎯 Hardening Checklist

- [ ] Add comprehensive error handling for all queries
- [ ] Show data freshness indicator
- [ ] Add query timeouts and limits
- [ ] Validate calculation results (prevent NaN/Infinity)
- [ ] Add refresh job failure monitoring
- [ ] Implement fallback cached data
- [ ] Add manual refresh button
- [ ] Create error reporting dashboard

---

## 🔔 5. PUSH NOTIFICATIONS

### Current State

**Files:**
- `src/hooks/usePushNotifications.ts`
- `src/lib/capacitor-init.ts`
- `supabase/migrations/*user_devices*.sql`
- `src/components/NotificationSystem.tsx`

**Grade:** B (82/100) 🟡 **Fair** - Needs reliability improvements

---

### ✅ Strengths

1. **Permission Handling** ✅
   - Checks permission status
   - Handles denied state

2. **Token Management** ✅
   - Stores tokens in database
   - Updates on token refresh

---

### ⚠️ Hardening Opportunities

#### 5.1 Token Registration Failure Handling
**Issue:** No retry if token registration fails

**Current:** Fails silently on error
**Risk:** Users not receiving notifications

**Recommendation:**
- Retry token registration (3 attempts)
- Exponential backoff
- Log failures for debugging
- Show user-friendly error if all retries fail

**Priority:** 🔴 High

---

#### 5.2 Token Validation
**Issue:** No validation of push tokens before storing

**Current:** Stores any token value
**Risk:** Invalid tokens stored, wasted API calls

**Recommendation:**
- Validate token format (APNs vs FCM)
- Test token with test notification
- Mark invalid tokens as inactive
- Clean up old/invalid tokens periodically

**Priority:** 🟡 Medium

---

#### 5.3 Notification Delivery Tracking
**Issue:** No tracking of notification delivery status

**Current:** Sends notification, no confirmation
**Risk:** No visibility into delivery success

**Recommendation:**
- Track delivery status from push service
- Handle delivery failures (invalid token, device offline)
- Retry failed notifications
- Mark devices inactive after repeated failures

**Priority:** 🟡 Medium

---

#### 5.4 Rate Limiting
**Issue:** No rate limiting on notification sends

**Current:** Can send unlimited notifications
**Risk:** Spamming users, hitting service limits

**Recommendation:**
- Limit: 10 notifications/hour per user
- 100 notifications/hour per campaign
- Batch notifications (group similar ones)
- Respect user notification preferences

**Priority:** 🟡 Medium

---

#### 5.5 Permission Recovery
**Issue:** No way to recover if permission denied

**Current:** Once denied, stuck
**Risk:** Users can't re-enable notifications

**Recommendation:**
- Show "Enable Notifications" button if denied
- Link to device settings
- Periodic prompts (once per month max)
- Track denial reason

**Priority:** 🟢 Low

---

### 🎯 Hardening Checklist

- [ ] Add retry logic for token registration
- [ ] Validate push token format before storing
- [ ] Track notification delivery status
- [ ] Implement rate limiting (10/hour per user)
- [ ] Add batch notification grouping
- [ ] Handle permission denial gracefully
- [ ] Add device cleanup job (remove inactive tokens)
- [ ] Create notification analytics dashboard

---

## 📊 Summary by Priority

### 🔴 High Priority (Critical Issues) - Phase 2.1

| Feature | Item | Owner | Effort | Dependencies |
|---------|------|-------|--------|--------------|
| **Stripe** | Webhook DLQ & retry | Backend | 0.5-1d | Shared queue utils |
| **QR Codes** | HMAC signing + backwards compat | Backend | 1-1.5d | Migration plan |
| **QR Codes** | Replay prevention (soft TTL) | Backend | Included | Part of 2.1 |
| **Email** | Persistent queue + retry | Backend | 1-2d | Queue utils |
| **Email** | Rate limiting | Backend | Included | Part of queue |
| **Analytics** | Error handling + degraded mode | Frontend | 0.5-1d | Error boundaries |
| **Push** | Token registration retry | Mobile/BE | 0.5-1d | Lifecycle states |

**Total Phase 2.1 Effort:** 4-6.5 days

---

### 🟡 Medium Priority (Important Improvements) - Phase 2.2

| Feature | Item | Owner | Effort | Notes |
|---------|------|-------|--------|-------|
| **Stripe** | Payment timeout handling | Backend | 0.5d | UX messaging |
| **Stripe** | Checkout rate limiting | Backend | 0.5d | Shared rate limiter |
| **Stripe** | Idempotency key improvements | Backend | 0.5d | DB constraints |
| **QR Codes** | Scanner authorization hardening | Backend | 0.5d | RLS policies |
| **Email** | Delivery status webhooks | Backend | 1d | Resend integration |
| **Email** | Template validation | Backend | 0.5d | Pre-render checks |
| **Analytics** | Data staleness UI | Frontend | 0.25d | Badge component |
| **Analytics** | Query performance limits | Backend | 0.5d | Timeouts + pagination |
| **Push** | Delivery tracking | Mobile/BE | 1d | Provider callbacks |
| **Push** | Rate limiting | Backend | 0.5d | Shared rate limiter |

**Total Phase 2.2 Effort:** 5.75-6.75 days

---

### 🟢 Low Priority (Nice to Have) - Phase 2.3

| Feature | Item | Owner | Effort | Notes |
|---------|------|-------|--------|-------|
| **Stripe** | Partial refunds | Backend | 1d | Edge cases |
| **Push** | Permission recovery UX | Frontend | 0.5d | Settings link |

**Total Phase 2.3 Effort:** 1.5 days

---

## 🎯 Implementation Priority

### Phase 2.1: Critical Security & Reliability (Week 1)
- QR code HMAC signing
- QR code race condition fix
- Webhook retry mechanism
- Email retry enhancement
- Query error handling

### Phase 2.2: Performance & Rate Limiting (Week 2)
- Email rate limiting & queue
- Checkout rate limiting
- Push notification rate limiting
- Analytics query limits

### Phase 2.3: Monitoring & Observability (Week 3)
- Email delivery tracking
- Push delivery tracking
- Analytics refresh monitoring
- Error dashboards

---

**Next Steps:** Start implementing Phase 2.1 critical items.

