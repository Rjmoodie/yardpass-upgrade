# 🧪 Testing Smart Auth Flow

## Quick Start

The Smart Auth Modal is now integrated! Here's how to test it:

## Test Scenarios

### ✅ Test 1: Guest Purchaser (No Password)

**User**: `roderickmoodie@yahoo.com`  
**Expected Flow**: Magic Link

1. Navigate to any protected action (requires sign-in)
2. Enter email: `roderickmoodie@yahoo.com`
3. Click **Continue**
4. ✨ Should see: **"Check your email"** screen (magic link sent)
5. Check email for magic link
6. Click link → Should be signed in!

**Why this works**: User was created during ticket purchase with no password set.

---

### ✅ Test 2: New User

**User**: Any email that doesn't exist (e.g., `test123@example.com`)  
**Expected Flow**: Signup → Magic Link

1. Navigate to sign-in
2. Enter email: `test123@example.com`
3. Click **Continue**
4. 📝 Should see: **"Create your account"** screen
5. Enter display name (e.g., "Test User")
6. Click **Create Account**
7. ✨ Should see: **"Check your email"** screen
8. Check email for magic link
9. Click link → Should be signed in + account created!

**Why this works**: Email doesn't exist, so system creates new passwordless account.

---

### ✅ Test 3: Password User (If You Have One)

**User**: Any user with a password  
**Expected Flow**: Password Entry

1. Navigate to sign-in
2. Enter email of user with password
3. Click **Continue**
4. 🔐 Should see: **"Welcome back!"** with password field
5. Enter password
6. Click **Sign In**
7. Should be signed in!

**Alternative**: Click "Send me a magic link instead" to use passwordless flow

**Why this works**: System detected the account has a password set.

---

## Testing Locations

### Where to Trigger Auth Modal

1. **Protected Routes**
   - Try to access `/tickets` without being signed in
   - Try to like a post
   - Try to comment

2. **Direct Auth Page**
   - Navigate to `/auth` directly
   - Should show full-page auth experience

3. **Bottom Nav**
   - Look for any "Sign In" buttons
   - Navigation prompts

---

## Database Verification (Optional)

Run this to check the detection is working:

```sql
-- Check roderickmoodie@yahoo.com
SELECT public.check_user_auth_method('roderickmoodie@yahoo.com');

-- Expected result:
{
  "exists": true,
  "has_password": false,
  "account_type": "guest",
  "created_via": "guest_checkout",
  "email_confirmed": true
}
```

---

## What to Watch For

### ✅ Success Indicators

- [ ] Email entry screen shows with method toggle (Phone/Email)
- [ ] System correctly detects account type (check console logs)
- [ ] Appropriate next screen appears:
  - Guest → Magic link sent
  - Password user → Password field
  - New user → Signup form
- [ ] Magic link emails arrive (check spam!)
- [ ] Clicking magic link signs user in
- [ ] After sign-in, user is redirected properly

### 🚨 Potential Issues

**Issue**: "Function check_user_auth_method does not exist"
- **Fix**: Migration not applied. Run:
  ```bash
  psql $DATABASE_URL -f supabase/migrations/20250115000000_add_check_user_auth_method.sql
  ```

**Issue**: Magic link emails not arriving
- **Fix**: 
  1. Check Supabase email settings
  2. Check spam folder
  3. Verify email provider is configured

**Issue**: "Permission denied for function check_user_auth_method"
- **Fix**: Function needs GRANT to anon. Check migration applied correctly.

**Issue**: TypeScript error on `supabase.rpc('check_user_auth_method')`
- **Fix**: This is expected. The function will still work at runtime. To fix type:
  ```typescript
  // @ts-ignore - Custom RPC function
  const { data } = await supabase.rpc('check_user_auth_method', { p_email: email });
  ```

---

## Console Logs to Check

Open browser console while testing. You should see:

```
🔍 Checking account type for: roderickmoodie@yahoo.com
✅ Account detected: guest (no password)
📧 Sending magic link to: roderickmoodie@yahoo.com
✉️ Magic link sent successfully
```

---

## Test Checklist

- [ ] Guest purchaser (`roderickmoodie@yahoo.com`) gets magic link
- [ ] New user gets signup form
- [ ] Password user gets password field
- [ ] Magic links arrive in email
- [ ] Clicking magic links signs in successfully
- [ ] After sign-in, redirected to intended page
- [ ] UI is responsive on mobile
- [ ] "Use different email" button works
- [ ] "Send me a magic link instead" works for password users
- [ ] Error messages display properly
- [ ] Loading states show correctly

---

## Next Steps After Testing

Once everything works:

1. **Monitor analytics** - Track conversion rates
2. **Update email templates** - Customize magic link emails
3. **Add docs** - Update help center with passwordless info
4. **Gather feedback** - Ask users about the experience
5. **Optimize** - A/B test magic link vs password

---

## Rollback Plan (If Needed)

If something goes wrong, you can quickly revert:

```tsx
// In src/components/AuthModal.tsx
// Replace:
import { SmartAuthModal } from '@/components/auth/SmartAuthModal';

// With:
import AuthExperience from '@/components/auth/AuthExperience';

// And restore the old component usage
```

The old `AuthExperience` component is still there as a backup!

---

## Support

If you encounter issues:

1. Check browser console for errors
2. Check Supabase logs
3. Verify migration was applied
4. Test with different browsers
5. Clear browser cache/cookies

Happy testing! 🚀

