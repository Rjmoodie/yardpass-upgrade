# 📧 Auth OTP via Resend Integration

## Overview

Guest checkout users now receive **6-digit verification codes via Resend** instead of magic links from Supabase's default email service.

---

## What Was Built

### 1. ✨ Two New Edge Functions

#### **`auth-send-otp`**
- Generates 6-digit OTP
- Stores hashed OTP in `guest_otp_codes` table
- Sends beautiful email via Resend API
- 5-minute expiration

#### **`auth-verify-otp`**
- Verifies hashed OTP
- Creates Supabase session
- Deletes OTP after use (one-time)
- Returns access/refresh tokens

### 2. ✅ Updated SmartAuthModal

Now calls Edge Functions instead of Supabase's built-in OTP:
- `sendEmailOtp()` → calls `auth-send-otp`
- `handleVerifyEmailOtp()` → calls `auth-verify-otp`

---

## How It Works

### Flow for Guest Checkout Users

```
1. User enters: roderickmoodie@yahoo.com
   ↓
2. System detects: 'guest-checkout'
   ↓
3. Calls: auth-send-otp Edge Function
   ↓
4. Edge Function:
   - Generates OTP (e.g., "482916")
   - Hashes it
   - Stores in guest_otp_codes (event_id = NULL)
   - Sends email via Resend
   ↓
5. User sees: "Access your tickets" screen
   ↓
6. Email arrives with code: 482916
   ↓
7. User enters: 482916
   ↓
8. Calls: auth-verify-otp Edge Function
   ↓
9. Edge Function:
   - Hashes submitted code
   - Compares to stored hash
   - Creates Supabase session
   - Deletes OTP
   - Returns tokens
   ↓
10. Frontend: Sets session with tokens
   ↓
11. ✅ User signed in!
```

---

## Database Usage

### `guest_otp_codes` Table

| Column | Purpose | Auth OTP Value |
|--------|---------|----------------|
| `method` | Contact type | `'email'` |
| `contact` | Email address | `'user@example.com'` |
| `otp_hash` | Hashed code | SHA-256 hash |
| `event_id` | Scope | **`NULL`** (for auth, not ticket access) |
| `expires_at` | Expiration | 5 minutes from creation |
| `created_at` | Timestamp | Now |

**Key**: `event_id = NULL` distinguishes auth OTPs from ticket access OTPs!

---

## Email Template (via Resend)

### Subject
```
Your YardPass verification code
```

### Content
```
YardPass
Your gateway to events and culture

Access Your Tickets
Enter this verification code to sign in and access your tickets:

┌─────────────┐
│   482916    │
│ Expires in  │
│  5 minutes  │
└─────────────┘

For security, never share this code with anyone.

© 2025 YardPass. All rights reserved.
yardpass.tech
```

---

## Deployment Steps

### 1. Deploy Edge Functions

```bash
# Navigate to Supabase project
cd supabase

# Deploy both functions
supabase functions deploy auth-send-otp
supabase functions deploy auth-verify-otp
```

### 2. Verify Environment Variables

Both functions need:
- ✅ `RESEND_API_KEY` - For sending emails
- ✅ `SUPABASE_URL` - For database access
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - For admin operations

Check in Supabase Dashboard → Edge Functions → Secrets

### 3. Test the Functions Manually (Optional)

```bash
# Test send OTP
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/auth-send-otp \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"roderickmoodie@yahoo.com"}'

# Expected: { "success": true, "message": "OTP sent successfully" }

# Check your email for the code, then test verify:
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/auth-verify-otp \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"roderickmoodie@yahoo.com","otp":"123456"}'

# Expected: { "success": true, "access_token": "...", "refresh_token": "..." }
```

---

## Testing in App

### Test 1: Guest Checkout User

1. **Open app** and go to sign-in
2. **Enter**: `roderickmoodie@yahoo.com`
3. **Click**: Continue

**Expected**:
```
Console:
🔍 Checking account type for: roderickmoodie@yahoo.com
✅ Account detection result: {account_type: "guest-checkout"}
✨ Account type: guest-checkout
📧 Sending email OTP via Resend to: roderickmoodie@yahoo.com
✉️ Email OTP sent successfully via Resend

UI:
┌─────────────────────────────────┐
│  📧 Access your tickets         │
│  We sent a code to              │
│  roderickmoodie@yahoo.com       │
│                                 │
│  Verification Code              │
│  [  _  _  _  _  _  _  ]        │
│  Enter the 6-digit code         │
│                                 │
│  [Access Tickets]               │
└─────────────────────────────────┘
```

4. **Check email** (from Resend, not Supabase!)
5. **Enter code**: 482916
6. **Click**: Access Tickets
7. **✅ Should be signed in!**

### Test 2: Verify Email is from Resend

Check the email headers:
- **From**: `YardPass <hello@yardpass.tech>`
- **Service**: Should say "via resend.com" in email headers
- **Subject**: "Your YardPass verification code"

---

## Comparison: Before vs After

| Aspect | Before (Magic Link) | After (Email OTP) |
|--------|---------------------|-------------------|
| **Method** | Click link | Copy 6-digit code |
| **Speed** | Link opens new tab | Enter code in same tab |
| **UX** | "Check your email" → wait → click | "Check your email" → copy → paste |
| **Email service** | Supabase default | ✅ **Resend** (your integration) |
| **Mobile friendly** | Good | ✅ **Better** (autofill OTP) |
| **Code visibility** | No | ✅ **Yes** (can see the code) |

---

## Security Notes

### ✅ Secure Hashing
```typescript
// OTP is hashed with email as salt
const otpHash = SHA256(otp + email)
```

### ✅ One-Time Use
OTP is deleted after verification

### ✅ Time-Limited
5-minute expiration

### ✅ Same Table
Reuses `guest_otp_codes` table (proven, battle-tested)

---

## Future Enhancements

- [ ] Add rate limiting (max 3 OTPs per email per hour)
- [ ] Add analytics tracking per verification attempt
- [ ] Implement retry backoff (increase delay after failures)
- [ ] Add SMS OTP via Twilio for phone method
- [ ] Consider passwordless signup for organic users too

---

## Rollback Plan

If issues arise, simply comment out the Edge Function calls and revert to Supabase OTP:

```typescript
// Rollback: Use Supabase's built-in OTP
const { error } = await supabase.auth.signInWithOtp({ email });
```

---

## Summary

✅ **Guest checkout users** get email OTP via Resend  
✅ **Reuses existing** `guest_otp_codes` infrastructure  
✅ **Consistent branding** with your other emails  
✅ **Better UX** than magic links for ticket access  
✅ **Mobile-friendly** with OTP autofill support  

**Deploy the functions and test!** 🚀

