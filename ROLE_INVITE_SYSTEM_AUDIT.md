# 🔐 Event Role Invite System - Security Audit

**Date:** November 9, 2025  
**Scope:** Scanner/Staff invitation flow for events  
**Relation to Platform Admin:** Complementary (different scopes)

---

## 🎯 Executive Summary

**Overall Grade:** B+ (Good foundation with some security gaps)

**Critical Issues:** 1  
**High Priority:** 3  
**Medium Priority:** 4  
**Low Priority:** 2  

**Key Finding:** Your invite system is **well-designed** and **complements Option B (Platform Admin)** perfectly. They operate at different permission scopes and don't conflict.

---

## 🏗️ How It Relates to Platform Admin (Option B)

### **Three Separate Permission Layers:**

```
┌─────────────────────────────────────────────────────────┐
│  🌐 PLATFORM ADMIN (Option B - System-wide)            │
│                                                          │
│  Who: 1-3 internal Liventix staff                      │
│  Can: Manage ANY event, override ANY permission        │
│  Use case: Support, moderation, platform operations    │
│                                                          │
│  Table: platform_admins                                 │
│  Function: is_platform_admin()                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  🎪 EVENT ORGANIZER (Your existing system)              │
│                                                          │
│  Who: Event creators and org editors                    │
│  Can: Manage THEIR OWN events                          │
│  Use case: Send scanner/staff invites ← THIS SYSTEM    │
│                                                          │
│  Table: events.events (owner)                           │
│  Function: is_event_manager()                           │
└─────────────────────────────────────────────────────────┘
                          ↓ invites via
┌─────────────────────────────────────────────────────────┐
│  🎫 EVENT ROLES (Scanner, Staff, etc.)                  │
│                                                          │
│  Who: Invited staff for specific event                  │
│  Can: Scan tickets, view attendee list (limited scope) │
│  Use case: Day-of-event operations                      │
│                                                          │
│  Table: events.event_roles                              │
│  Invite: events.role_invites                            │
└─────────────────────────────────────────────────────────┘
```

### **✅ VERDICT: Option B COMPLEMENTS This System**

- **Platform Admin:** Can troubleshoot invite system, manually grant roles
- **Event Organizer:** Can send invites for their events (existing system)
- **Event Roles:** Can accept invites and get limited permissions

**NO CONFLICT** - They work together beautifully!

---

## 📋 Current Flow Analysis

### **Step 1: Organizer Sends Invite**

**Frontend:** `OrganizerRolesPanel.tsx` → `useRoleInvites.ts`

```typescript
// Organizer clicks "Invite Scanner"
await sendInvite({
  eventId: 'event-123',
  role: 'scanner',
  email: 'john@example.com',
  expiresInHours: 72  // 3 days
});
```

**Edge Function:** `send-role-invite/index.ts`

```typescript
// 1. Validates auth token (line 39-48)
// 2. Generates secure token (line 35)
// 3. Creates invite record (line 51-66)
// 4. Sends email via Resend (line 87-122)
// 5. Sends SMS via Twilio (line 125-144)
```

**Security Check:** ✅ Uses auth token, validates user

---

### **Step 2: Invitee Receives Link**

**Email:** Contains link like:
```
https://app.liventix.app/roles/accept?token=abc123...
```

**SMS:** Contains same link

**Security:** ✅ Token is unique, time-limited

---

### **Step 3: Invitee Accepts Invite**

**Frontend:** `RoleAcceptPage.tsx`

```typescript
// 1. Load invite details (line 29-63)
// 2. Check auth status (line 68-74)
// 3. Call accept function (line 78)
// 4. Redirect to dashboard (line 94-96)
```

**Database Function:** `accept_role_invite()` (migration line 270-406)

```sql
-- 1. Validates token exists (line 302-309)
-- 2. Checks expiration (line 324-330)
-- 3. Validates email/phone match (line 332-345)
-- 4. Creates event_roles entry (line 357-362)
-- 5. Marks invite as accepted (line 365-369)
-- 6. Revokes duplicate invites (line 372-381)
```

**Security:** ✅ SECURITY DEFINER, validates identity

---

## 🚨 Security Issues Found

### **CRITICAL 1: Missing Authorization Check in Edge Function**

**File:** `supabase/functions/send-role-invite/index.ts:50-66`

**Issue:**
```typescript
// ❌ BAD: No check if user is actually an event manager!
const { error: insertError } = await supabase
  .from("role_invites")
  .insert({
    event_id,
    role,
    invited_by: user.id,  // Any authenticated user can do this!
  });
```

**Risk:** **HIGH**
- Any authenticated user can send invites for ANY event
- They just need to know the event ID
- Could spam invites, impersonate organizers

**Fix:**
```typescript
// ✅ GOOD: Check if user is event manager first
const { data: isManager, error: checkError } = await supabase
  .rpc('is_event_manager', { p_event_id: event_id });

if (checkError || !isManager) {
  return createErrorResponse("Unauthorized: Only event managers can send invites", 403);
}

// Now safe to insert
const { error: insertError } = await supabase
  .from("role_invites")
  .insert({...});
```

---

### **HIGH 1: Weak Token Generation**

**File:** `supabase/functions/send-role-invite/index.ts:35`

**Issue:**
```typescript
// ❌ WEAK: crypto.randomUUID() is predictable if RNG is compromised
const token = crypto.randomUUID().replace(/-/g, "") + 
              crypto.randomUUID().replace(/-/g, "").slice(0, 16);
```

**Risk:**
- UUID v4 has 122 bits of entropy (good)
- But concatenating two truncated UUIDs doesn't add much security
- Standard crypto library should be used

**Fix:**
```typescript
// ✅ GOOD: Use Web Crypto API properly
const tokenBytes = new Uint8Array(32); // 256 bits
crypto.getRandomValues(tokenBytes);
const token = Array.from(tokenBytes)
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');
```

---

### **HIGH 2: No Rate Limiting on Invites**

**File:** `supabase/functions/send-role-invite/index.ts` (missing)

**Issue:**
- No limit on how many invites an organizer can send
- No cooldown between invites
- Could be abused to spam users

**Risk:**
- Organizer could spam thousands of invites
- Email/SMS costs could skyrocket
- Reputational damage (spam complaints)

**Fix:**
```typescript
// Check recent invites from this user
const { data: recentInvites } = await supabase
  .from('role_invites')
  .select('id')
  .eq('invited_by', user.id)
  .gte('created_at', new Date(Date.now() - 3600_000).toISOString()); // Last hour

if (recentInvites && recentInvites.length >= 50) {
  return createErrorResponse("Rate limit exceeded: max 50 invites per hour", 429);
}

// Also check per-event rate limit
const { data: eventInvites } = await supabase
  .from('role_invites')
  .select('id')
  .eq('event_id', event_id)
  .gte('created_at', new Date(Date.now() - 3600_000).toISOString());

if (eventInvites && eventInvites.length >= 20) {
  return createErrorResponse("Rate limit exceeded: max 20 invites per hour per event", 429);
}
```

---

### **HIGH 3: Missing Audit Trail**

**Issue:**
- No record of WHO sent which invites
- Can't track abuse patterns
- Hard to debug invite issues

**Current:** Only `invited_by` field (not logged separately)

**Fix:** Add invite activity to audit log
```sql
-- After invite created:
INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, metadata)
VALUES (
  invited_by,
  'role_invite_sent',
  'role_invite',
  invite_id,
  jsonb_build_object(
    'event_id', event_id,
    'role', role,
    'recipient_email', email,
    'recipient_phone', phone,
    'expires_at', expires_at
  )
);

-- After invite accepted:
INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, metadata)
VALUES (
  accepted_user_id,
  'role_invite_accepted',
  'role_invite',
  invite_id,
  jsonb_build_object(
    'event_id', event_id,
    'role', role
  )
);
```

---

## 🟠 Medium Priority Issues

### **MEDIUM 1: Email/Phone Validation Too Strict**

**File:** `supabase/migrations/20250201090000_add_event_roles_system.sql:332-345`

**Issue:**
```sql
-- Invite validation checks EXACT match
IF lower(v_user_email) != lower(v_inv.email) THEN
  RAISE EXCEPTION 'This invite is addressed to a different email.';
END IF;
```

**Problem:**
- User might have multiple emails
- User might sign up with Google (different email)
- Blocks legitimate use cases

**Recommendation:**
- Allow organizers to "transfer" invite to new email
- Or: Add a "claim invite" flow where user proves identity another way

---

### **MEDIUM 2: No Notification When Invite Expires**

**Issue:**
- Invites silently expire after 72 hours
- Organizer doesn't know
- Invitee might try expired link and get confused

**Fix:** Add Edge Function to send reminders
```typescript
// Cron job: Check expiring invites daily
const { data: expiringInvites } = await supabase
  .from('role_invites')
  .select('*, events(title)')
  .eq('status', 'pending')
  .gte('expires_at', new Date().toISOString())
  .lte('expires_at', new Date(Date.now() + 24 * 3600_000).toISOString());

// Send reminder emails: "Your invite expires in 24 hours!"
```

---

### **MEDIUM 3: RLS Allows Anon to Read role_invites**

**File:** `supabase/migrations/20250201090000_add_event_roles_system.sql:260-264`

**Issue:**
```sql
-- ❌ BAD: Anon can query role_invites
GRANT SELECT ON public.role_invites TO anon;
```

**Risk:**
- Anonymous users can see pending invites (if they know the query)
- Token is exposed in the view!
- Email/phone numbers visible

**Fix:**
```sql
-- ✅ GOOD: Remove anon access
REVOKE SELECT ON public.role_invites FROM anon;

-- Only authenticated users can see their own invites
CREATE POLICY "Users can see invites addressed to them"
  ON events.role_invites
  FOR SELECT
  USING (
    public.is_event_manager(event_id)
    OR (email IS NOT NULL AND email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR (phone IS NOT NULL AND phone = (SELECT phone FROM users.user_profiles WHERE user_id = auth.uid()))
  );
```

---

### **MEDIUM 4: No Maximum Role Limit Per Event**

**Issue:**
- Organizer can invite unlimited scanners
- Could lead to data exposure (all scanners see attendee data)
- No cost control

**Recommendation:**
```sql
-- Add check constraint
ALTER TABLE events.event_roles 
ADD CONSTRAINT max_scanners_per_event 
CHECK (
  (SELECT COUNT(*) FROM events.event_roles 
   WHERE event_id = event_roles.event_id 
   AND role = 'scanner' 
   AND status = 'active') <= 50
);
```

---

## 🔵 Low Priority Issues

### **LOW 1: Invite Token Exposed in URL**

**Issue:**
```
https://app.liventix.app/roles/accept?token=abc123...
```

- Token visible in browser history
- Logged in analytics
- Visible to browser extensions

**Better (but more complex):** Use short-lived codes
```
https://app.liventix.app/roles/accept?code=XY123
// Code maps to token in database, expires in 10 minutes
```

---

### **LOW 2: No Invite Preview**

**Issue:**
- Organizer sends invite, doesn't know what it looks like
- Typo in event name? Too bad!

**Fix:** Add preview button in UI before sending

---

## ✅ What's Working Well

### **Strong Points:**

1. **SECURITY DEFINER Function** ✅
   - `accept_role_invite()` uses SECURITY DEFINER
   - Prevents client-side manipulation
   - Validates all inputs server-side

2. **Email/Phone Validation** ✅
   - Checks match before accepting
   - Prevents invite hijacking

3. **Duplicate Prevention** ✅
   - Unique indexes on email+event and phone+event
   - Revokes duplicates automatically (line 372-381)

4. **Expiration Handling** ✅
   - Time-limited invites
   - Auto-marks as expired on attempt (line 325-329)

5. **RLS on event_roles** ✅
   - Users can only see their own roles
   - Managers can see all roles for their events (line 144-150)

6. **Idempotent Acceptance** ✅
   - `ON CONFLICT DO UPDATE` prevents errors (line 359-362)
   - Graceful "already accepted" handling (line 312-318)

---

## 🔧 Recommended Fixes (Priority Order)

### **Must Fix (This Sprint):**

1. **Add authorization check to send-role-invite Edge Function**
   - Validate `is_event_manager()` before allowing invite
   - **Impact:** Prevents unauthorized invites (critical security)
   - **Effort:** 15 minutes

2. **Remove anon access to role_invites**
   - Revoke SELECT from anon
   - Add policy for users to see their own invites
   - **Impact:** Prevents token exposure
   - **Effort:** 10 minutes

---

### **Should Fix (Next Sprint):**

3. **Add rate limiting to invite sending**
   - 50/hour per user, 20/hour per event
   - **Impact:** Prevents spam, controls costs
   - **Effort:** 30 minutes

4. **Improve token generation**
   - Use `crypto.getRandomValues()` properly
   - **Impact:** Stronger security
   - **Effort:** 10 minutes

5. **Add audit logging**
   - Log invite sent/accepted to `audit_log`
   - **Impact:** Better debugging, accountability
   - **Effort:** 20 minutes

---

### **Nice to Have (Future):**

6. **Add expiration reminders**
7. **Add invite preview**
8. **Add max role limits per event**

---

## 📊 Integration with Option B (Platform Admin)

### **How Platform Admin Enhances Invite System:**

```typescript
// Platform admin can:

// 1. View ALL invites (for support)
SELECT * FROM events.role_invites 
WHERE public.is_platform_admin() = true;

// 2. Manually create role without invite (emergency)
INSERT INTO events.event_roles (event_id, user_id, role, status, created_by)
VALUES ('event-123', 'user-456', 'scanner', 'active', auth.uid())
WHERE public.is_platform_admin() = true;

// 3. Revoke problematic invites
UPDATE events.role_invites 
SET status = 'revoked'
WHERE id = 'invite-789'
  AND public.is_platform_admin() = true;

// 4. View audit trail of all invites
SELECT * FROM public.audit_log
WHERE action IN ('role_invite_sent', 'role_invite_accepted')
  AND public.is_platform_admin() = true;
```

### **Recommended Policy Updates for Platform Admin:**

```sql
-- Platform admins can see all invites
CREATE POLICY "Platform admins see all invites"
  ON events.role_invites
  FOR SELECT
  USING (
    public.is_event_manager(event_id)
    OR public.is_platform_admin()  -- ← Add this
  );

-- Platform admins can manage any role
CREATE POLICY "Platform admins manage all roles"
  ON events.event_roles
  FOR ALL
  USING (
    public.is_event_manager(event_id)
    OR public.is_platform_admin()  -- ← Add this
  )
  WITH CHECK (
    public.is_event_manager(event_id)
    OR public.is_platform_admin()  -- ← Add this
  );
```

---

## 📝 Implementation Plan

### **Phase 1: Critical Fixes (1-2 hours)**

```typescript
// Fix 1: Add auth check to Edge Function
// File: supabase/functions/send-role-invite/index.ts

// After line 48, add:
const { data: isManager } = await supabase
  .rpc('is_event_manager', { p_event_id: event_id });

if (!isManager) {
  return createErrorResponse("Unauthorized", 403);
}
```

```sql
-- Fix 2: Remove anon access
-- New migration: 20251109110000_secure_role_invites.sql

REVOKE SELECT ON public.role_invites FROM anon;

-- Add user-specific policy
CREATE POLICY "Users can see invites for their events or addressed to them"
  ON events.role_invites
  FOR SELECT
  USING (
    public.is_event_manager(event_id)
    OR (
      auth.uid() IS NOT NULL 
      AND (
        (email IS NOT NULL AND email = (SELECT email FROM auth.users WHERE id = auth.uid()))
        OR (phone IS NOT NULL AND phone = (SELECT phone FROM users.user_profiles WHERE user_id = auth.uid()))
      )
    )
    OR public.is_platform_admin()  -- For Option B
  );
```

---

### **Phase 2: Rate Limiting (30 minutes)**

Create new Edge Function middleware:

```typescript
// File: supabase/functions/_shared/rateLimiting.ts

export async function checkInviteRateLimit(
  supabase: any,
  userId: string,
  eventId: string
): Promise<{ allowed: boolean; message?: string }> {
  // Check user rate limit (50/hour)
  const { data: userInvites } = await supabase
    .from('role_invites')
    .select('id')
    .eq('invited_by', userId)
    .gte('created_at', new Date(Date.now() - 3600_000).toISOString());

  if (userInvites && userInvites.length >= 50) {
    return { allowed: false, message: "Rate limit: 50 invites/hour" };
  }

  // Check event rate limit (20/hour)
  const { data: eventInvites } = await supabase
    .from('role_invites')
    .select('id')
    .eq('event_id', eventId)
    .gte('created_at', new Date(Date.now() - 3600_000).toISOString());

  if (eventInvites && eventInvites.length >= 20) {
    return { allowed: false, message: "Rate limit: 20 invites/hour per event" };
  }

  return { allowed: true };
}
```

---

### **Phase 3: Audit Logging (20 minutes)**

Update `accept_role_invite()` function:

```sql
-- After line 369, add audit log:
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
    'role', v_role,
    'invite_email', v_inv.email,
    'invite_phone', v_inv.phone,
    'invited_by', v_inv.invited_by
  )
);
```

---

## 🎯 Final Verdict

### **Current State:**

**Security:** B+ (Good foundation, some gaps)  
**Usability:** A- (Smooth flow, good UX)  
**Maintainability:** B+ (Clear code, could use more logging)

### **After Fixes:**

**Security:** A (Production-ready)  
**Usability:** A- (No UX changes needed)  
**Maintainability:** A (Audit trail complete)

---

## 🤝 Relationship to Platform Admin Decision

**Recommendation:** **Choose Option B** (Implement Platform Admins)

**Why it matters for invites:**
1. ✅ Platform admins can troubleshoot invite issues
2. ✅ Platform admins can manually grant roles (support)
3. ✅ Platform admins can revoke abusive invites
4. ✅ Platform admins can view full audit trail

**They are complementary, not conflicting:**
- **Platform Admin** = system-wide operations
- **Event Manager** = sends invites for their events
- **Event Roles** = accepts invites, gets limited permissions

---

## 📞 Next Steps

1. **Review this audit with your team**
2. **Decide on Option B** (Platform Admin) - I recommend YES
3. **Implement Phase 1 critical fixes** (2 hours)
4. **Test invite flow end-to-end**
5. **Deploy Phase 1 fixes**
6. **Schedule Phase 2 & 3** for next sprint

---

**Questions?** Review sections marked with 🚨 for critical items.

**Ready to fix?** Start with Phase 1 - I can help implement these changes! 🚀

