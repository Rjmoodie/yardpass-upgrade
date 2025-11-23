# 📱 Phone Authentication Implementation Plan

## Overview

**Goal:** Implement complete phone authentication flow through Supabase, matching the sophistication of the existing email auth system.

**Current State:**
- ✅ UI already has phone/email toggle
- ✅ Basic phone OTP flow partially implemented
- ✅ Uses Supabase's built-in `signInWithOtp` with phone
- ⚠️ **Not configured** - Requires SMS provider (Twilio)
- ⚠️ **No custom Edge Functions** - Unlike email auth which uses custom functions

---

## 🎯 Implementation Options

### **Option A: Supabase Built-in SMS (Recommended for MVP)**
- ✅ Faster to implement
- ✅ Supabase handles OTP generation, storage, expiration
- ✅ Built-in rate limiting and security
- ❌ Requires Twilio account ($0.0075-0.0079 per SMS)
- ❌ Less control over SMS template/branding

### **Option B: Custom Edge Functions (Recommended for Production)**
- ✅ Full control over SMS templates and branding
- ✅ Consistent with email auth architecture
- ✅ Can use any SMS provider (Twilio, Vonage, AWS SNS, etc.)
- ✅ Better analytics and monitoring
- ❌ More complex to implement
- ❌ Must handle OTP generation/storage manually

**Recommendation:** Start with **Option A** for MVP, then migrate to **Option B** for production.

---

## 📋 Option A: Supabase Built-in SMS Implementation

### **Step 1: Configure Supabase SMS Provider**

#### **1.1 Set up Twilio Account**
1. Sign up at [Twilio.com](https://www.twilio.com)
2. Get your credentials:
   - Account SID
   - Auth Token
   - Phone Number (for sending SMS)

#### **1.2 Configure Supabase Dashboard**
1. Go to **Authentication → Providers → Phone**
2. Enable Phone provider
3. Enter Twilio credentials:
   ```
   Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   Auth Token: your_auth_token
   Phone Number: +1234567890
   ```
4. Configure message template (optional):
   ```
   Your Liventix verification code is: {{ .Token }}
   ```
5. Save configuration

#### **1.3 Update Supabase Config**
**File:** `supabase/config.toml`
```toml
[auth]
enable_phone_signup = true
enable_phone_confirmations = true
phone_otp_expiry = 300  # 5 minutes (same as email)
phone_rate_limit_enabled = true
phone_rate_limit_max_attempts = 5
```

---

### **Step 2: Update Frontend Code**

#### **2.1 Enhance Phone Input Validation**
**File:** `src/components/auth/SmartAuthModal.tsx`

Add phone number validation and formatting:

```typescript
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

const normalizePhone = (value: string): string | null => {
  const cleaned = value.replace(/\D/g, '');
  
  // Auto-format: add country code if missing
  let formatted = cleaned;
  if (!cleaned.startsWith('+') && cleaned.length === 10) {
    // Assume US number, add +1
    formatted = `+1${cleaned}`;
  } else if (!cleaned.startsWith('+')) {
    formatted = `+${cleaned}`;
  } else {
    formatted = `+${cleaned}`;
  }

  // Validate with libphonenumber-js
  if (!isValidPhoneNumber(formatted)) {
    return null;
  }

  return formatted;
};

const formatPhoneForDisplay = (phone: string): string => {
  try {
    const parsed = parsePhoneNumber(phone);
    return parsed.formatInternational();
  } catch {
    return phone;
  }
};
```

#### **2.2 Update `sendPhoneOtp` Function**
**File:** `src/components/auth/SmartAuthModal.tsx` (Line 280)

```typescript
const sendPhoneOtp = async (phoneNumber: string) => {
  setLoading(true);
  
  try {
    // Normalize phone number
    const normalizedPhone = normalizePhone(phoneNumber);
    
    if (!normalizedPhone) {
      throw new Error('Invalid phone number. Please include country code (e.g., +1 555 123 4567)');
    }

    // Check if user exists (for account type detection)
    const { data: userData } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    const accountType = userData ? 'existing' : 'new';

    // Send OTP via Supabase
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: {
        shouldCreateUser: true,
        channel: 'sms', // Explicitly use SMS (not call)
      },
    });

    if (error) throw error;

    setStep('phone-otp-entry');
    setPhone(normalizedPhone); // Store normalized phone
    
    toast({
      title: 'Code sent! 📱',
      description: `Enter the verification code we sent to ${formatPhoneForDisplay(normalizedPhone)}`,
    });
  } catch (error) {
    handleErrorToast(error, 'Unable to send code. Please check your phone number and try again.');
  } finally {
    setLoading(false);
  }
};
```

#### **2.3 Update `handleVerifyPhoneOtp` Function**
**File:** `src/components/auth/SmartAuthModal.tsx` (Line 297)

```typescript
const handleVerifyPhoneOtp = async (e: FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    if (!phone || !phoneOtp) {
      throw new Error('Phone number and code are required');
    }

    // Verify OTP via Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: phoneOtp,
      type: 'sms',
    });

    if (error) throw error;

    // Session is automatically set by Supabase
    // Check if profile exists
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Ensure profile exists
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          phone: phone,
          display_name: displayName || user.user_metadata?.display_name || `User ${user.id.slice(0, 8)}`,
        }, {
          onConflict: 'user_id',
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
      }
    }

    toast({ title: 'Welcome! 🎉', description: 'You\'re signed in successfully.' });
    onSuccess?.();
    onClose();
  } catch (error) {
    handleErrorToast(error, 'Invalid code. Please try again.');
  } finally {
    setLoading(false);
  }
};
```

#### **2.4 Add Phone Input Component with Formatting**
**File:** `src/components/auth/SmartAuthModal.tsx`

Replace phone input with formatted version:

```tsx
{/* Phone Input with Auto-Formatting */}
<Input
  id="phone"
  type="tel"
  placeholder="+1 (555) 123-4567"
  value={phone}
  onChange={(e) => {
    const input = e.target.value;
    // Allow user to type, normalize on blur
    setPhone(input);
  }}
  onBlur={(e) => {
    const normalized = normalizePhone(e.target.value);
    if (normalized) {
      setPhone(formatPhoneForDisplay(normalized));
    }
  }}
  required
  autoFocus
  className="h-12 text-[16px]"
/>
```

---

### **Step 3: Update Database Schema**

#### **3.1 Ensure Phone Column Exists**
**File:** `supabase/migrations/YYYYMMDD_add_phone_to_user_profiles.sql`

```sql
-- Ensure phone column exists in user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Create index for phone lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone 
ON public.user_profiles(phone) 
WHERE phone IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.user_profiles.phone IS 'User phone number for authentication, stored in E.164 format (+1234567890)';
```

#### **3.2 Update `check_user_auth_method` Function**
**File:** `supabase/migrations/YYYYMMDD_update_check_user_auth_method_for_phone.sql`

```sql
CREATE OR REPLACE FUNCTION public.check_user_auth_method(
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid;
  v_has_password boolean;
  v_created_via text;
  v_email_confirmed boolean;
  v_account_type text;
  v_auth_method text; -- 'email' or 'phone'
BEGIN
  -- Validate input
  IF p_email IS NULL AND p_phone IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Either email or phone must be provided'
    );
  END IF;

  -- Determine which lookup to use
  IF p_email IS NOT NULL THEN
    v_auth_method := 'email';
    SELECT 
      id,
      encrypted_password IS NOT NULL AND encrypted_password != '',
      raw_user_meta_data->>'created_via',
      email_confirmed_at IS NOT NULL
    INTO 
      v_user_id,
      v_has_password,
      v_created_via,
      v_email_confirmed
    FROM auth.users
    WHERE email = LOWER(TRIM(p_email))
      AND deleted_at IS NULL
      AND banned_until IS NULL;
  ELSE
    v_auth_method := 'phone';
    -- Look up by phone in user_profiles
    SELECT up.user_id
    INTO v_user_id
    FROM public.user_profiles up
    JOIN auth.users au ON au.id = up.user_id
    WHERE up.phone = TRIM(p_phone)
      AND au.deleted_at IS NULL
      AND au.banned_until IS NULL;

    -- Get auth details if user exists
    IF v_user_id IS NOT NULL THEN
      SELECT 
        encrypted_password IS NOT NULL AND encrypted_password != '',
        raw_user_meta_data->>'created_via',
        email_confirmed_at IS NOT NULL
      INTO 
        v_has_password,
        v_created_via,
        v_email_confirmed
      FROM auth.users
      WHERE id = v_user_id;
    END IF;
  END IF;

  -- User doesn't exist
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'exists', false,
      'has_password', false,
      'account_type', 'new',
      'created_via', null,
      'email_confirmed', false,
      'is_guest_checkout', false,
      'auth_method', v_auth_method
    );
  END IF;

  -- Determine account type
  IF v_created_via = 'guest_checkout' THEN
    v_account_type := 'guest-checkout';
  ELSIF v_has_password THEN
    v_account_type := 'password';
  ELSE
    v_account_type := 'organic-passwordless';
  END IF;

  RETURN jsonb_build_object(
    'exists', true,
    'has_password', v_has_password,
    'account_type', v_account_type,
    'created_via', v_created_via,
    'email_confirmed', v_email_confirmed,
    'is_guest_checkout', v_created_via = 'guest_checkout',
    'auth_method', v_auth_method
  );
END;
$$;
```

---

### **Step 4: Add Phone Number Formatting Library**

#### **4.1 Install Dependencies**
```bash
npm install libphonenumber-js
```

#### **4.2 Create Phone Utility**
**File:** `src/lib/phoneUtils.ts`

```typescript
import { parsePhoneNumber, isValidPhoneNumber, formatIncompletePhoneNumber, AsYouType } from 'libphonenumber-js';

/**
 * Normalize phone number to E.164 format
 * @param phone - Raw phone input
 * @param defaultCountry - Default country code (e.g., 'US')
 * @returns E.164 formatted phone or null if invalid
 */
export function normalizePhone(phone: string, defaultCountry: string = 'US'): string | null {
  if (!phone) return null;

  const cleaned = phone.replace(/\D/g, '');
  
  if (!cleaned) return null;

  try {
    // Try parsing with default country
    let parsed = parsePhoneNumber(cleaned, defaultCountry as any);
    
    if (!parsed.isValid()) {
      // Try parsing as international
      parsed = parsePhoneNumber(phone);
    }

    if (!parsed.isValid()) {
      return null;
    }

    return parsed.number; // Returns E.164 format: +1234567890
  } catch {
    return null;
  }
}

/**
 * Format phone number for display
 * @param phone - E.164 phone number
 * @returns Formatted string (e.g., "+1 555 123 4567")
 */
export function formatPhoneForDisplay(phone: string): string {
  if (!phone) return '';
  
  try {
    const parsed = parsePhoneNumber(phone);
    return parsed.formatInternational();
  } catch {
    return phone;
  }
}

/**
 * Format phone number as user types (as-you-type formatting)
 * @param phone - Raw phone input
 * @param defaultCountry - Default country code
 * @returns Formatted string (e.g., "+1 (555) 123-4567")
 */
export function formatPhoneAsYouType(phone: string, defaultCountry: string = 'US'): string {
  if (!phone) return '';
  
  const formatter = new AsYouType(defaultCountry as any);
  return formatter.input(phone);
}

/**
 * Validate phone number
 * @param phone - Phone number to validate
 * @param defaultCountry - Default country code
 * @returns true if valid
 */
export function isValidPhone(phone: string, defaultCountry: string = 'US'): boolean {
  if (!phone) return false;
  
  try {
    return isValidPhoneNumber(phone, defaultCountry as any);
  } catch {
    return false;
  }
}

/**
 * Extract country code from phone number
 * @param phone - Phone number
 * @returns Country code (e.g., 'US') or null
 */
export function getCountryFromPhone(phone: string): string | null {
  if (!phone) return null;
  
  try {
    const parsed = parsePhoneNumber(phone);
    return parsed.country || null;
  } catch {
    return null;
  }
}
```

---

## 📋 Option B: Custom Edge Functions (Advanced)

### **Step 1: Create `auth-send-phone-otp` Edge Function**

**File:** `supabase/functions/auth-send-phone-otp/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function hashOtp(otp: string, phone: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${otp}:${phone}:${Date.now()}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sendSMS(phone: string, otp: string): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  
  const body = new URLSearchParams({
    To: phone,
    From: TWILIO_PHONE_NUMBER,
    Body: `Your Liventix verification code is: ${otp}\n\nThis code expires in 5 minutes.`,
  });

  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twilio error: ${error}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { phone } = await req.json().catch(() => ({} as any));

    if (!phone || typeof phone !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedPhone = phone.trim();

    // Generate OTP
    const otp = generateOTP();
    const otpHash = await hashOtp(otp, normalizedPhone);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Store OTP in database
    const { error: dbError } = await supabase
      .from('guest_otp_codes')
      .upsert({
        method: 'phone',
        contact: normalizedPhone,
        otp_hash: otpHash,
        event_id: null, // Auth OTP
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error('[auth-send-phone-otp] DB error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to store OTP' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send SMS
    await sendSMS(normalizedPhone, otp);

    return new Response(
      JSON.stringify({ success: true, message: 'OTP sent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[auth-send-phone-otp] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### **Step 2: Create `auth-verify-phone-otp` Edge Function**

**File:** `supabase/functions/auth-verify-phone-otp/index.ts`

Similar structure to `auth-verify-otp` but for phone:

```typescript
// Similar to auth-verify-otp but:
// - Query by method='phone' and contact=phone
// - Create Supabase user with phone number
// - Set up user profile
```

---

## ✅ Implementation Checklist

### **Phase 1: Supabase Built-in SMS (MVP)**
- [ ] Set up Twilio account
- [ ] Configure Supabase Dashboard with Twilio credentials
- [ ] Update `supabase/config.toml`
- [ ] Install `libphonenumber-js`
- [ ] Create phone utility functions
- [ ] Update `SmartAuthModal.tsx` phone input validation
- [ ] Update `sendPhoneOtp` function
- [ ] Update `handleVerifyPhoneOtp` function
- [ ] Add phone column to `user_profiles` (if missing)
- [ ] Update `check_user_auth_method` function for phone
- [ ] Test phone authentication flow
- [ ] Test account type detection for phone users

### **Phase 2: Custom Edge Functions (Production)**
- [ ] Create `auth-send-phone-otp` Edge Function
- [ ] Create `auth-verify-phone-otp` Edge Function
- [ ] Update frontend to use Edge Functions
- [ ] Add SMS template customization
- [ ] Add analytics and monitoring
- [ ] Test custom SMS flow

---

## 🔒 Security Considerations

1. **Rate Limiting:**
   - Supabase built-in: Automatic rate limiting
   - Custom: Implement in Edge Function (max 5 attempts per 15 minutes)

2. **Phone Number Validation:**
   - Always validate with `libphonenumber-js`
   - Normalize to E.164 format
   - Block VOIP numbers if needed

3. **OTP Security:**
   - 6-digit codes
   - 5-minute expiration
   - One-time use only
   - Hash before storage

4. **Privacy:**
   - Store phone in E.164 format
   - Hash OTPs before database storage
   - Log minimal information

---

## 📊 Cost Estimate

### **Twilio SMS Pricing:**
- **US/Canada:** ~$0.0075 per SMS
- **International:** Varies by country ($0.02-$0.10+)
- **Monthly:** ~$0.75 per 100 SMS

### **Estimated Monthly Cost:**
- 1,000 users/month = ~$7.50/month
- 10,000 users/month = ~$75/month
- 100,000 users/month = ~$750/month

---

## 🧪 Testing Checklist

- [ ] Phone number formatting works correctly
- [ ] Country code detection works
- [ ] OTP sent successfully via SMS
- [ ] OTP received on test phone
- [ ] OTP verification works
- [ ] Invalid OTP rejected
- [ ] Expired OTP rejected
- [ ] Rate limiting prevents spam
- [ ] New user signup via phone works
- [ ] Existing user login via phone works
- [ ] Profile creation/update works
- [ ] Phone number stored in E.164 format
- [ ] Account type detection works for phone users

---

## 🚀 Deployment Steps

1. **Configure Environment Variables:**
   ```bash
   # For custom Edge Functions
   supabase secrets set TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   supabase secrets set TWILIO_AUTH_TOKEN="your_auth_token"
   supabase secrets set TWILIO_PHONE_NUMBER="+1234567890"
   ```

2. **Deploy Migrations:**
   ```bash
   supabase db push
   ```

3. **Deploy Edge Functions (if using Option B):**
   ```bash
   supabase functions deploy auth-send-phone-otp
   supabase functions deploy auth-verify-phone-otp
   ```

4. **Test in Production:**
   - Use test phone numbers
   - Verify SMS delivery
   - Test authentication flow

---

**Status:** 📋 **PLANNING PHASE** - Ready for implementation

