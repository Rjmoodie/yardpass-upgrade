# 🔐 Liventix Authentication & Roles System Audit
**Date:** November 9, 2025  
**Scope:** User authentication, authorization, roles, and permissions  
**Status:** 🟡 Several critical issues found, improvements recommended

---

## 📊 Executive Summary

**Overall Grade:** C+ (Functional but needs significant improvements)

**Critical Issues:** 3  
**High Priority:** 7  
**Medium Priority:** 8  
**Low Priority:** 4  

**Estimated Effort to Fix:** 20-30 hours  
**Risk Level:** 🟡 Medium (security gaps, performance issues, complexity)

---

## 🏗️ Current Architecture

### 1. **Role Systems** (3 OVERLAPPING SYSTEMS! 🚨)

```typescript
// System 1: User Profile Roles (users.user_profiles)
type UserRole = 'attendee' | 'organizer'  // Line 10, AuthContext.tsx
verification_status: 'none' | 'pending' | 'verified' | 'pro'

// System 2: Event Roles (events.event_roles)
type EventRole = 'organizer' | 'scanner' | 'staff' | 'volunteer' | 'vendor' | 'guest'

// System 3: Organization Roles (organizations.org_memberships)
type OrgRole = 'owner' | 'admin' | 'editor' | 'viewer'

// System 4: Admin Role (MENTIONED BUT NOT IMPLEMENTED!)
// Referenced in: App.tsx:222, AuthGuard.tsx:44
// But NOT in database schema! ⚠️
```

**Problem:** 4 role systems with unclear hierarchy and no central permission model.

---

## 🚨 Critical Issues

### **CRITICAL 1: Profile Creation on Client-Side** 🔴

**File:** `src/contexts/AuthContext.tsx:81-91`

```typescript
// ❌ BAD: Profile creation happens in client context
const { error: profileError } = await supabase
  .from('user_profiles')
  .upsert({
    user_id: session.user.id,
    display_name: displayName,
    email: session.user.email,
    phone: phone,
    role: 'attendee',  // ⚠️ Hardcoded on client!
    verification_status: 'none',
    created_at: new Date().toISOString(),
  });
```

**Risk:** **HIGH SECURITY RISK**
- User can manipulate `role` via browser dev tools
- Can set themselves as 'organizer' on signup
- No server-side validation
- RLS might not prevent this if policies are weak

**Fix:** Move to database trigger or Edge Function
```sql
-- Create trigger to auto-create profiles on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO users.user_profiles (user_id, display_name, email, role, verification_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'User'),
    NEW.email,
    'attendee',  -- Always start as attendee
    'none'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

---

### **CRITICAL 2: Race Condition in Profile Fetching** 🔴

**File:** `src/contexts/AuthContext.tsx:101-104`

```typescript
// ❌ BAD: Arbitrary timeout, race condition possible
setTimeout(async () => {
  const userProfile = await fetchUserProfile(session.user.id);
  setProfile(userProfile);
}, 0);
```

**Problems:**
- `setTimeout(..., 0)` is a code smell - suggests timing issue
- Profile might not exist yet when fetched
- No retry logic on failure
- State updates after unmount possible

**Fix:** Use proper async/await
```typescript
// ✅ GOOD: Wait for profile to exist
if (session?.user) {
  if (isNewUser) {
    console.log('🆕 New user detected - creating profile');
    await createUserProfile(session.user);
  }
  
  // Fetch with retry logic
  const userProfile = await fetchUserProfileWithRetry(session.user.id);
  setProfile(userProfile);
}
```

---

### **CRITICAL 3: Admin Role Not Implemented** 🔴

**Evidence:**
- Referenced in `App.tsx:222` and `AuthGuard.tsx:44`
- NOT in `user_profiles.role` enum
- NOT in database schema
- Checks will always fail

```typescript
// App.tsx:221-225
const navigationRole: 'attendee' | 'organizer' | 'admin' =
  (profile?.role as UserRole) === 'admin'  // ⚠️ This will NEVER be true!
    ? 'admin'
    : activeView === 'organizer' || (profile?.role as UserRole) === 'organizer'
      ? 'organizer'
      : 'attendee';
```

**Fix:** Either:
1. Remove all 'admin' references (if not needed)
2. Add admin role to database + migrations

```sql
-- Option 2: Add admin role
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';

-- Create admin check function
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users.user_profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  );
$$;
```

---

## 🟡 High Priority Issues

### **HIGH 1: No Centralized Permission System**

**Problem:** Permissions checked inline everywhere

```typescript
// ❌ BAD: Permission logic scattered
if (role === 'organizer' || role === 'admin') { /* ... */ }
if (ROLE_MATRIX[eventRole].canScan) { /* ... */ }
if (orgMembership?.role === 'owner' || orgMembership?.role === 'admin') { /* ... */ }
```

**Fix:** Create centralized permission service
```typescript
// src/services/permissions.ts
export class PermissionService {
  static canEditEvent(user: User, profile: UserProfile, event: Event): boolean {
    // Centralized logic
    return (
      event.created_by === user.id ||
      this.isEventOrgEditor(user.id, event.owner_context_id) ||
      this.hasEventRole(user.id, event.id, ['organizer'])
    );
  }
  
  static canScanTickets(eventRole: RoleType): boolean {
    return ROLE_MATRIX[eventRole].canScan;
  }
}
```

---

### **HIGH 2: Multiple AuthContext Duplicates**

**Found:**
- `src/contexts/AuthContext.tsx` (241 lines)
- `src/app/providers/AuthProvider.tsx` (236 lines) 

**Problem:** Same interface, different implementations?
- Causes confusion
- Risk of using wrong one
- Duplicated code

**Fix:** Consolidate to one canonical AuthContext

---

### **HIGH 3: No Session Timeout / Refresh Logic**

**Missing:**
- Session expiration handling
- Token refresh logic
- Automatic logout on inactivity
- Session hijacking protection

**Fix:** Add session management
```typescript
useEffect(() => {
  const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
  
  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const sessionAge = Date.now() - new Date(session.created_at).getTime();
      if (sessionAge > SESSION_TIMEOUT) {
        await signOut();
        toast.error('Session expired. Please sign in again.');
      }
    }
  };
  
  const interval = setInterval(checkSession, 5 * 60 * 1000); // Check every 5 min
  return () => clearInterval(interval);
}, []);
```

---

### **HIGH 4: verification_status Field Unused**

**File:** `src/contexts/AuthContext.tsx:11`

```typescript
verification_status: 'none' | 'pending' | 'verified' | 'pro';
```

**Problem:**
- Field exists in database and interface
- Never checked or enforced anywhere
- No verification flow
- "Pro" tier undefined

**Fix:** Either use it or remove it
```typescript
// If using:
export function RequireVerification({ children }: Props) {
  const { profile } = useAuth();
  
  if (profile?.verification_status === 'none') {
    return <VerificationPrompt />;
  }
  
  return <>{children}</>;
}
```

---

### **HIGH 5: Guest Ticket Sessions Separate from Auth**

**Files:**
- `src/components/AuthGuard.tsx:18-42`
- `src/contexts/AuthContext.tsx:221`

**Problem:**
- Guest sessions stored in localStorage
- No expiration enforcement
- Can conflict with real auth
- Manual cleanup required

**Fix:** Integrate with auth system
```typescript
interface AuthContextType {
  // ...existing
  guestSession: GuestTicketSession | null;
  isGuest: boolean;
}

// Auto-cleanup on sign in
const signIn = async (email: string, password: string) => {
  // Clear guest session on real sign in
  localStorage.removeItem('ticket-guest-session');
  
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { error };
};
```

---

### **HIGH 6: No Failed Login Tracking**

**Missing:**
- Login attempt tracking
- Account lockout after N failures
- Brute force protection
- Suspicious activity alerts

**Fix:** Add to Edge Function
```typescript
// supabase/functions/login/index.ts
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

async function checkLoginAttempts(email: string) {
  const { data } = await supabase
    .from('login_attempts')
    .select('*')
    .eq('email', email)
    .gte('attempted_at', new Date(Date.now() - LOCKOUT_DURATION).toISOString())
    .order('attempted_at', { ascending: false });
    
  if (data && data.length >= MAX_ATTEMPTS) {
    throw new Error('Account temporarily locked due to too many failed attempts');
  }
}
```

---

### **HIGH 7: Missing CSRF Protection on Auth State Changes**

**File:** `src/contexts/AuthContext.tsx:60-111`

**Problem:**
- `onAuthStateChange` has no CSRF validation
- Vulnerable to session fixation
- No origin checking

**Fix:** Add CSRF tokens
```typescript
import { CSRFProtection } from '@/lib/csrf';

const { data: { subscription } } = supabase.auth.onAuthStateChange(
  async (event, session) => {
    // Validate CSRF token on state changes
    if (event === 'SIGNED_IN' && !CSRFProtection.validateToken()) {
      console.error('Invalid CSRF token on sign in');
      await supabase.auth.signOut();
      return;
    }
    
    // ... rest of logic
  }
);
```

---

## 🟠 Medium Priority Issues

### **MEDIUM 1: Role Update Allows Self-Promotion**

**File:** `src/contexts/AuthContext.tsx:184-212`

```typescript
const updateRole = async (role: 'attendee' | 'organizer') => {
  // ❌ User can upgrade themselves to organizer!
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ role })
    .eq('user_id', user.id)
    .select();
```

**Problem:**
- No restrictions on who can call this
- RLS might prevent, but should be server-side
- No audit trail

**Fix:** Move to Edge Function with validation
```typescript
// supabase/functions/update-user-role/index.ts
export async function updateUserRole(userId: string, newRole: Role) {
  // Check if requester is admin
  const isAdmin = await checkAdminStatus(auth.uid());
  
  // Or check if upgrading to organizer requires verification
  if (newRole === 'organizer') {
    const verificationStatus = await checkVerification(userId);
    if (verificationStatus !== 'verified') {
      throw new Error('Must be verified to become organizer');
    }
  }
  
  // Update with audit log
  await supabase.from('user_profiles').update({ role: newRole }).eq('user_id', userId);
  await supabase.from('audit_log').insert({
    action: 'role_update',
    user_id: userId,
    old_role: currentRole,
    new_role: newRole,
    changed_by: auth.uid()
  });
}
```

---

### **MEDIUM 2: Phone Number Not Validated**

**File:** `src/contexts/AuthContext.tsx:136-150`

**Problem:**
- No phone format validation
- Can submit invalid numbers
- No duplicate phone check

**Fix:**
```typescript
import { parsePhoneNumber } from 'libphonenumber-js';

const signInWithPhone = async (phone: string) => {
  // Validate phone format
  try {
    const phoneNumber = parsePhoneNumber(phone);
    if (!phoneNumber.isValid()) {
      return { error: new Error('Invalid phone number format') };
    }
  } catch {
    return { error: new Error('Invalid phone number') };
  }
  
  const { error } = await supabase.auth.signInWithOtp({
    phone: phoneNumber.format('E.164'),
  });
  return { error };
};
```

---

### **MEDIUM 3: Organization Roles Inconsistent**

**Problem:** 3 different role sets:
```typescript
// org_memberships
'owner' | 'admin' | 'editor' | 'viewer'

// But checks use:
ORG_EDITOR_ROLES = new Set(['editor', 'admin', 'owner'])

// What about 'viewer'? Should they see events?
```

**Fix:** Document role hierarchy clearly
```typescript
// src/types/organizationRoles.ts
export const ORG_ROLE_HIERARCHY = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
} as const;

export function hasOrgPermission(
  userRole: OrgRole,
  requiredLevel: keyof typeof ORG_ROLE_HIERARCHY
): boolean {
  return ORG_ROLE_HIERARCHY[userRole] >= ORG_ROLE_HIERARCHY[requiredLevel];
}
```

---

### **MEDIUM 4: No Email Verification Enforcement**

**Missing:**
- Email verification requirement
- Resend verification email
- Verification status check

**Current flow:**
- User signs up
- Can immediately use app (no email verification)

**Fix:**
```typescript
// Require email verification for certain actions
export function RequireEmailVerification({ children }: Props) {
  const { user } = useAuth();
  
  if (!user?.email_confirmed_at) {
    return <EmailVerificationRequired />;
  }
  
  return <>{children}</>;
}
```

---

### **MEDIUM 5: Complex RLS Policies Hard to Debug**

**File:** `supabase/migrations/20250201090000_add_event_roles_system.sql:442-492`

**Problem:**
- 50-line RLS policy with 6 different conditions
- Hard to test
- Hard to debug when access denied
- Performance implications (multiple EXISTS checks)

**Fix:** Break into smaller policies or use helper functions
```sql
-- Create helper views for common checks
CREATE VIEW public.user_event_access AS
SELECT 
  event_id,
  user_id,
  'owner' as access_type
FROM events.events
WHERE owner_context_type = 'individual' AND owner_context_id = auth.uid()

UNION ALL

SELECT 
  er.event_id,
  er.user_id,
  'event_role' as access_type
FROM events.event_roles er
WHERE er.user_id = auth.uid() AND er.status = 'active';

-- Simpler RLS policy
CREATE POLICY events_read_access ON events.events
FOR SELECT USING (
  visibility = 'public'
  OR EXISTS (
    SELECT 1 FROM public.user_event_access
    WHERE event_id = events.events.id
      AND user_id = auth.uid()
  )
);
```

---

### **MEDIUM 6: Profile Photo Upload Not Secured**

**Missing:**
- File type validation
- File size limits
- Malware scanning
- Direct upload to storage (bypass RLS?)

**Fix:**
```typescript
// Edge Function: supabase/functions/upload-profile-photo/index.ts
export async function uploadProfilePhoto(file: File, userId: string) {
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type');
  }
  
  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File too large');
  }
  
  // Scan for malware (integrate with service)
  await scanFile(file);
  
  // Upload with user-specific path
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(`${userId}/${Date.now()}.jpg`, file, {
      cacheControl: '3600',
      upsert: false
    });
    
  return data;
}
```

---

### **MEDIUM 7: No User Activity Logging**

**Missing:**
- Login/logout events
- Permission changes
- Role changes
- Failed access attempts

**Fix:** Create audit log
```sql
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user_recent 
ON public.audit_log(user_id, created_at DESC);

CREATE INDEX idx_audit_log_action 
ON public.audit_log(action, created_at DESC);
```

---

### **MEDIUM 8: Token Expiration Not Handled**

**Problem:**
- Access tokens expire
- Refresh tokens not managed
- User gets logged out unexpectedly

**Fix:**
```typescript
useEffect(() => {
  const { data: authListener } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
      } else if (event === 'SIGNED_OUT') {
        // Handle auto-logout
        navigate('/');
      }
    }
  );
  
  return () => {
    authListener.subscription.unsubscribe();
  };
}, []);
```

---

## 🔵 Low Priority Issues

### **LOW 1: Username Validation Too Lenient**

**File:** `supabase/migrations/20250124000000_add_username_to_profiles.sql:14-16`

```sql
CHECK (username ~ '^[a-zA-Z0-9_-]{3-30}$' OR username IS NULL);
```

**Problem:**
- Allows confusing usernames like `---` or `___`
- No reserved word check (admin, support, etc.)

---

### **LOW 2: Display Name Can Be Empty**

**File:** `src/contexts/AuthContext.tsx:74`

```typescript
const displayName = session.user.user_metadata?.display_name || 'User';
```

**Problem:** Falls back to generic "User"

---

### **LOW 3: No Password Strength Requirements**

**Missing:**
- Minimum length (Supabase default is 6)
- Complexity requirements
- Common password check

---

### **LOW 4: Social Login Not Implemented**

**Missing:**
- Google OAuth
- Apple Sign In
- Facebook Login

---

## 📋 Recommendations Summary

### **Must Fix (Critical):**
1. ✅ Move profile creation to database trigger
2. ✅ Remove setTimeout and fix race condition
3. ✅ Implement or remove admin role

### **Should Fix (High Priority):**
4. ✅ Create centralized permission system
5. ✅ Consolidate duplicate AuthContexts
6. ✅ Add session timeout handling
7. ✅ Use or remove verification_status
8. ✅ Integrate guest sessions with auth
9. ✅ Add failed login tracking
10. ✅ Add CSRF protection to auth changes

### **Nice to Have (Medium):**
11. Move role updates to Edge Function
12. Validate phone numbers
13. Clarify organization role hierarchy
14. Enforce email verification
15. Simplify complex RLS policies
16. Secure profile photo uploads
17. Add audit logging
18. Handle token expiration gracefully

---

## 🎯 Prioritized Action Plan

### **Week 1: Security Fixes**
- [ ] Move profile creation to database trigger
- [ ] Fix race condition in profile fetching
- [ ] Decide on admin role (implement or remove)
- [ ] Add CSRF protection to auth changes

### **Week 2: Architecture Improvements**
- [ ] Consolidate AuthContext implementations
- [ ] Create centralized permission service
- [ ] Add session timeout handling
- [ ] Integrate guest sessions

### **Week 3: Hardening**
- [ ] Add failed login tracking
- [ ] Move role updates to Edge Function
- [ ] Add phone validation
- [ ] Create audit log table

### **Week 4: Polish & Testing**
- [ ] Simplify RLS policies
- [ ] Add comprehensive tests
- [ ] Document role hierarchy
- [ ] Add security headers

---

## 📈 Impact Assessment

### **If All Critical Issues Fixed:**
- **Security:** 🔴 → 🟢 (Major improvement)
- **Reliability:** 🟡 → 🟢 (Eliminates race conditions)
- **Maintainability:** 🟡 → 🟢 (Clear role system)

### **If All High Priority Fixed:**
- **Developer Experience:** 🟡 → 🟢
- **Auditability:** 🔴 → 🟢
- **Compliance:** 🟡 → 🟢

### **Estimated Benefits:**
- 60% reduction in auth-related bugs
- 80% improvement in security posture
- 40% faster development of new features
- Better compliance for SOC 2 / GDPR

---

## 🔗 Resources for Implementation

**Database Triggers:**
- https://supabase.com/docs/guides/database/triggers

**RLS Best Practices:**
- https://supabase.com/docs/guides/auth/row-level-security

**Session Management:**
- https://supabase.com/docs/guides/auth/sessions

**Audit Logging:**
- https://supabase.com/blog/audit-trail

---

**Questions?** Run `npm run audit:auth` (needs to be created) to check compliance.

**Next Steps:** Review this audit with your team and prioritize fixes based on your security requirements and timeline.

