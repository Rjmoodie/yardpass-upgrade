# Auth Send OTP Hardening - Changes Applied

**Date:** November 27, 2025  
**Status:** ✅ **Completed** - Security & reliability improvements applied

---

## 🔒 Security & Reliability Improvements Applied

### 1. ✅ **Cryptographically Secure OTP Generator**

**Before:**
```typescript
const generateOTP = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();
```

**After:**
```typescript
const generateOTP = (): string => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] % 900000 + 100000).toString();
};
```

**Why:** `Math.random()` is not cryptographically secure. `crypto.getRandomValues()` provides CSPRNG (Cryptographically Secure Pseudorandom Number Generator).

---

### 2. ✅ **Production-Safe OTP Logging**

**Before:**
```typescript
console.log(`[auth-send-otp] Generated OTP: ${otp} for ${normalizedEmail}`);
```

**After:**
```typescript
const LOG_OTP = Deno.env.get("LOG_OTP") === "true";

if (LOG_OTP) {
  console.log(`[auth-send-otp] Generated OTP: ${otp} for ${normalizedEmail}`);
}
```

**Why:** Prevents OTPs from appearing in production logs. Only logs when `LOG_OTP=true` environment variable is set.

---

### 3. ✅ **Basic Email Format Validation**

**Added:**
```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(normalizedEmail)) {
  return json({ error: "Invalid email format" }, { status: 400 });
}
```

**Why:** Filters out obviously invalid emails before processing, saving resources and preventing errors.

---

### 4. ✅ **Centralized Timestamps**

**Before:**
```typescript
const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
created_at: new Date().toISOString(),
```

**After:**
```typescript
const now = new Date();
const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
created_at: now.toISOString(),
```

**Why:** Ensures consistent timestamps across the function, prevents clock skew issues, and cleaner code.

---

### 5. ✅ **Fixed HTML Header Color Mismatch**

**Before:**
```html
<p style="color:rgba(255,255,255,0.9);">
  Your gateway to events and culture
</p>
<!-- White text on light background = invisible -->
```

**After:**
```html
<p style="color:#64748b;">
  Your gateway to events and culture
</p>
<!-- Dark gray text on light background = readable -->
```

**Why:** White text on a light background (`#fafafa`) was unreadable. Changed to dark gray (`#64748b`) for proper contrast.

---

### 6. ✅ **Safer Error Logging**

**Already Good:**
- OTP only logs when `LOG_OTP=true`
- Resend errors logged to console but not exposed to client
- Generic error messages returned to client ("Failed to send email")
- Internal errors logged for debugging

---

## 📝 TODO: Rate Limiting (Not Yet Implemented)

**Planned Enhancement:**
```typescript
// TODO: Optional rate limiting / cooldown here
// e.g. check last created_at for this email and reject if < X seconds ago
```

**Recommendation:**
- Add 30-60 second cooldown per email
- Add max requests per hour limit (e.g., 10 OTPs per email per hour)
- Can be implemented by checking `guest_otp_codes` table for recent requests

**Future Implementation:**
```typescript
// Check for recent OTP requests
const { data: recentOtp } = await supabase
  .from("guest_otp_codes")
  .select("created_at")
  .eq("method", "email")
  .eq("contact", normalizedEmail)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (recentOtp) {
  const timeSinceLastOtp = now.getTime() - new Date(recentOtp.created_at).getTime();
  if (timeSinceLastOtp < 60 * 1000) { // 60 seconds
    return json({ 
      error: "Please wait before requesting another code" 
    }, { status: 429 });
  }
}
```

---

## 🔧 Environment Variables

### Required
- `RESEND_API_KEY` - Resend API key for sending emails
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access

### Optional
- `LOG_OTP` - Set to `"true"` to enable OTP logging (for debugging only)

**Example:**
```bash
# In Supabase Dashboard → Edge Functions → Environment Variables
LOG_OTP=true  # Only enable in development/staging
```

---

## ✅ Summary of Changes

| Enhancement | Status | Impact |
|-------------|--------|--------|
| **Cryptographically secure OTP** | ✅ Applied | High security |
| **Production-safe logging** | ✅ Applied | Privacy/security |
| **Email format validation** | ✅ Applied | Resource efficiency |
| **Centralized timestamps** | ✅ Applied | Code quality |
| **Fixed HTML header color** | ✅ Applied | UX improvement |
| **Rate limiting** | 📝 TODO | Abuse prevention |

---

## 🚀 Next Steps (Optional)

1. **Add Rate Limiting:**
   - Implement cooldown check (30-60 seconds)
   - Add max requests per hour limit
   - Consider using `rate_limits` table for tracking

2. **Enhance Email Validation:**
   - Consider using a more robust email validation library
   - Or keep simple regex (current approach is fine for function-level check)

3. **Monitor & Alert:**
   - Track OTP send rates
   - Alert on suspicious patterns (many requests from same IP/email)
   - Monitor Resend API errors

---

**Last Updated:** November 27, 2025



