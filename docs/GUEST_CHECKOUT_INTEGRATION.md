# 🎟️ Guest Checkout Integration - Complete Guide

## Overview

**Question**: Does the guest-checkout Edge Function need to be updated?

**Answer**: **NO!** The guest-checkout function is already perfect. It sets `created_via: "guest_checkout"` which is exactly what we need.

What DID need updating was the `check_user_auth_method` RPC function to **read and use** that metadata.

---

## What Was Already Working ✅

### guest-checkout Edge Function
```typescript
// Already sets the critical metadata!
await supabaseService.auth.admin.createUser({
  email: normalizedEmail,
  email_confirm: true,
  user_metadata: {
    created_via: "guest_checkout",  // ✅ Perfect!
    guest_checkout_at: new Date().toISOString(),
  },
  app_metadata: {
    roles: ["guest"],
  },
});
```

**Status**: ✅ No changes needed

---

## What We Fixed ✅

### 1. Enhanced `check_user_auth_method` RPC

**Migration**: `20250115000001_enhance_check_user_auth_method.sql`

**Changes**:
```sql
-- Before: Only returned has_password
-- After: Returns richer account type

RETURN jsonb_build_object(
  'exists', true,
  'has_password', v_has_password,
  'account_type', v_account_type,  -- ✅ NEW: 'guest-checkout' | 'organic-passwordless' | 'password'
  'created_via', v_created_via,    -- ✅ NEW: From user_metadata
  'is_guest_checkout', true/false  -- ✅ NEW: Boolean flag
);
```

**Logic**:
```sql
IF v_has_password THEN
  v_account_type := 'password';
ELSIF v_created_via = 'guest_checkout' THEN
  v_account_type := 'guest-checkout';  -- ✅ Explicit!
ELSE
  v_account_type := 'organic-passwordless';
END IF;
```

---

### 2. Updated SmartAuthModal Type System

**New AccountType**:
```typescript
// Before: 'guest' | 'password' | 'new'
// After:
type AccountType = 
  | 'guest-checkout'       // ✅ Ticket buyer, created via guest-checkout
  | 'organic-passwordless' // ✅ Signed up organically, no password yet
  | 'password'             // Has password
  | 'new';                 // Doesn't exist yet
```

---

### 3. All the Improvements You Requested

#### ✅ 1. Guest vs Organic Distinction
```typescript
if (type === 'guest-checkout') {
  // Ticket buyer - show "access your tickets" copy
  await sendMagicLink(email, 'guest-login');
} else if (type === 'organic-passwordless') {
  // Organic signup - show "sign in" copy
  await sendMagicLink(email, 'passwordless-login');
}
```

#### ✅ 2. Phone OTP Verification
```typescript
// New step: 'phone-otp-entry'
const handleVerifyPhoneOtp = async (e) => {
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token: otp,
    type: 'sms',
  });
  // ...
};
```

UI includes:
- 6-digit OTP input field
- Auto-format to digits only
- Resend code button
- Go back option

#### ✅ 3. State Reset on Modal Open
```typescript
useEffect(() => {
  if (isOpen) {
    // Reset all state when modal opens
    setMethod('email');
    setStep('email-entry');
    setEmail('');
    // ... etc
  }
}, [isOpen]);
```

#### ✅ 4. Better Resend Error Handling
```typescript
onClick={async () => {
  try {
    await sendMagicLink(email, mode);
  } catch (error: any) {
    toast({
      title: 'Error',
      description: error?.message ?? 'Unable to resend link.',
      variant: 'destructive',
    });
  }
}}
```

#### ✅ 5. Email Normalization
```typescript
const normalizedEmail = email.trim().toLowerCase();
const type = await checkAccountType(normalizedEmail);
```

---

## How It Works Now

### User Type 1: Guest Checkout Purchaser

**Database State**:
```sql
-- auth.users
{
  email: "buyer@example.com",
  encrypted_password: NULL,
  user_metadata: {
    created_via: "guest_checkout"  -- ✅ Set by guest-checkout
  }
}
```

**Auth Flow**:
```
1. User enters email
2. check_user_auth_method returns:
   {
     account_type: "guest-checkout",
     is_guest_checkout: true,
     created_via: "guest_checkout"
   }
3. SmartAuthModal detects: 'guest-checkout'
4. Shows: "We sent a link so you can access your tickets"
5. Sends magic link with shouldCreateUser: false
```

### User Type 2: Organic Signup (Passwordless)

**Database State**:
```sql
-- auth.users
{
  email: "newuser@example.com",
  encrypted_password: NULL,
  user_metadata: {
    display_name: "John Doe"
    // No created_via
  }
}
```

**Auth Flow**:
```
1. User enters email
2. check_user_auth_method returns:
   {
     account_type: "organic-passwordless",
     is_guest_checkout: false,
     created_via: null
   }
3. SmartAuthModal detects: 'organic-passwordless'
4. Shows: "We sent a sign-in link"
5. Sends magic link with shouldCreateUser: false
```

---

## Testing the Integration

### Test 1: Guest Checkout User
```bash
# Run enhanced migration
psql $DATABASE_URL -f supabase/migrations/20250115000001_enhance_check_user_auth_method.sql

# Test the RPC
SELECT public.check_user_auth_method('roderickmoodie@yahoo.com');

# Expected result:
{
  "exists": true,
  "has_password": false,
  "account_type": "guest-checkout",
  "created_via": "guest_checkout",
  "is_guest_checkout": true
}
```

### Test 2: In Browser
1. Sign out
2. Enter `roderickmoodie@yahoo.com`
3. Console should show:
```
🔍 Checking account type for: roderickmoodie@yahoo.com
✅ Account detection result: {account_type: "guest-checkout", is_guest_checkout: true}
✨ Account type: guest-checkout
📧 Sending magic link to: roderickmoodie@yahoo.com (mode: guest-login)
```
4. UI should show: "We sent a link so you can access your tickets as roderickmoodie@yahoo.com"

---

## Console Logs Reference

### Guest Checkout User
```
🔍 Checking account type for: roderickmoodie@yahoo.com
✅ Account detection result: {
  exists: true,
  has_password: false,
  account_type: "guest-checkout",
  created_via: "guest_checkout",
  is_guest_checkout: true
}
✨ Account type: guest-checkout
📧 Sending magic link to: roderickmoodie@yahoo.com (mode: guest-login)
✉️ Magic link sent successfully (mode: guest-login)
```

### Organic Passwordless User
```
🔍 Checking account type for: user@example.com
✅ Account detection result: {
  exists: true,
  has_password: false,
  account_type: "organic-passwordless",
  created_via: null,
  is_guest_checkout: false
}
✨ Account type: organic-passwordless
📧 Sending magic link to: user@example.com (mode: passwordless-login)
✉️ Magic link sent successfully (mode: passwordless-login)
```

### New User (Signup)
```
🔍 Checking account type for: newuser@example.com
✅ Account detection result: {
  exists: false
}
🆕 New user - needs signup (fallback)
🆕 Creating new account for: newuser@example.com
📧 Sending magic link to: newuser@example.com (mode: signup)
✉️ Magic link sent successfully (mode: signup)
```

---

## Summary

### ✅ What's Done
1. **Enhanced RPC** - Reads `created_via` from guest-checkout
2. **Richer AccountType** - 4 types instead of 3
3. **Phone OTP verification** - Complete flow
4. **State reset** - Modal resets on open
5. **Error handling** - Better resend logic
6. **Email normalization** - Trim + lowercase
7. **Better UX copy** - Different messages per account type

### ❌ What's NOT Needed
- ✅ guest-checkout Edge Function - Already perfect!
- ✅ Profile creation - Already handled in AuthContext
- ✅ User metadata - Already set by guest-checkout

### 📋 Migration Checklist
- [ ] Run `20250115000001_enhance_check_user_auth_method.sql`
- [ ] Test with `roderickmoodie@yahoo.com` (guest checkout)
- [ ] Test with new email (organic signup)
- [ ] Test phone OTP flow
- [ ] Verify console logs match expected patterns
- [ ] Check UX copy is correct per account type

---

## Next Steps

1. **Apply the migration**:
```bash
psql $DATABASE_URL -f supabase/migrations/20250115000001_enhance_check_user_auth_method.sql
```

2. **Test all flows**:
   - Guest checkout reaccess
   - Organic signup
   - Password login
   - Phone OTP

3. **Monitor analytics**:
   - Track account_type distribution
   - Conversion rates per flow
   - Magic link success rates

4. **Future enhancements**:
   - Add "Remember this device"
   - Progressive profile completion for guests
   - Convert guests to organic accounts (upgrade flow)

