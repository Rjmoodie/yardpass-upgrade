# 🔧 Dev Server & Auth Errors - Quick Fix Guide

**Date:** November 27, 2025  
**Status:** ✅ **Fixed** - Refresh token error handling added

---

## 🚨 **Errors You're Seeing**

### 1. **MIME Type Errors** (Development Only)
```
Failed to load module script: Expected a JavaScript-or-Wasm module script 
but the server responded with a MIME type of "application/octet-stream"
```

### 2. **Auth Refresh Token Error**
```
AuthApiError: Invalid Refresh Token: Refresh Token Not Found
```

---

## ✅ **Solutions**

### **Quick Fix #1: Restart Dev Server**

The MIME type errors are usually caused by:
- Vite dev server cache corruption
- Stale build artifacts
- Browser cache issues

**Steps:**
1. **Stop the dev server** (Ctrl+C in terminal)
2. **Clear Vite cache:**
   ```bash
   rm -rf node_modules/.vite
   # Or on Windows:
   rmdir /s /q node_modules\.vite
   ```
3. **Clear browser cache:**
   - Open DevTools (F12)
   - Right-click refresh button → "Empty Cache and Hard Reload"
   - Or: Settings → Privacy → Clear browsing data → Cached images
4. **Restart dev server:**
   ```bash
   npm run dev
   ```

---

### **Fix #2: Handle Invalid Refresh Token (Already Applied)**

✅ **I've added automatic refresh token error handling** to `AuthContext.tsx`:

**What it does:**
- Detects when refresh token is invalid/expired
- Automatically clears the session
- Signs the user out gracefully
- Clears localStorage to prevent theme flash

**When it triggers:**
- User's session expires (typically after 1 hour)
- User's refresh token is invalid
- User cleared browser data but app still has stale session

**What happens:**
- App detects the error
- Clears all auth state
- User will be redirected to sign-in (if using AuthGuard)

---

## 🔍 **If Errors Persist**

### **Option A: Manual Sign Out**

If the automatic handling doesn't work, manually clear auth:

1. **Open browser console** (F12)
2. **Run:**
   ```javascript
   // Clear Supabase session
   localStorage.clear();
   sessionStorage.clear();
   
   // Reload page
   location.reload();
   ```

### **Option B: Check Supabase Auth Settings**

1. Go to Supabase Dashboard → Authentication → Settings
2. Check **"Refresh Token Rotation"** settings
3. Check **"Session Duration"** (default: 1 hour)
4. Verify **"JWT Expiry"** is reasonable (default: 3600 seconds)

### **Option C: Verify Environment Variables**

Make sure your `.env` file has correct Supabase credentials:

```bash
VITE_SUPABASE_URL=https://yieslxnrfeqchbcmgavz.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## 📝 **Code Changes Made**

### **File: `src/contexts/AuthContext.tsx`**

**Added refresh token error handling:**
```typescript
supabase.auth.getSession().then(({ data: { session }, error }) => {
  // ✅ NEW: Handle refresh token errors gracefully
  if (error) {
    if (error.message?.includes('Refresh Token') || 
        error.message?.includes('Invalid Refresh Token')) {
      console.log('[Auth] Refresh token invalid, clearing session...');
      // Clear all auth state
      setSession(null);
      setUser(null);
      setProfile(null);
      localStorage.removeItem('user_role');
      supabase.auth.signOut().catch(() => {});
    }
    setLoading(false);
    return;
  }
  // ... rest of session handling
});
```

**Added token refresh failure handling:**
```typescript
supabase.auth.onAuthStateChange(async (event, session) => {
  // ✅ NEW: Handle token refresh failures
  if (event === 'TOKEN_REFRESHED' && !session) {
    console.error('[Auth] Token refresh failed, signing out...');
    // Clear all auth state and sign out
    // ...
  }
  // ... rest of auth state handling
});
```

---

## ✅ **Summary**

1. ✅ **Refresh token errors are now handled automatically**
2. 🔄 **Restart dev server to fix MIME type errors**
3. 🧹 **Clear browser cache if issues persist**

**The app will now:**
- Automatically detect invalid refresh tokens
- Clear stale sessions gracefully
- Prevent auth-related crashes

---

**Next Steps:**
- Restart your dev server
- The refresh token error should now be handled silently
- If you see it again, the app will auto-sign-out and redirect to login



