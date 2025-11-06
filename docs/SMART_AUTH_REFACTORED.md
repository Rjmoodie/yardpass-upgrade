# 🎯 Smart Auth - Refactored for Guest vs Organic Flows

## What Changed

The auth system has been refactored to **explicitly distinguish** between:
1. **Guest Checkout Users** - Bought tickets, passwordless reaccess
2. **Organic Signup Users** - Intentionally signed up, may have password

## Key Improvements

### 1. ✅ MagicLinkMode Type System

```typescript
type MagicLinkMode = 
  | 'guest-login'       // Guest reaccess (NO user creation)
  | 'passwordless-login' // Organic passwordless reaccess
  | 'signup';            // New organic signup (CREATE user)
```

### 2. ✅ Critical Fix: `shouldCreateUser`

**BEFORE (BROKEN)**:
```typescript
// ❌ Would FAIL for new signups!
shouldCreateUser: false  // Always
```

**AFTER (FIXED)**:
```typescript
// ✅ Only create user for signup, NOT for reaccess
const isLogin = mode === 'guest-login' || mode === 'passwordless-login';
shouldCreateUser: !isLogin
```

### 3. ✅ Safer Fallback

**BEFORE**:
```typescript
// ❌ Could accidentally treat new users as guests
return 'guest';
```

**AFTER**:
```typescript
// ✅ Safer: treat unknowns as new users
return 'new';
```

### 4. ✅ Mode Parameter in Callback

Magic links now include mode in URL:
```
/auth/callback?mode=guest-login
/auth/callback?mode=signup
/auth/callback?mode=passwordless-login
```

This allows differentiated handling after authentication.

---

## User Flows

### Flow 1: Guest Checkout User Reaccesses

```mermaid
User bought ticket → Enter email → System detects 'guest' 
  → sendMagicLink(email, 'guest-login', shouldCreateUser: FALSE)
  → Click link → Authenticated → See tickets
```

**Key Points**:
- ✅ NO user creation attempted
- ✅ Uses existing auth user from checkout
- ✅ Profile already exists (created at checkout)
- ✅ Copy: "We sent a link so you can access your tickets"

### Flow 2: Organic Signup (New User)

```mermaid
New user → Enter email → System detects 'new' → Go to signup
  → Enter display_name → sendMagicLink(email, 'signup', {display_name}, shouldCreateUser: TRUE)
  → Click link → User CREATED → Profile created via AuthContext
  → Authenticated → See dashboard
```

**Key Points**:
- ✅ User created on magic link click
- ✅ `display_name` passed as user_metadata
- ✅ Profile created automatically in `AuthContext.tsx`
- ✅ Copy: "We sent you a magic link to sign in instantly"

### Flow 3: Password User Reaccesses

```mermaid
Existing user → Enter email → System detects 'password'
  → Show password field → Enter password → Authenticated
  → OR click "magic link instead" → sendMagicLink(email, 'passwordless-login')
```

**Key Points**:
- ✅ Password is primary method
- ✅ Magic link option available
- ✅ NO user creation (existing account)

---

## Code Changes

### SmartAuthModal.tsx

**Type Definitions**:
```typescript
type MagicLinkMode = 'guest-login' | 'passwordless-login' | 'signup';
```

**Account Detection**:
```typescript
const type = await checkAccountType(email);

if (type === 'password') {
  setStep('password-entry');  // Show password field
} else if (type === 'guest') {
  await sendMagicLink(email, 'guest-login');  // Reaccess, no creation
} else {
  setStep('signup');  // New user
}
```

**Magic Link Sending**:
```typescript
const sendMagicLink = async (
  email: string,
  mode: MagicLinkMode,
  extraData?: Record<string, any>
) => {
  const isLogin = mode === 'guest-login' || mode === 'passwordless-login';
  
  await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: !isLogin,  // ✅ CRITICAL FIX
      emailRedirectTo: `${window.location.origin}/auth/callback?mode=${mode}`,
      data: extraData,  // display_name for signup
    }
  });
};
```

**Signup Handler**:
```typescript
const handleSignUp = async () => {
  await sendMagicLink(email, 'signup', {
    display_name: displayName,  // ✅ Pass to user_metadata
  });
  // Profile created automatically after link click
};
```

### AuthContext.tsx

**Profile Creation on New User**:
```typescript
if (isNewUser) {
  console.log('🆕 New user detected - creating profile');
  
  const displayName = session.user.user_metadata?.display_name || 'User';
  const createdVia = session.user.user_metadata?.created_via;
  
  await supabase.from('user_profiles').upsert({
    user_id: session.user.id,
    display_name: displayName,  // ✅ From magic link metadata
    email: session.user.email,
    role: 'attendee',
  });
}
```

---

## UX Differences

### Magic Link Copy

| Account Type | Email Copy |
|--------------|-----------|
| **Guest** | "We sent a link so you can access your tickets as user@example.com" |
| **Organic/New** | "We sent a sign-in link to user@example.com" |

### Resend Logic

```typescript
const mode: MagicLinkMode = accountType === 'guest'
  ? 'guest-login'
  : accountType === 'new'
  ? 'signup'
  : 'passwordless-login';

sendMagicLink(email, mode);
```

---

## Testing Checklist

### Test 1: Guest Purchaser Reaccess
- [ ] Sign out
- [ ] Enter `roderickmoodie@yahoo.com`
- [ ] Should see: "Check your email" (guest copy)
- [ ] Console shows: `mode: guest-login`, `shouldCreateUser: false`
- [ ] Magic link works
- [ ] No duplicate user created

### Test 2: New User Signup
- [ ] Enter new email (e.g., `test123@example.com`)
- [ ] Should see: "Create your account"
- [ ] Enter display name
- [ ] Should see: "Check your email" (signup copy)
- [ ] Console shows: `mode: signup`, `shouldCreateUser: true`
- [ ] Magic link works
- [ ] User created with display_name
- [ ] Profile created automatically

### Test 3: Password User
- [ ] Enter email with password
- [ ] Should see: Password field
- [ ] Can sign in with password
- [ ] Can click "Send me a magic link instead"
- [ ] Magic link uses `passwordless-login` mode

### Test 4: Resend Magic Link
- [ ] On "Check your email" screen
- [ ] Click "resend"
- [ ] Correct mode used based on account type
- [ ] New email received

---

## Console Logs to Watch

### Guest Reaccess
```
🔍 Checking account type for: roderickmoodie@yahoo.com
✅ Account detection result: {exists: true, has_password: false, account_type: "guest"}
✨ Guest/passwordless user detected
📧 Sending magic link to: roderickmoodie@yahoo.com (mode: guest-login)
✉️ Magic link sent successfully (mode: guest-login)
```

### New Signup
```
🔍 Checking account type for: test123@example.com
✅ Account detection result: {exists: false}
🆕 New user - needs signup
🆕 Creating new account for: test123@example.com
📧 Sending magic link to: test123@example.com (mode: signup)
✉️ Magic link sent successfully (mode: signup)

// After clicking link:
🆕 New user detected - creating profile
📝 Creating profile with: {displayName: "Test User", createdVia: null, email: "test123@example.com"}
✅ Profile created successfully
```

---

## Database State

### Guest Checkout User
```sql
-- auth.users
{
  email: "roderickmoodie@yahoo.com",
  encrypted_password: NULL,  -- ✅ No password
  user_metadata: {
    created_via: "guest_checkout"
  }
}

-- user_profiles (created at checkout)
{
  user_id: "...",
  display_name: "User",
  email: "roderickmoodie@yahoo.com"
}
```

### Organic Signup User
```sql
-- auth.users
{
  email: "test123@example.com",
  encrypted_password: NULL,  -- Passwordless by default
  user_metadata: {
    display_name: "Test User"  -- ✅ From signup form
  }
}

-- user_profiles (created by AuthContext)
{
  user_id: "...",
  display_name: "Test User",  -- ✅ From user_metadata
  email: "test123@example.com"
}
```

---

## Migration Notes

### Breaking Changes
None! The old `AuthExperience` still exists as fallback.

### Rollback
If issues arise:
1. Revert `AuthModal.tsx` and `AuthPage.tsx`
2. Use old `AuthExperience` component
3. Old flow still works

### Future Enhancements
- [ ] Read `mode` parameter in `/auth/callback` for specific handling
- [ ] Add analytics tracking per mode
- [ ] Different onboarding flows per account type
- [ ] Progressive profile completion for guests

---

## Summary

**Before**: One-size-fits-all magic link flow with `shouldCreateUser: false` everywhere (broken for new signups).

**After**: Three explicit flows with correct `shouldCreateUser` logic:
- `guest-login`: Existing guest, NO creation
- `signup`: New user, CREATE user
- `passwordless-login`: Existing organic user, NO creation

This aligns perfectly with the two user archetypes:
1. **Guest checkout** → Passwordless reaccess
2. **Organic signup** → Passwordless or password, intentional account creation

