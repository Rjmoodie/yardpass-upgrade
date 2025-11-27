# 🔒 Feature Hardening Implementation Plan

**Date:** January 28, 2025  
**Based on:** Detailed audit in `FEATURE_HARDENING_AUDIT.md`  
**Status:** 🚀 Ready to Implement

---

## 📊 Overview

This plan outlines the implementation of critical hardening improvements across 5 features, prioritized by severity and impact.

---

## 🎯 Implementation Priority

### **Phase 2.1: Critical Security & Reliability** (Week 1)
**Estimated Time:** 12-16 hours

1. ✅ **QR Code Security** (4 hours)
   - Implement HMAC signing for QR codes
   - Add timestamp validation (prevent replay)
   - Fix race condition with SELECT FOR UPDATE

2. ✅ **Email Retry Enhancement** (3 hours)
   - Exponential backoff retry strategy
   - Persistent email queue
   - Rate limiting

3. ✅ **Webhook Retry Mechanism** (2 hours)
   - Dead letter queue for failed webhooks
   - Automatic retry with backoff

4. ✅ **Analytics Query Error Handling** (3 hours)
   - Comprehensive error handling
   - Fallback cached data
   - User-friendly error messages

---

### **Phase 2.2: Performance & Rate Limiting** (Week 2)
**Estimated Time:** 8-12 hours

1. Checkout rate limiting
2. Push notification rate limiting
3. Analytics query performance limits
4. Email queue processing

---

### **Phase 2.3: Monitoring & Observability** (Week 3)
**Estimated Time:** 6-10 hours

1. Email delivery tracking
2. Push delivery tracking
3. Analytics refresh monitoring
4. Error dashboards

---

## 📋 Detailed Implementation Tasks

### 🔴 **TASK 1: QR Code Security Hardening**

#### 1.1 HMAC Signing for QR Codes

**Current State:**
- QR codes are 8-character random strings
- Scanner validates signature but may not be used for all tickets
- Unsigned QR codes can be forged

**Implementation:**
1. Create migration to add `qr_code_signed` column (nullable, for migration)
2. Create function `generate_signed_qr_code(ticket_id, event_id)`:
   ```sql
   -- Generates: v1.{base64_ticket_id}.{hmac_signature}
   -- Signature = HMAC-SHA256(ticket_id + event_id + timestamp, SECRET)
   ```
3. Update ticket creation to use signed QR codes
4. Update scanner to validate signatures
5. Migrate existing tickets (optional, or mark as legacy)

**Files to Create/Modify:**
- `supabase/migrations/20250128_add_qr_code_signing.sql`
- `supabase/functions/scanner-validate/index.ts` (update validation)
- Edge function that creates tickets (update QR generation)

**Priority:** 🔴 Critical
**Estimated Time:** 4 hours

---

#### 1.2 Replay Attack Prevention

**Current State:**
- No timestamp validation
- Screenshot QR codes can be reused

**Implementation:**
1. Include `iat` (issued at) timestamp in signed QR payload
2. Reject scans if timestamp is older than 5 minutes
3. Store last scan timestamp to detect rapid re-scans (< 10 seconds apart)

**Files to Modify:**
- `supabase/functions/scanner-validate/index.ts`
- Add timestamp validation logic

**Priority:** 🔴 Critical
**Estimated Time:** 2 hours

---

#### 1.3 Race Condition Fix

**Current State:**
- Concurrent scans may both succeed

**Implementation:**
1. Use `SELECT FOR UPDATE` to lock ticket row
2. Atomic update with WHERE clause:
   ```sql
   UPDATE tickets 
   SET redeemed_at = now() 
   WHERE id = $1 AND redeemed_at IS NULL
   RETURNING id;
   ```
3. If no rows returned, ticket already redeemed

**Files to Modify:**
- `supabase/functions/scanner-validate/index.ts`
- Wrap redemption in transaction

**Priority:** 🔴 Critical
**Estimated Time:** 1 hour

---

### 🔴 **TASK 2: Email Service Hardening**

#### 2.1 Enhanced Retry Strategy

**Current State:**
- 3 attempts with 250ms delay
- No exponential backoff
- No persistent queue

**Implementation:**
1. Create `email_queue` table:
   ```sql
   CREATE TABLE email_queue (
     id UUID PRIMARY KEY,
     to_email TEXT NOT NULL,
     subject TEXT NOT NULL,
     html TEXT NOT NULL,
     attempts INT DEFAULT 0,
     max_attempts INT DEFAULT 5,
     next_retry_at TIMESTAMPTZ,
     status TEXT, -- 'pending', 'sent', 'failed', 'dead_letter'
     error TEXT,
     created_at TIMESTAMPTZ DEFAULT now()
   );
   ```

2. Update `send-email` function:
   - Insert into queue instead of sending immediately
   - Process queue with exponential backoff (1s, 5s, 30s, 5min, 30min)

3. Create queue processing job (pg_cron or Edge Function)

**Files to Create/Modify:**
- `supabase/migrations/20250128_create_email_queue.sql`
- `supabase/functions/send-email/index.ts`
- `supabase/functions/process-email-queue/index.ts` (new)

**Priority:** 🔴 Critical
**Estimated Time:** 3 hours

---

#### 2.2 Rate Limiting

**Implementation:**
1. Add rate limiting to email sends:
   - 100 emails/minute global limit
   - 10 emails/minute per recipient
   - Use Redis or database counter

2. Queue emails if rate limit exceeded

**Files to Modify:**
- `supabase/functions/send-email/index.ts`
- Add rate limit check before queue insert

**Priority:** 🟡 High
**Estimated Time:** 2 hours

---

### 🔴 **TASK 3: Webhook Retry Mechanism**

**Current State:**
- Webhook failures logged but not retried
- Manual intervention required

**Implementation:**
1. Create `webhook_retry_queue` table:
   ```sql
   CREATE TABLE webhook_retry_queue (
     id UUID PRIMARY KEY,
     webhook_type TEXT, -- 'stripe', 'resend', etc.
     payload JSONB NOT NULL,
     attempts INT DEFAULT 0,
     max_attempts INT DEFAULT 5,
     next_retry_at TIMESTAMPTZ,
     last_error TEXT,
     status TEXT -- 'pending', 'processed', 'failed'
   );
   ```

2. Update `stripe-webhook` function:
   - Catch errors during processing
   - Insert failed webhooks into retry queue
   - Return 200 to Stripe (prevent retries from Stripe)

3. Create retry processor:
   - Process queue every 5 minutes
   - Exponential backoff: 1min, 5min, 30min, 2hr, 24hr
   - Dead letter queue after max attempts

**Files to Create/Modify:**
- `supabase/migrations/20250128_create_webhook_retry_queue.sql`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/process-webhook-retries/index.ts` (new)

**Priority:** 🔴 Critical
**Estimated Time:** 2 hours

---

### 🔴 **TASK 4: Analytics Query Error Handling**

**Current State:**
- Errors bubble up to UI
- No fallback or retry

**Implementation:**
1. Wrap all queries in try/catch
2. Implement retry logic (3 attempts)
3. Cache last successful result
4. Show user-friendly error messages
5. Add loading states and error boundaries

**Files to Modify:**
- `src/analytics/hooks/useAnalytics.ts`
- `src/analytics/api/queries.ts`
- `src/analytics/components/*.tsx` (error boundaries)

**Priority:** 🔴 Critical
**Estimated Time:** 3 hours

---

## 🚀 Starting Implementation

I'll begin with the highest priority items. Should I start with:
1. **QR Code Security** (HMAC signing, replay prevention, race condition fix)
2. **Email Retry Enhancement** (queue, exponential backoff)
3. **Webhook Retry Mechanism** (DLQ, automatic retries)

Or would you prefer a different order?

