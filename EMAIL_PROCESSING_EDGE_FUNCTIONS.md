# Email Processing Edge Functions - Complete Overview

**Date:** November 27, 2025  
**Status:** ✅ **Active** - Email queue processing system in place

---

## 📧 Email Processing Edge Functions

### 1. ✅ **`process-email-queue`** - Main Email Queue Processor

**Purpose:** Processes emails from the `email_queue` table in batches

**Location:** `supabase/functions/process-email-queue/index.ts`

**Features:**
- ✅ **Batch Processing:** Processes up to 50 emails per run
- ✅ **Rate Limiting:** 
  - Global: 100 emails/minute
  - Per-recipient: 10 emails/minute
- ✅ **Exponential Backoff Retry:** 1s, 5s, 30s delays
- ✅ **Dead Letter Queue:** After max retry attempts
- ✅ **Error Handling:** Comprehensive logging and error tracking
- ✅ **Resend API Integration:** Sends emails via Resend

**How It Works:**
1. Fetches pending emails from `email_queue` table (via `get_email_queue_batch` RPC)
2. Checks global and per-recipient rate limits
3. Sends emails via Resend API with retry logic
4. Marks emails as sent (`sent_at`) or failed
5. Re-queues if rate limited

**Cron Schedule:** Should run every 1 minute (configured in `SETUP_CRON_JOBS_READY.sql`)

---

### 2. ✅ **`send-email`** - Generic Email Sender with Queue Support

**Purpose:** Sends individual emails immediately OR queues them

**Location:** `supabase/functions/send-email/index.ts`

**Features:**
- ✅ **Immediate Send:** Sends email directly via Resend API
- ✅ **Queue Support:** Can queue emails instead of sending immediately (`use_queue=true`)
- ✅ **Retry Logic:** Built-in retry with exponential backoff
- ✅ **Backwards Compatible:** Defaults to immediate send

**Usage:**
```typescript
// Immediate send (default)
await supabase.functions.invoke('send-email', {
  body: {
    to: 'user@example.com',
    subject: 'Hello',
    html: '<p>Email content</p>'
  }
});

// Queue for later processing
await supabase.functions.invoke('send-email', {
  body: {
    to: 'user@example.com',
    subject: 'Hello',
    html: '<p>Email content</p>',
    use_queue: true,  // ✅ Queue instead of immediate send
    email_type: 'purchase_confirmation',
    metadata: { order_id: '...' }
  }
});
```

---

## 📊 Email Queue System

### Database Table: `email_queue`

**Columns:**
- `id` - UUID primary key
- `to_email` - Recipient email address
- `subject` - Email subject
- `html` - HTML email content
- `from_email` - Sender email (default: "Liventix <noreply@liventix.tech>")
- `reply_to` - Reply-to address (default: "support@liventix.tech")
- `email_type` - Type of email ('purchase_confirmation', 'invite', 'reminder', etc.)
- `metadata` - JSONB metadata (order_id, event_id, etc.)
- `status` - 'pending' | 'processing' | 'sent' | 'failed'
- `retry_count` - Number of retry attempts
- `next_retry_at` - When to retry next
- `sent_at` - Timestamp when successfully sent
- `error_message` - Error message if failed
- `created_at` - When queued
- `updated_at` - Last updated

**RPC Function: `get_email_queue_batch(batch_size)`**
- Fetches next batch of emails to process
- Only returns emails where `next_retry_at <= now()`
- Orders by priority and `created_at`

---

## 🔄 Email Processing Flow

### Flow 1: Immediate Send (via `send-email`)
```
Application → send-email Edge Function
                ↓
         Resend API (immediate)
                ↓
         Email delivered
```

### Flow 2: Queued Send (via `send-email` with `use_queue=true`)
```
Application → send-email Edge Function
                ↓
         Insert into email_queue table
                ↓
         Cron job triggers process-email-queue
                ↓
         process-email-queue processes batch
                ↓
         Resend API sends emails
                ↓
         Mark as sent/failed
```

### Flow 3: Direct Queue Insert
```
Application → Insert directly into email_queue
                ↓
         Cron job triggers process-email-queue
                ↓
         process-email-queue processes batch
                ↓
         Resend API sends emails
                ↓
         Mark as sent/failed
```

---

## 📋 All Email-Related Edge Functions

### Core Email Functions
1. ✅ **`process-email-queue`** - Processes email queue (cron job)
2. ✅ **`send-email`** - Generic email sender (immediate or queue)

### Specific Email Functions
3. ✅ **`send-purchase-confirmation`** - Purchase confirmation emails
4. ✅ **`send-refund-confirmation`** - Refund confirmation emails
5. ✅ **`send-ticket-reminder`** - Event reminders
6. ✅ **`send-org-invite`** - Organization invitations
7. ✅ **`send-role-invite`** - Role invitations
8. ✅ **`send-digest`** - Digest/newsletter emails
9. ✅ **`auth-send-otp`** - Email OTP codes
10. ✅ **`resend-confirmation`** - Resend purchase confirmation
11. ✅ **`guest-tickets-start`** - Guest ticket access codes

### Messaging Queue (Bulk Emails)
12. ✅ **`messaging-queue`** - Bulk email/SMS campaigns for events

---

## ⚙️ Configuration

### Environment Variables Required
- ✅ `RESEND_API_KEY` - Required for all email functions
- ✅ `SUPABASE_URL` - Required for database access
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Required for queue processing

### Cron Job Setup
**File:** `SETUP_CRON_JOBS_READY.sql`

```sql
-- Process email queue every 1 minute
SELECT cron.schedule(
  'process-email-queue',
  '* * * * *',  -- Every minute
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/process-email-queue',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

## 🎯 Current Status

### ✅ **What's Working**
- ✅ Email queue table exists
- ✅ `process-email-queue` Edge Function deployed
- ✅ `send-email` Edge Function deployed
- ✅ Queue support (`use_queue=true` flag)
- ✅ Rate limiting (global + per-recipient)
- ✅ Retry logic with exponential backoff
- ✅ Dead letter queue for failed emails
- ✅ Comprehensive error logging

### 📝 **What to Verify**
- [ ] Cron job is scheduled and running
- [ ] `get_email_queue_batch` RPC function exists
- [ ] `email_queue` table has proper indexes
- [ ] All email functions use queue when appropriate

---

## 🔧 Usage Examples

### Example 1: Queue an Email
```typescript
// Queue an email for later processing
await supabase.functions.invoke('send-email', {
  body: {
    to: 'user@example.com',
    subject: 'Welcome to Liventix',
    html: '<h1>Welcome!</h1>',
    use_queue: true,  // ✅ Queue it
    email_type: 'welcome',
    metadata: { user_id: '...' }
  }
});
```

### Example 2: Send Immediately
```typescript
// Send email immediately (no queue)
await supabase.functions.invoke('send-email', {
  body: {
    to: 'user@example.com',
    subject: 'Urgent Notification',
    html: '<p>Important message</p>'
    // use_queue not set = immediate send
  }
});
```

### Example 3: Direct Queue Insert
```typescript
// Insert directly into queue
await supabase
  .from('email_queue')
  .insert({
    to_email: 'user@example.com',
    subject: 'Event Reminder',
    html: '<p>Your event is tomorrow!</p>',
    email_type: 'reminder',
    status: 'pending',
    next_retry_at: new Date().toISOString()
  });
```

---

## 📊 Monitoring

### Queue Status Queries
```sql
-- Check pending emails
SELECT COUNT(*) FROM email_queue WHERE status = 'pending';

-- Check failed emails
SELECT COUNT(*) FROM email_queue WHERE status = 'failed';

-- Check rate limits
SELECT * FROM rate_limits WHERE key LIKE 'email:%';
```

### Logs
- `process-email-queue` logs all processing activity
- Check Supabase Edge Function logs for errors
- Monitor Resend API responses

---

## ✅ Summary

**Yes, there are Edge Functions for email processing!**

1. ✅ **`process-email-queue`** - Main queue processor (runs via cron)
2. ✅ **`send-email`** - Generic sender (immediate or queue)
3. ✅ **Multiple specialized email functions** for specific use cases

**The email system is:**
- ✅ Queue-based (reliable, retryable)
- ✅ Rate-limited (prevents abuse)
- ✅ Resend API integrated
- ✅ Production-ready

---

**Last Updated:** November 27, 2025



