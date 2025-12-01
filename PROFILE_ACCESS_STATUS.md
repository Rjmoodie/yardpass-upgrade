# User Profile Access Status: Email vs Phone

**Date:** November 27, 2025  
**Status:** ✅ **Email-based authentication, UUID/Username-based profile access**

---

## 🔐 Authentication Methods

### ✅ **Email Authentication (Primary)**

**Methods Available:**
1. **Email + Password** - Traditional sign-in
   ```typescript
   signIn(email: string, password: string)
   ```

2. **Email + Magic Link** - Passwordless authentication
   - Magic link sent to email
   - Works for guest checkout users, new users, and passwordless accounts

3. **Email OTP** - One-time password via email
   - Used for guest checkout users
   - No password required

**Implementation:**
- ✅ Fully implemented in `AuthContext.tsx`
- ✅ Smart auth flow detects account type automatically
- ✅ Supports guest checkout users, password users, and new signups

### ✅ **Phone Authentication (Secondary)**

**Methods Available:**
1. **Phone + OTP/SMS** - SMS-based authentication
   ```typescript
   signInWithPhone(phone: string)      // Send OTP
   verifyPhoneOtp(phone: string, token) // Verify code
   ```

2. **Phone Sign-up** - Create account with phone number
   ```typescript
   signUpWithPhone(phone: string, displayName: string)
   ```

**Implementation:**
- ✅ Fully implemented in `AuthContext.tsx`
- ✅ Uses Supabase OTP flow
- ✅ SMS codes sent to phone number

**Status:** ✅ **Both email and phone authentication are supported**

---

## 👤 Profile Access & Lookup

### Profile Identifiers

**Primary Identifier:**
- ✅ **`user_id` (UUID)** - Used for internal profile lookup
  - Format: `43482421-1c3c-453b-900a-dcf09dee082a`
  - Unique per user
  - Route: `/user/:userId`

**Secondary Identifier:**
- ✅ **`username`** - Public-facing identifier
  - Case-insensitive lookup
  - Optional (may be null)
  - Route: `/profile/:username` (legacy)

**NOT Used for Profile Lookup:**
- ❌ **Email** - Stored in `auth.users`, not used for profile access
- ❌ **Phone** - Stored in `user_profiles.phone`, not used for profile lookup

---

## 📋 Profile Lookup Flow

### Current Implementation (`ProfilePage.tsx`)

```typescript
// Step 1: Get identifier from URL
const profileIdToLoad = userId || username;

// Step 2: Try username lookup first (case-insensitive)
let result = await supabase
  .from('user_profiles')
  .select('user_id, display_name, username, phone, ...')
  .ilike('username', profileIdToLoad)
  .maybeSingle();

// Step 3: If no username match, try UUID lookup
if (!result.data && uuidRegex.test(profileIdToLoad)) {
  result = await supabase
    .from('user_profiles')
    .select('user_id, display_name, username, phone, ...')
    .eq('user_id', profileIdToLoad)
    .maybeSingle();
}
```

### Profile Access Routes

1. **`/user/:userId`** - Direct UUID access (primary)
   - ✅ Works for all users
   - ✅ Used by search results
   - ✅ Most reliable

2. **`/profile/:username`** - Username-based access (legacy)
   - ✅ Works if username exists
   - ⚠️ May fail if username is null/empty
   - Used for backward compatibility

3. **`/profile`** - Own profile (no identifier)
   - ✅ Shows current user's profile
   - Uses `auth.uid()` internally

---

## 📊 Data Storage

### Email Storage

**Location:** `auth.users.email` (Supabase Auth table)
- ✅ Primary authentication identifier
- ✅ Used for login/signup
- ❌ **NOT stored in `user_profiles` table**
- ❌ **NOT used for profile lookup**

**Access:**
- Via `user.email` from Supabase session
- Not directly queryable from `user_profiles`

### Phone Storage

**Location:** `user_profiles.phone` (Optional field)
- ✅ Stored in profile table
- ✅ Can be displayed on profile
- ❌ **NOT used for authentication lookup**
- ❌ **NOT used for profile lookup**

**Usage:**
- Display only (if provided)
- Used for contact information
- Not used as identifier

### Username Storage

**Location:** `user_profiles.username` (Optional field)
- ✅ Stored in profile table
- ✅ Used for profile lookup
- ✅ Case-insensitive search
- ⚠️ May be null (not required)

---

## 🔍 Lookup Capabilities

### ✅ What Works

1. **Lookup by UUID (`user_id`)**
   - ✅ Always works (primary identifier)
   - ✅ Exact match via `.eq('user_id', uuid)`
   - ✅ Used in search results

2. **Lookup by Username**
   - ✅ Works if username exists
   - ✅ Case-insensitive via `.ilike('username', value)`
   - ⚠️ May fail if username is null

3. **Internal Profile Fetch (AuthContext)**
   - ✅ Uses `user_id` from session
   - ✅ Fetches own profile automatically
   - ✅ Retry logic for reliability

### ❌ What Doesn't Work

1. **Lookup by Email**
   - ❌ Email not in `user_profiles` table
   - ❌ No direct profile lookup by email
   - ✅ Can lookup `user_id` via `get_user_id_by_email()` RPC (admin only)

2. **Lookup by Phone**
   - ❌ Phone not indexed for lookup
   - ❌ No profile lookup function by phone
   - ✅ Phone is display-only field

---

## 🎯 Authentication vs Profile Access

### Authentication (Login)
- ✅ **Email** - Primary method
- ✅ **Phone** - Secondary method (SMS OTP)
- ✅ **Magic Link** - Email-based passwordless
- ✅ **Password** - Email-based traditional

### Profile Access (Viewing)
- ✅ **UUID** (`user_id`) - Primary identifier
- ✅ **Username** - Secondary identifier (if exists)
- ❌ **Email** - Not used for profile access
- ❌ **Phone** - Not used for profile access

**Key Insight:** Authentication and profile access use different identifiers!

---

## 📝 Current Limitations

### 1. Cannot Lookup Profile by Email
**Problem:**
- Email is stored in `auth.users`, not `user_profiles`
- No public API to lookup profile by email
- Privacy concern: email lookup would expose emails

**Workaround:**
- Use username or UUID instead
- Admin functions can use `get_user_id_by_email()` RPC (service role only)

### 2. Cannot Lookup Profile by Phone
**Problem:**
- Phone is stored but not indexed
- No lookup function exists
- Privacy concern: phone lookup would expose phone numbers

**Workaround:**
- Use username or UUID instead
- Phone is display-only information

### 3. Username May Be Null
**Problem:**
- Username is optional
- Username-based routes may fail if username doesn't exist
- Legacy accounts may not have username

**Workaround:**
- UUID-based routes always work
- Fallback to UUID if username lookup fails

---

## 🚀 Recommendations

### ✅ Current State is Good
- Email for authentication (secure, standardized)
- UUID for profile access (private, unique)
- Username for public sharing (optional, friendly)

### 💡 Potential Enhancements (Optional)

1. **Email-to-Profile Lookup (Admin Only)**
   - Already exists: `get_user_id_by_email()` RPC
   - Should remain admin-only for privacy

2. **Phone-to-Profile Lookup (Not Recommended)**
   - Privacy concern
   - Phone numbers should remain private
   - Not recommended for public access

3. **Ensure Username is Set**
   - Prompt users to set username on signup
   - Make username required (breaking change)
   - Or keep UUID as primary, username as optional

---

## 📊 Summary Table

| Identifier | Authentication | Profile Lookup | Storage Location |
|------------|---------------|----------------|------------------|
| **Email** | ✅ Primary | ❌ No | `auth.users.email` |
| **Phone** | ✅ Secondary (OTP) | ❌ No | `user_profiles.phone` |
| **UUID** (`user_id`) | ✅ Internal | ✅ Primary | `user_profiles.user_id` |
| **Username** | ❌ No | ✅ Secondary | `user_profiles.username` |

---

## ✅ Current Status

### Authentication
- ✅ **Email-based:** Fully supported (password, magic link, OTP)
- ✅ **Phone-based:** Fully supported (SMS OTP)

### Profile Access
- ✅ **UUID-based:** Primary method (always works)
- ✅ **Username-based:** Secondary method (works if username exists)
- ❌ **Email-based:** Not supported (privacy/architecture decision)
- ❌ **Phone-based:** Not supported (privacy/architecture decision)

**Conclusion:** ✅ **System is working as designed**
- Email/phone for authentication ✅
- UUID/username for profile access ✅
- Clean separation of concerns ✅

---

**Last Updated:** November 27, 2025



