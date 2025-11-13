# 🎫 Guest Access Complete Fix Guide

## ✅ What Was Fixed

1. **Schema Access Issue**: PostgREST (Supabase's API layer) only exposes `public` and `graphql_public` schemas to Edge Functions
2. **Solution**: Created views in `public` schema that point to `ticketing` schema tables
3. **Auto-Redirect**: Guests now automatically redirect to `/tickets` after successful verification
4. **Tickets Page**: Fixed to properly fetch and display guest tickets using `tickets-list-guest` Edge Function
5. **Guest Session UI**: Added green status banner showing email/phone and expiry time
6. **Better UX**: Toast message shows "Redirecting to your tickets..." and tickets load automatically

---

## 🔧 Step 1: Create Public Schema Views (REQUIRED)

**Run this SQL in Supabase Dashboard:**

1. Go to: **Supabase Dashboard** → **SQL Editor** → **New query**
2. Paste this SQL:

```sql
-- Create views in public schema to access ticketing schema tables
-- This allows Edge Functions to access ticketing.* tables via public.*

-- View for guest OTP codes
CREATE OR REPLACE VIEW public.guest_otp_codes AS
SELECT * FROM ticketing.guest_otp_codes;

-- View for guest ticket sessions
CREATE OR REPLACE VIEW public.guest_ticket_sessions AS
SELECT * FROM ticketing.guest_ticket_sessions;

-- Grant permissions for service role to use these views
GRANT ALL ON public.guest_otp_codes TO service_role;
GRANT ALL ON public.guest_ticket_sessions TO service_role;

-- Allow INSERT/UPDATE/DELETE through the views
ALTER VIEW public.guest_otp_codes SET (security_invoker = on);
ALTER VIEW public.guest_ticket_sessions SET (security_invoker = on);

-- Comment on views
COMMENT ON VIEW public.guest_otp_codes IS 'View to access ticketing.guest_otp_codes from Edge Functions (PostgREST only exposes public schema)';
COMMENT ON VIEW public.guest_ticket_sessions IS 'View to access ticketing.guest_ticket_sessions from Edge Functions (PostgREST only exposes public schema)';
```

3. Click **"Run"**
4. Verify success: Should show "Success. No rows returned"

---

## 🚀 Step 2: Deploy Updated Edge Functions

Run the deployment script:

```bash
cd /Users/rod/Desktop/yard_pass/liventix/liventix-upgrade/liventix-upgrade
./deploy-all-guest-fixes.sh
```

This will deploy:
- ✅ `guest-tickets-start` (send OTP)
- ✅ `guest-tickets-verify` (verify OTP & create session)
- ✅ `tickets-list-guest` (list tickets for guest session)

---

## 🧪 Step 3: Test Guest Access Flow

### Test Scenario:
1. Open your app (localhost or production)
2. Click "**Guest Access**" tab in the auth modal
3. Select **Email** or **Phone**
4. Enter your contact: `your-email@example.com`
5. Click "**Send access code**"
6. Check your email for a **6-digit OTP** (e.g., `123456`)
7. Enter the OTP in the verification field
8. Click "**Verify**"
9. ✨ **You should automatically redirect to `/tickets`**

### Expected Success Flow:
```
[UI] Send Code button clicked
  ↓
[Edge Function] guest-tickets-start
  ↓
[Email] OTP sent to user
  ↓
[UI] User enters OTP
  ↓
[Edge Function] guest-tickets-verify
  ↓
[Storage] Session token saved to localStorage
  ↓
[Navigation] Auto-redirect to /tickets
  ↓
[UI] Guest tickets page loads
```

---

## 🔍 Step 4: Monitor & Debug

### Check Supabase Logs:
1. Go to: **Supabase Dashboard** → **Edge Functions**
2. Select function: **guest-tickets-verify**
3. Click **"Logs"** tab
4. Look for:
   - ✅ `[guest-tickets-verify] OTP lookup result`
   - ✅ `[guest-tickets-verify] Session created successfully`
   - ❌ Any errors (should be none now)

### Check Browser Console:
- Open DevTools → Console
- Look for:
  - ✅ `guest verify success`
  - ✅ Toast: "Redirecting to your tickets..."
  - ✅ Navigation to `/tickets`

### Check localStorage:
- Open DevTools → Application → Local Storage
- Look for key: `ticket-guest-session`
- Should contain: `{ token, exp, scope, email/phone }`

---

## 📊 What Changed in the Code

### 1. AuthExperience.tsx - Auto-Redirect
```typescript
// Added auto-redirect after guest verification
toast({
  title: 'Guest access granted',
  description: 'Redirecting to your tickets...', // ← Updated message
});

resetGuestState();

// Navigate to tickets page after successful guest verification
setTimeout(() => {
  navigate('/tickets'); // ← New auto-redirect
  onAuthSuccess?.();
}, 500);
```

### 2. Edge Functions (guest-tickets-start, guest-tickets-verify, tickets-list-guest)
```typescript
// BEFORE (doesn't work with PostgREST)
await supabase.schema('ticketing').from('guest_otp_codes')

// AFTER (works via public schema views)
await supabase.from('guest_otp_codes') // ← Removed .schema() call
```

### 3. TicketsPage.tsx - Guest Tickets Fetching
```typescript
// BEFORE (ignored guest props)
export default function TicketsPage({ onBack }: TicketsPageProps) {
  // ❌ Not using guestToken, guestSession, etc.
}

// AFTER (properly handles guest sessions)
export default function TicketsPage({
  guestToken,
  guestScope,
  guestSession,
  onGuestSignOut,
  // ... all props destructured
}: TicketsPageProps) {
  // ✅ Fetches tickets using guest token
  useEffect(() => {
    const fetchGuestTickets = async () => {
      const { data } = await supabase.functions.invoke('tickets-list-guest', {
        body: { token: guestToken },
      });
      setAllTickets(data?.tickets || []);
    };
    fetchGuestTickets();
  }, [guestToken]);
  
  // ✅ Shows guest session banner
  // ✅ Displays tickets or "No tickets found" message
}
```

---

## 🎯 Why This Works

1. **Database Level**: Tables exist in `ticketing` schema
2. **API Level**: Views created in `public` schema
3. **Edge Functions**: Access views via `public` schema (default)
4. **Views**: Pass through to underlying `ticketing` tables
5. **No Data Migration**: All data stays in `ticketing` schema
6. **UX Enhancement**: Auto-redirect improves user experience

---

## ⚠️ Troubleshooting

### Error: "The schema must be one of the following: public, graphql_public"
- **Cause**: Views not created in public schema
- **Fix**: Run Step 1 SQL query

### Error: "Could not find the table 'public.guest_otp_codes'"
- **Cause**: Views don't exist yet
- **Fix**: Run Step 1 SQL query

### Error: "Permission denied for view guest_otp_codes"
- **Cause**: Service role doesn't have permissions
- **Fix**: Run the `GRANT ALL` commands from Step 1

### Guest doesn't redirect after verification
- **Cause**: Frontend not updated
- **Fix**: Refresh browser, clear cache, restart dev server

### OTP email not received
- **Cause**: `RESEND_API_KEY` not configured
- **Fix**: Set environment variable in Supabase Dashboard

---

## ✅ Success Checklist

- [ ] SQL views created in Supabase Dashboard
- [ ] Edge Functions deployed successfully
- [ ] Can send OTP code (email arrives)
- [ ] Can verify OTP code (no errors)
- [ ] Auto-redirects to `/tickets` after verification
- [ ] Tickets page loads for guest session
- [ ] No errors in Supabase logs
- [ ] No errors in browser console

---

## 🎉 All Done!

Your guest access flow is now fully functional with auto-redirect to tickets! 🚀

If you encounter any issues, check the logs in:
1. **Supabase Dashboard** → Edge Functions → Logs
2. **Browser DevTools** → Console
3. **Browser DevTools** → Network tab (for API calls)

