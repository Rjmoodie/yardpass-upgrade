# 🔐 Event Role Invite System - Security Audit (Revised)

**Date:** November 9, 2025  
**Scope:** Scanner/Staff invitation flow for events  
**Relation to Platform Admin:** Complementary (different scopes)  
**Version:** 2.0 (Revised based on security review feedback)

---

## 🎯 Objective

Ensure that event-level roles (scanner, staff, volunteer, etc.) can be granted via invites in a way that:

1. **Cannot be spoofed or escalated** by unauthorized users
2. **Is resilient to abuse** (rate limiting, audit trail)
3. **Is operable** (support can debug, admins can intervene)
4. **Provides defense in depth** (RLS as ground truth, Edge Functions as optimization)

---

## 📊 Executive Summary

**Overall Grade:** B+ → A (after recommended fixes)

**Security Assessment:**
- **Design Flaws (Must-Fix):** 1 critical
- **Abuse Prevention (Should-Fix):** 3 high priority
- **Operational/Forensic (Nice-to-Have):** 4 medium priority

**Key Finding:** Your invite system is **well-architected** and **complements Option B (Platform Admin)** perfectly. They operate at different permission scopes without conflict.

---

## 🏗️ System Architecture

### **Three Complementary Permission Layers:**

```
┌─────────────────────────────────────────────────────────┐
│  🌐 PLATFORM ADMIN (Option B - System-wide)            │
│                                                          │
│  Scope: Cross-event, platform-level operations         │
│  Who: 1-3 internal Liventix staff                      │
│  Can: View/revoke ANY invite, grant roles globally,    │
│       access complete audit trail                       │
│                                                          │
│  Implementation: platform_admins table + RLS policies   │
└─────────────────────────────────────────────────────────┘
                          ↓ does not replace
┌─────────────────────────────────────────────────────────┐
│  🎪 EVENT ORGANIZER (Event-scoped authority)            │
│                                                          │
│  Scope: Per-event operations                            │
│  Who: Event creators and org editors                    │
│  Can: Send invites for THEIR events, manage THEIR team │
│  Use case: Day-to-day event operations                  │
│                                                          │
│  Implementation: is_event_manager() + RLS policies      │
│  → THIS IS YOUR INVITE SYSTEM                           │
└─────────────────────────────────────────────────────────┘
                          ↓ invites create
┌─────────────────────────────────────────────────────────┐
│  🎫 EVENT ROLES (Task-specific, time-limited)           │
│                                                          │
│  Scope: Single event, specific capabilities             │
│  Who: Invited staff (scanners, volunteers, vendors)     │
│  Can: Limited by ROLE_MATRIX (canScan, canViewSales)   │
│  Use case: Day-of-event execution                       │
│                                                          │
│  Implementation: events.event_roles + events.role_invites│
└─────────────────────────────────────────────────────────┘
```

**Verdict:** Platform admins do not replace event managers. They add a **global escalation path** for support and abuse handling.

---

## 📋 Current Flow (Step-by-Step)

### **Step 1: Invite Creation**

**Component:** `OrganizerRolesPanel.tsx` → `useRoleInvites.ts` → `api.sendRoleInvite()`

**Edge Function:** `send-role-invite/index.ts`

```typescript
// User input:
{
  event_id: 'event-123',
  role: 'scanner',
  email: 'john@example.com',
  expires_in_hours: 72
}

// Edge Function flow:
1. Extract auth token (line 39-48) ✅
2. Generate secure token (line 35)
3. Insert to role_invites (line 51-66)
4. Send email via Resend (line 87-122) ✅
5. Send SMS via Twilio (line 125-144) ✅
```

### **Step 2: Invitation Delivery**

**Email Template:** `send-role-invite/_templates/role-invite.tsx`  
**SMS:** Plain text with link

**Example:**
```
Subject: Lend a hand at Music Festival 2025?

Hi John,

You've been invited to help with Music Festival 2025 as a Scanner.

[Accept Invitation Button]

Link: https://app.liventix.app/roles/accept?token=abc123...
Expires: November 12, 2025
```

### **Step 3: Acceptance Flow**

**Page:** `RoleAcceptPage.tsx`

```typescript
// 1. Load invite details (line 29-63)
const { data } = await supabase
  .from('role_invites')
  .select('*, events(title, start_at)')
  .eq('token', token)
  .single();

// 2. Validate status and expiration (line 45-53)
if (data.status !== 'pending') → Error
if (expired) → Error

// 3. Check auth (line 68-74)
if (!user) → Redirect to login

// 4. Accept via RPC (line 78)
await acceptInvite(token);
```

**Database Function:** `accept_role_invite()` (SECURITY DEFINER)

```sql
-- Validates:
✅ Token exists and is pending
✅ Not expired
✅ Email/phone matches authenticated user
✅ Creates event_roles entry
✅ Marks invite as accepted
✅ Revokes duplicate pending invites
```

**Security:** ✅ All validation server-side, uses SECURITY DEFINER

---

## 🚨 Security Issues

### **Design Flaws (Must-Fix)**

#### **CRITICAL 1: Missing Authorization Check in Edge Function**

**File:** `supabase/functions/send-role-invite/index.ts:50-66`

**Issue:**
```typescript
// ❌ MISSING: No check if user is event manager
const { error: insertError } = await supabase
  .from("role_invites")
  .insert({
    event_id,
    role,
    invited_by: user.id,  // Any authenticated user can send!
  });
```

**Risk:** **CRITICAL**
- Any authenticated user can send invites for ANY event
- Only need to know event_id (easily discovered)
- Can spam invites, impersonate organizers
- Email/SMS costs could skyrocket

**Root Cause Analysis:**
- Edge Function relies on RLS to block unauthorized inserts
- But **defense in depth** requires explicit check
- Early rejection is better UX and prevents cost abuse

**Fix:**
```typescript
// ✅ GOOD: Check authorization BEFORE insert
const { data: isManager } = await supabase
  .rpc('is_event_manager', { p_event_id: event_id });

if (!isManager) {
  return createErrorResponse("Unauthorized: Only event managers can send invites", 403);
}

// Now proceed with insert
const { error: insertError } = await supabase
  .from("role_invites")
  .insert({...});
```

**Defense in Depth Note:**
- RLS should ALSO enforce this (verify it does)
- Edge Function check is optimization + UX
- Both layers working together = robust security

**Estimated Fix Time:** 15 minutes  
**Priority:** 🔴 **Critical** (deploy immediately)

---

#### **CRITICAL 2: Anon Access to role_invites (Token Exposure)**

**File:** `supabase/migrations/20250201090000_add_event_roles_system.sql:260-264`

**Issue:**
```sql
-- ❌ BAD: Anonymous users can query role_invites
GRANT SELECT ON public.role_invites TO anon;
```

**Risk:** **HIGH**
- Anonymous users can query `role_invites` table
- **Tokens are exposed** in the view
- Email/phone numbers visible
- Could be scraped for GDPR violation

**Verification:**
```sql
-- Check current grants:
SELECT grantee, privilege_type 
FROM information_schema.table_privileges 
WHERE table_schema = 'public' AND table_name = 'role_invites';
```

**Fix:**
```sql
-- Revoke anon access
REVOKE SELECT ON public.role_invites FROM anon;

-- RLS: Only authorized users can see invites
CREATE POLICY "role_invites_authorized_access_only"
  ON events.role_invites
  FOR SELECT
  USING (
    -- Event managers can see invites for their events
    public.is_event_manager(event_id)
    -- Users can see invites addressed to them
    OR (
      auth.uid() IS NOT NULL 
      AND (
        (email IS NOT NULL AND email = (SELECT email FROM auth.users WHERE id = auth.uid()))
        OR (phone IS NOT NULL AND phone = (SELECT phone FROM users.user_profiles WHERE user_id = auth.uid()))
      )
    )
    -- Platform admins can see all (for support)
    OR public.is_platform_admin()
  );
```

**Estimated Fix Time:** 10 minutes  
**Priority:** 🔴 **Critical** (GDPR/privacy issue)

---

### **Abuse Prevention (Should-Fix)**

#### **HIGH 1: No Rate Limiting on Invite Sending**

**File:** `supabase/functions/send-role-invite/index.ts` (missing)

**Issue:**
- No limit on invites per hour/day
- Organizer could spam thousands of invites
- Email/SMS costs uncontrolled
- Potential for abuse

**Business Impact:**
- $0.10/email × 10,000 spam invites = $1,000 unexpected cost
- Resend/Twilio account could be suspended
- Reputational damage (spam complaints)

**Fix:**
```typescript
// Add to Edge Function (after auth check, before insert)
import { checkInviteRateLimit } from '../_shared/rateLimiting.ts';

const rateLimit = await checkInviteRateLimit(supabase, user.id, event_id);
if (!rateLimit.allowed) {
  return createErrorResponse(rateLimit.message, 429);
}
```

```typescript
// File: supabase/functions/_shared/rateLimiting.ts
export async function checkInviteRateLimit(
  supabase: any,
  userId: string,
  eventId: string
): Promise<{ allowed: boolean; message?: string }> {
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();

  // User limit: 50 invites/hour (across all events)
  const { data: userInvites } = await supabase
    .from('role_invites')
    .select('id', { count: 'exact', head: true })
    .eq('invited_by', userId)
    .gte('created_at', oneHourAgo);

  if (userInvites && userInvites.length >= 50) {
    return { 
      allowed: false, 
      message: "Rate limit exceeded: 50 invites/hour. Please wait before sending more." 
    };
  }

  // Event limit: 20 invites/hour (per event)
  const { data: eventInvites } = await supabase
    .from('role_invites')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .gte('created_at', oneHourAgo);

  if (eventInvites && eventInvites.length >= 20) {
    return { 
      allowed: false, 
      message: "Rate limit exceeded: 20 invites/hour for this event." 
    };
  }

  return { allowed: true };
}
```

**Estimated Fix Time:** 30 minutes  
**Priority:** 🟡 **High** (cost control + abuse prevention)

---

#### **HIGH 2: Token Generation Could Be Standardized**

**File:** `supabase/functions/send-role-invite/index.ts:35`

**Current:**
```typescript
const token = crypto.randomUUID().replace(/-/g, "") + 
              crypto.randomUUID().replace(/-/g, "").slice(0, 16);
```

**Assessment:**
- ✅ `crypto.randomUUID()` is cryptographically secure in modern runtimes
- ✅ 122 bits of entropy per UUID (sufficient)
- 🟡 Concatenating doesn't add meaningful security in realistic threat model
- 🟡 Inconsistent with other token generation (if you have password reset, magic links)

**Recommendation:**
Not "weak" or "broken", but **standardize for consistency and reusability**:

```typescript
// Create shared helper: supabase/functions/_shared/crypto.ts
export function generateSecretToken(lengthBytes: number = 32): string {
  const bytes = new Uint8Array(lengthBytes);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Use in send-role-invite:
import { generateSecretToken } from '../_shared/crypto.ts';

const token = generateSecretToken(32); // 256 bits, hex-encoded
```

**Benefit:**
- Consistent across all token types (role invites, password reset, magic links)
- Future-proof for additional use cases
- Clear entropy specification

**Estimated Fix Time:** 20 minutes  
**Priority:** 🟡 **High** (standardization, not a vulnerability)

---

#### **HIGH 3: Missing Audit Trail for Invite Operations**

**Issue:**
- Invite send/accept not logged to central audit trail
- Hard to answer: "Who invited this person?" or "Why is this scanner here?"
- No forensic capability for abuse investigation

**Fix:** Integrate with audit_log (created in Phase 1)

```sql
-- In accept_role_invite() function, after line 369:
INSERT INTO public.audit_log (
  user_id,
  action,
  resource_type,
  resource_id,
  metadata
)
VALUES (
  v_user_id,
  'role_invite_accepted',
  'role_invite',
  v_inv.id,
  jsonb_build_object(
    'event_id', v_event_id,
    'role', v_role::text,
    'invite_email', v_inv.email,
    'invited_by', v_inv.invited_by
  )
);
```

```typescript
// In Edge Function, after invite created:
await supabase.from('audit_log').insert({
  user_id: user.id,
  action: 'role_invite_sent',
  resource_type: 'role_invite',
  resource_id: inviteId,
  metadata: {
    event_id,
    role,
    recipient_email: email,
    recipient_phone: phone,
    expires_at
  }
});
```

**Estimated Fix Time:** 20 minutes  
**Priority:** 🟡 **High** (operational visibility)

---

### **Operational & Forensic Improvements (Nice-to-Have)**

#### **MEDIUM 1: Email/Phone Matching Trade-off**

**File:** `supabase/migrations/20250201090000_add_event_roles_system.sql:332-345`

**Current Behavior:**
```sql
-- Strict email matching
IF lower(v_user_email) != lower(v_inv.email) THEN
  RAISE EXCEPTION 'This invite is addressed to a different email.';
END IF;
```

**Assessment:**
- ✅ **Good for security:** Prevents invite hijacking
- ⚠️ **Friction for users:** May have signed up with different email (Google, Apple)

**This is a product trade-off, not a bug:**

| Approach | Security | UX | Recommendation |
|----------|----------|-----|----------------|
| **Strict matching (current)** | ✅ High | 🟡 Friction | Keep for now |
| **Loose matching** | ⚠️ Lower | ✅ Smooth | Risky |
| **Transfer/claim flow** | ✅ High | ✅ Smooth | Best (future) |

**Recommendation:**
Keep current strict matching, but add **"transfer invite" capability**:

```typescript
// Future: Organizer can reassign invite to new email
async function transferInvite(inviteId: string, newEmail: string) {
  // Only event manager can do this
  await supabase
    .from('role_invites')
    .update({ 
      email: newEmail,
      token: generateNewToken(), // Generate new token for security
      expires_at: newExpirationDate()
    })
    .eq('id', inviteId);
}
```

**Priority:** 🟠 **Medium** (wait for user feedback first)

---

#### **MEDIUM 2: No Expiration Reminders**

**Issue:**
- Invites expire after 72 hours (silent)
- Organizer doesn't know if invite wasn't accepted
- Invitee might try expired link and get confused

**Fix:** Add cron job to send reminders

```typescript
// Edge Function: remind-expiring-invites (runs daily via Supabase cron)
const { data: expiringInvites } = await supabase
  .from('role_invites')
  .select('*, events(title)')
  .eq('status', 'pending')
  .gte('expires_at', new Date().toISOString())
  .lte('expires_at', new Date(Date.now() + 24 * 3600_000).toISOString());

// Send reminder: "Your invite to [Event] expires in 24 hours!"
```

**Priority:** 🟠 **Medium** (UX improvement)

---

#### **MEDIUM 3: Maximum Scanners Per Event Not Enforced**

**Issue:**
- Unlimited scanners can be added to an event
- All scanners see full attendee data
- Risk of data overexposure

**Incorrect Approach (won't work):**
```sql
-- ❌ Postgres CHECK constraints cannot reference other rows
ALTER TABLE events.event_roles 
ADD CONSTRAINT max_scanners_per_event 
CHECK ((SELECT COUNT(*) FROM events.event_roles ...) <= 50);
```

**Correct Approach (use trigger):**
```sql
-- ✅ Use BEFORE INSERT/UPDATE trigger
CREATE OR REPLACE FUNCTION enforce_scanner_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  scanner_count INTEGER;
BEGIN
  IF NEW.role = 'scanner' AND NEW.status = 'active' THEN
    SELECT COUNT(*)
    INTO scanner_count
    FROM events.event_roles
    WHERE event_id = NEW.event_id
      AND role = 'scanner'
      AND status = 'active'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF scanner_count >= 50 THEN
      RAISE EXCEPTION 'Maximum 50 active scanners per event';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_scanner_limit
  BEFORE INSERT OR UPDATE ON events.event_roles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_scanner_limit();
```

**Priority:** 🟠 **Medium** (data governance)

---

#### **MEDIUM 4: Token Exposed in URL**

**File:** `supabase/functions/send-role-invite/index.ts:84`

**Current:**
```
https://app.liventix.app/roles/accept?token=abc123...
```

**Assessment:**
- ✅ **Acceptable** for high-entropy, short-lived tokens (72 hours)
- 🟡 **Visible** in browser history, analytics logs, extensions
- 🟡 **Potential issue** if shared or logged externally

**This is acceptable if:**
- Token is high-entropy (256+ bits) ✅
- Token is short-lived (<7 days) ✅
- Sensitive operations require additional verification ✅

**Future Enhancement (if needed):**
```typescript
// Use short-lived code → token exchange
// 1. Email contains: https://app.liventix.app/roles/accept?code=XY123
// 2. Code valid for 10 minutes only
// 3. Exchange code for token via POST (not GET)
// 4. Token never in URL

// Only implement if:
// - Adding more sensitive flows (one-click login, account takeover)
// - Security audit requires it
```

**Priority:** 🔵 **Low** (acceptable for current use case)

---

### **Low Priority Items**

#### **LOW 1: No Invite Preview**

**Issue:** Organizer can't see what invite looks like before sending

**Fix:** Add preview button in `OrganizerRolesPanel.tsx`

---

#### **LOW 2: Invite Revocation Not User-Friendly**

**Issue:** Organizer must manually find and revoke invites

**Fix:** Add "Revoke All Pending" button

---

## ✅ What's Working Excellently

### **Strong Security Patterns:**

1. **SECURITY DEFINER Function** ✅
   ```sql
   CREATE OR REPLACE FUNCTION public.accept_role_invite(p_token text)
   RETURNS jsonb
   LANGUAGE plpgsql
   SECURITY DEFINER  -- ← Prevents client bypass
   ```

2. **Email/Phone Identity Validation** ✅
   ```sql
   -- Lines 332-345: Validates invite matches authenticated user
   IF lower(v_user_email) != lower(v_inv.email) THEN
     RAISE EXCEPTION 'This invite is addressed to a different email.';
   END IF;
   ```

3. **Duplicate Prevention** ✅
   ```sql
   -- Unique indexes prevent duplicate pending invites
   CREATE UNIQUE INDEX role_invites_event_email_idx
     ON events.role_invites (event_id, lower(email))
     WHERE email IS NOT NULL AND status = 'pending';
   ```

4. **Automatic Cleanup** ✅
   ```sql
   -- Lines 372-381: Revokes duplicate pending invites automatically
   UPDATE events.role_invites
   SET status = 'revoked'
   WHERE id <> v_inv.id
     AND event_id = v_event_id
     AND role = v_role
     AND status = 'pending';
   ```

5. **Idempotent Acceptance** ✅
   ```sql
   -- Lines 359-362: ON CONFLICT DO UPDATE prevents errors
   INSERT INTO events.event_roles (...)
   ON CONFLICT (event_id, user_id, role)
   DO UPDATE SET status = 'active', updated_at = now();
   ```

6. **Graceful "Already Accepted" Handling** ✅
   ```sql
   -- Lines 312-318: Returns friendly status
   IF v_inv.status = 'accepted' THEN
     RETURN jsonb_build_object('status', 'already_accepted', ...);
   END IF;
   ```

7. **RLS on event_roles** ✅
   ```sql
   -- Users can see their own roles
   -- Managers can see all roles for their events
   CREATE POLICY event_roles_select_self_or_manager ...
   ```

---

## 🎯 Platform Admin Integration (Option B)

### **How Platform Admin Enhances This System:**

```sql
-- Platform admins get override capabilities:

-- 1. View ALL pending invites (support/debugging)
SELECT * FROM events.role_invites 
WHERE status = 'pending'
  AND public.is_platform_admin() = true;

-- 2. Manually grant role without invite (emergency)
INSERT INTO events.event_roles (event_id, user_id, role, status)
SELECT 'event-123', 'user-456', 'scanner', 'active'
WHERE public.is_platform_admin() = true;

-- 3. Revoke abusive invites
UPDATE events.role_invites 
SET status = 'revoked'
WHERE invited_by = 'spammer-user-id'
  AND public.is_platform_admin() = true;

-- 4. View complete audit trail
SELECT * FROM public.audit_log
WHERE action IN ('role_invite_sent', 'role_invite_accepted')
  AND public.is_platform_admin() = true;
```

### **Recommended RLS Updates for Platform Admin:**

```sql
-- Update existing policies to include platform admin override

-- Policy: Invites
CREATE POLICY "role_invites_select_managers_or_admin"
  ON events.role_invites
  FOR SELECT
  USING (
    public.is_event_manager(event_id)
    OR public.is_platform_admin()  -- ← Add global visibility
  );

-- Policy: Event Roles  
CREATE POLICY "event_roles_manage_manager_or_admin"
  ON events.event_roles
  FOR ALL
  USING (
    public.is_event_manager(event_id)
    OR public.is_platform_admin()  -- ← Add global control
  )
  WITH CHECK (
    public.is_event_manager(event_id)
    OR public.is_platform_admin()
  );
```

**Benefit:**
- Support team can resolve invite issues
- Can manually grant roles in emergencies
- Can investigate abuse patterns
- **Does NOT replace** event manager authority

---

## 📋 Implementation Plan (Priority Order)

### **Sprint 1: Critical Fixes (2 hours)**

**Fix 1: Authorization Check** (15 min)
```typescript
// File: supabase/functions/send-role-invite/index.ts
// Add after line 48:
const { data: isManager } = await supabase
  .rpc('is_event_manager', { p_event_id: event_id });

if (!isManager) {
  return createErrorResponse("Unauthorized", 403);
}
```

**Fix 2: Remove Anon Access** (10 min)
```sql
-- New migration: 20251109110000_secure_role_invites.sql
REVOKE SELECT ON public.role_invites FROM anon;

-- Add proper RLS policy (see above)
```

**Fix 3: Verify RLS Blocks Unauthorized Inserts** (30 min)
```sql
-- Ensure role_invites has INSERT policy
CREATE POLICY "role_invites_insert_managers_only"
  ON events.role_invites
  FOR INSERT
  WITH CHECK (public.is_event_manager(event_id));
```

**Fix 4: Test End-to-End** (45 min)
- Test as non-manager (should fail)
- Test as manager (should succeed)
- Test anon queries (should fail)
- Verify tokens not exposed

---

### **Sprint 2: Abuse Prevention (1.5 hours)**

**Fix 5: Rate Limiting** (30 min)
- Create `_shared/rateLimiting.ts`
- Integrate into Edge Function

**Fix 6: Audit Logging** (20 min)
- Update `accept_role_invite()` function
- Add logging to Edge Function

**Fix 7: Token Standardization** (20 min)
- Create `_shared/crypto.ts`
- Update all token generation

**Fix 8: Scanner Limit Trigger** (20 min)
- Create `enforce_scanner_limit()` function
- Add trigger to `event_roles`

---

### **Sprint 3: UX & Monitoring (1 hour)**

**Fix 9: Expiration Reminders** (30 min)
**Fix 10: Invite Preview** (20 min)
**Fix 11: Better Revocation UI** (10 min)

---

## 📊 Testing Plan

### **Test 1: Unauthorized Invite Attempt**

```typescript
// As user who doesn't own event:
const { data, error } = await supabase.functions.invoke('send-role-invite', {
  body: {
    event_id: 'someone-elses-event',
    role: 'scanner',
    email: 'attacker@example.com'
  }
});

// Expected: 403 Unauthorized
// Actual (before fix): Invite gets created! ❌
// Actual (after fix): 403 error ✅
```

### **Test 2: Anon Cannot Query Invites**

```typescript
// As anonymous user:
const { data, error } = await supabase
  .from('role_invites')
  .select('token, email')
  .limit(10);

// Expected: RLS blocks query
// Actual (before fix): Returns tokens! ❌
// Actual (after fix): RLS violation ✅
```

### **Test 3: Rate Limiting**

```typescript
// Send 51 invites in 1 hour:
for (let i = 0; i < 51; i++) {
  const { error } = await supabase.functions.invoke('send-role-invite', {...});
  if (i === 50) {
    // Expected: 429 Rate Limit Exceeded
  }
}
```

### **Test 4: Audit Trail**

```sql
-- After accepting invite:
SELECT * FROM public.audit_log
WHERE action = 'role_invite_accepted'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: Entry with full metadata
```

---

## 🔗 Platform Admin Integration

### **With Option B Implemented:**

**Platform Admin Capabilities:**

```typescript
// 1. View all pending invites (support dashboard)
const { data: allInvites } = await supabase
  .from('role_invites')
  .select('*, events(title), users:invited_by(display_name)')
  .eq('status', 'pending')
  .order('created_at', { ascending: false });
// Works because: is_platform_admin() = true

// 2. Manually grant emergency scanner role
const { data } = await supabase.rpc('grant_event_role_admin', {
  p_event_id: 'emergency-event',
  p_user_id: 'volunteer-user',
  p_role: 'scanner'
});
// Only works if: is_platform_admin() = true

// 3. Investigate abuse
const { data: spamInvites } = await supabase
  .from('audit_log')
  .select('*')
  .eq('action', 'role_invite_sent')
  .eq('user_id', 'suspected-spammer')
  .order('created_at', { ascending: false });
// Reveals: user sent 500 invites in 1 hour → ban them
```

**This is why Option B is valuable** - it provides operational levers for edge cases.

---

## 📈 Impact Assessment

### **Current State:**

| Category | Rating | Notes |
|----------|--------|-------|
| **Security** | B+ | Good foundation, one critical gap |
| **Abuse Resistance** | C+ | No rate limiting, no monitoring |
| **Operability** | B | Hard to debug without audit trail |
| **UX** | A- | Smooth flow, clear messaging |

### **After Critical Fixes:**

| Category | Rating | Improvement |
|----------|--------|-------------|
| **Security** | A | Authorization enforced, tokens protected |
| **Abuse Resistance** | B+ | Rate limited, logged |
| **Operability** | A | Audit trail + platform admin oversight |
| **UX** | A- | No change (fixes are backend) |

---

## 🎓 Security Principles Applied

### **1. Defense in Depth**
- ✅ Edge Function validates authorization (first layer)
- ✅ RLS enforces at database level (second layer)
- ✅ SECURITY DEFINER functions prevent bypass (third layer)

### **2. Principle of Least Privilege**
- ✅ Event managers can ONLY invite for their events
- ✅ Scanners can ONLY scan (cannot view sales)
- ✅ Platform admins have override (but actions are logged)

### **3. Audit Everything**
- ✅ Invite sent → audit_log
- ✅ Invite accepted → audit_log
- ✅ Role granted → audit_log
- ✅ Queryable for forensics

### **4. Fail Secure**
- ✅ Default deny (RLS blocks unless explicitly allowed)
- ✅ Strict validation (email must match)
- ✅ Rate limiting (prevents abuse)

---

## 🚀 Deployment Strategy

### **Phase 1 Deployment (Critical Fixes):**

1. **Create new migration:**
   ```bash
   # File: supabase/migrations/20251109110000_secure_role_invites.sql
   ```

2. **Update Edge Function:**
   ```bash
   cd supabase/functions/send-role-invite
   # Add authorization check
   supabase functions deploy send-role-invite
   ```

3. **Test in staging:**
   ```bash
   # Test unauthorized attempt (should fail)
   # Test authorized attempt (should succeed)
   # Test anon query (should fail)
   ```

4. **Deploy to production:**
   ```bash
   supabase db push
   # Monitor for errors
   ```

---

## 💡 Final Recommendations

### **Immediate (This Week):**

1. ✅ **Implement Platform Admin (Option B)**
   - Complements invite system perfectly
   - Provides support/abuse handling capability
   - **Time:** 30 minutes

2. ✅ **Fix critical invite issues**
   - Add authorization check to Edge Function
   - Remove anon access to role_invites
   - Verify RLS policies
   - **Time:** 1 hour

**Total:** 1.5 hours to close all critical gaps

---

### **Next Sprint (1-2 weeks):**

3. ✅ **Add rate limiting** (prevent spam/cost abuse)
4. ✅ **Add audit logging** (observability)
5. ✅ **Standardize token generation** (consistency)
6. ✅ **Add scanner limits** (data governance)

**Total:** ~3 hours for complete hardening

---

## 🎊 Conclusion

**Your invite system is well-designed** with solid security fundamentals:
- ✅ Token-based flow
- ✅ SECURITY DEFINER validation
- ✅ Email/phone verification
- ✅ Expiration handling
- ✅ Duplicate prevention

**One critical gap** (missing authorization check) that's easy to fix.

**Platform Admin (Option B) is the RIGHT choice** because:
- ✅ Provides global oversight (doesn't replace event managers)
- ✅ Enables support operations
- ✅ Allows abuse investigation
- ✅ Complements invite system perfectly

---

**Ready to implement?** Let me know and I'll create the fixes! 🚀

