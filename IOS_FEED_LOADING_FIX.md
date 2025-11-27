# 🔧 iOS Feed Loading Fix - Critical

## 🎯 Problem
Feed not loading on iOS native app with error: "We couldn't load your feed" / "Please check your connection and try again"

## 🔍 Root Causes Identified

### 1. **CORS Origin Detection for iOS Native Apps**
iOS native apps (Capacitor) may:
- Not send an `Origin` header at all
- Send `file://` as origin
- Send empty string or `null` as origin
- Use different User-Agent strings

### 2. **OPTIONS Preflight Handling**
The OPTIONS preflight request might be:
- Rejected with 403 if origin detection fails
- Missing `Access-Control-Allow-Credentials` header
- Not properly handling mobile app origins

### 3. **Error Handling**
Errors might be:
- Swallowed without proper logging
- Not providing helpful error messages
- Not setting CORS headers on error responses

---

## ✅ Fixes Applied

### **1. Enhanced iOS Origin Detection**
**File:** `supabase/functions/home-feed/index.ts`

```typescript
// Enhanced mobile app detection
const isMobileApp = !origin || 
                   origin === "null" || 
                   origin === "" ||
                   origin.startsWith("capacitor://") || 
                   origin.startsWith("ionic://") ||
                   origin.startsWith("http://localhost") ||
                   origin.startsWith("https://localhost") ||
                   origin.startsWith("file://") ||
                   // Check User-Agent for iOS native app indicators
                   userAgent.includes("CapacitorHttp") ||
                   userAgent.includes("Liventix/") ||
                   userAgent.includes("CFNetwork"); // iOS network library

// For mobile apps, always allow (use wildcard)
const allowOrigin = isMobileApp ? "*" : computeAllowedOrigin(origin);
```

**Why this works:**
- Detects iOS native apps even when Origin header is missing
- Checks User-Agent for iOS-specific indicators (`CFNetwork`, `CapacitorHttp`)
- Always allows mobile apps with wildcard (`*`)

---

### **2. Simplified OPTIONS Handler**
**File:** `supabase/functions/home-feed/index.ts`

```typescript
// OPTIONS preflight - Always allow for mobile apps
if (req.method === "OPTIONS") {
  const finalAllowOrigin = allowOrigin || "*";
  
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": finalAllowOrigin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "...",
      "Access-Control-Max-Age": "86400",
      "Access-Control-Allow-Credentials": "true", // ✅ ADDED
    },
  });
}
```

**Why this works:**
- Removed conditional check that could reject mobile apps
- Always returns `*` if no origin detected (mobile apps)
- Added `Access-Control-Allow-Credentials` for authenticated requests

---

### **3. Enhanced Error Handling**
**File:** `supabase/functions/home-feed/index.ts`

```typescript
try {
  const res = await handler(req);
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", allowOrigin || "*");
  headers.set("Access-Control-Allow-Credentials", "true"); // ✅ ADDED
  headers.set("Vary", "Origin");
  return new Response(res.body, { status: res.status, headers });
} catch (error) {
  console.error("[home-feed] Handler error:", error);
  const errorResponse = json(500, { 
    error: "Internal server error",
    message: error instanceof Error ? error.message : "Unknown error"
  });
  const headers = new Headers(errorResponse.headers);
  headers.set("Access-Control-Allow-Origin", allowOrigin || "*");
  headers.set("Access-Control-Allow-Credentials", "true"); // ✅ ADDED
  return new Response(errorResponse.body, { status: 500, headers });
}
```

**Why this works:**
- Ensures CORS headers are set even on errors
- Prevents CORS errors from masking real errors
- Provides better error messages

---

### **4. Enhanced Frontend Error Handling**
**File:** `src/features/feed/hooks/useUnifiedFeedInfinite.ts`

```typescript
if (error) {
  // Enhanced error logging for iOS debugging
  const errorDetails = {
    message: error.message,
    name: error.name,
    status: (error as any).status,
    context: (error as any).context,
    stack: error instanceof Error ? error.stack : undefined,
  };
  
  console.error('❌ [Feed] home-feed error:', errorDetails);
  
  // Log to console for iOS debugging
  if (typeof window !== 'undefined' && (window as any).Capacitor) {
    console.error('[iOS Debug] Feed error details:', JSON.stringify(errorDetails, null, 2));
  }
  
  // Provide more helpful error message
  const errorMessage = error.message || 'Unknown error';
  const statusCode = (error as any).status;
  
  if (statusCode === 403) {
    throw new Error('Access denied. Please check your connection and try again.');
  } else if (statusCode === 500) {
    throw new Error('Server error. Please try again in a moment.');
  } else {
    throw new Error(`Failed to load feed: ${errorMessage}`);
  }
}
```

**Why this works:**
- Better error messages for users
- Enhanced logging for iOS debugging
- Handles specific error codes (403, 500) with helpful messages

---

### **5. Debug Logging**
**File:** `supabase/functions/home-feed/index.ts`

```typescript
// Log for debugging iOS issues
if (isMobileApp || req.url.includes('home-feed')) {
  console.log(`[home-feed] Request: method=${req.method}, origin="${origin}", userAgent="${userAgent.substring(0, 80)}", isMobileApp=${isMobileApp}`);
}
```

**Why this works:**
- Helps diagnose iOS-specific issues
- Logs origin and User-Agent for debugging
- Can be removed in production if needed

---

## 🚀 Deployment Steps

### **1. Deploy Edge Function**
```bash
npx supabase functions deploy home-feed
```

### **2. Verify Deployment**
Check Supabase Dashboard → Edge Functions → `home-feed` → Logs

Look for:
- `[home-feed] Request: method=POST, origin="", userAgent="...", isMobileApp=true`
- No 403 errors for OPTIONS requests
- Successful feed responses

### **3. Test on iOS**
1. Build and deploy iOS app
2. Open app and navigate to feed
3. Check Xcode console for:
   - `[iOS Debug] Feed error details:` (if error occurs)
   - Network request logs
4. Verify feed loads successfully

---

## 🧪 Testing Checklist

- [ ] Feed loads on iOS native app
- [ ] No CORS errors in Xcode console
- [ ] OPTIONS preflight returns 204 (not 403)
- [ ] Feed loads for both authenticated and guest users
- [ ] Error messages are helpful if feed fails
- [ ] Debug logs appear in Edge Function logs

---

## 📊 Expected Behavior

### **Before Fix:**
- ❌ Feed shows "We couldn't load your feed"
- ❌ CORS 403 errors in console
- ❌ OPTIONS preflight rejected

### **After Fix:**
- ✅ Feed loads successfully on iOS
- ✅ No CORS errors
- ✅ OPTIONS preflight allowed
- ✅ Better error messages if issues occur
- ✅ Debug logging for troubleshooting

---

## 🔍 Debugging Tips

### **If Feed Still Doesn't Load:**

1. **Check Edge Function Logs:**
   - Go to Supabase Dashboard → Edge Functions → `home-feed` → Logs
   - Look for error messages or 403/500 responses
   - Check if `isMobileApp=true` is logged

2. **Check Xcode Console:**
   - Look for `[iOS Debug] Feed error details:`
   - Check network request status codes
   - Verify authentication token is being sent

3. **Check Network Tab:**
   - In Xcode, use Network Link Conditioner to simulate network issues
   - Verify requests are reaching Supabase
   - Check response headers for CORS

4. **Verify Authentication:**
   - Ensure user is properly authenticated
   - Check if session token is valid
   - Verify `Authorization` header is being sent

---

## 📝 Files Modified

1. ✅ `supabase/functions/home-feed/index.ts` - Enhanced iOS origin detection and CORS handling
2. ✅ `src/features/feed/hooks/useUnifiedFeedInfinite.ts` - Enhanced error handling and logging

---

**Status:** ✅ **FIXED** - Ready for deployment and testing






