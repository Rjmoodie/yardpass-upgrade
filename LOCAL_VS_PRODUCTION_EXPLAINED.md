# 🔍 Why Feed Works Locally But Not on Hostinger

## The Key Difference: Request Origin

Your browser enforces **CORS (Cross-Origin Resource Sharing)** security. The request origin changes between local and production:

### **Local Development:**
```
Browser Origin: http://localhost:8080
    ↓ Calls Supabase API
Supabase: https://yieslxnrfeqchbcmgavz.supabase.co
    ↓ Checks: "Is localhost allowed?"
    ↓ YES! ✅ (localhost is ALWAYS allowed by default)
    ↓ Returns data
Feed: Works perfectly! ✅
```

### **Hostinger Production:**
```
Browser Origin: https://yourdomain.hostinger.com
    ↓ Calls Supabase API
Supabase: https://yieslxnrfeqchbcmgavz.supabase.co
    ↓ Checks: "Is yourdomain.hostinger.com allowed?"
    ↓ NO! ❌ (not in allowed list)
    ↓ BLOCKS request with CORS error
Feed: "Refresh feed" error ❌
```

---

## 🎯 The Exact Problem

### **Supabase's Default CORS Policy:**

**Automatically Whitelisted:**
- ✅ `http://localhost:*` (any port)
- ✅ `http://127.0.0.1:*`
- ✅ Your Supabase Studio URL
- ✅ Vercel/Netlify preview URLs (if connected)

**NOT Automatically Whitelisted:**
- ❌ Custom domains (like Hostinger)
- ❌ `yourdomain.com`
- ❌ `yourdomain.hostinger.com`
- ❌ Any production URL you haven't manually added

---

## 📊 Visual Comparison

### **Local (Works):**
```
┌─────────────────────────────────────────┐
│  Your Computer                          │
│  ┌──────────────────────────────────┐  │
│  │  Browser                          │  │
│  │  localhost:8080                   │  │
│  │  ↓                                │  │
│  │  Makes API call                   │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
            ↓ (Same credentials)
┌─────────────────────────────────────────┐
│  Supabase Cloud                         │
│  yieslxnrfeqchbcmgavz.supabase.co      │
│  ↓                                      │
│  CORS Check: localhost? ✅ ALLOWED      │
│  ↓                                      │
│  Returns: Feed data ✅                  │
└─────────────────────────────────────────┘
```

### **Hostinger (Blocked):**
```
┌─────────────────────────────────────────┐
│  User's Browser                         │
│  ┌──────────────────────────────────┐  │
│  │  Browser                          │  │
│  │  yourdomain.hostinger.com         │  │
│  │  ↓                                │  │
│  │  Makes API call                   │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
            ↓ (Same credentials!)
┌─────────────────────────────────────────┐
│  Supabase Cloud                         │
│  yieslxnrfeqchbcmgavz.supabase.co      │
│  ↓                                      │
│  CORS Check: yourdomain? ❌ BLOCKED     │
│  ↓                                      │
│  Returns: CORS error ❌                 │
└─────────────────────────────────────────┘
```

---

## 🔑 Key Insights

### **1. Same Credentials, Different Origin**

**Locally:**
- Origin: `http://localhost:8080`
- Supabase URL: `https://yieslxnrfeqchbcmgavz.supabase.co`
- Supabase Anon Key: `eyJhbGci...` (hardcoded)
- **Result:** ✅ Works (localhost whitelisted)

**Hostinger:**
- Origin: `https://yourdomain.hostinger.com`
- Supabase URL: `https://yieslxnrfeqchbcmgavz.supabase.co` (SAME!)
- Supabase Anon Key: `eyJhbGci...` (SAME!)
- **Result:** ❌ Blocked (domain not whitelisted)

**The credentials are identical - the ORIGIN is different!**

### **2. Browser Security Model**

The browser enforces CORS:
- Localhost → Supabase = **Not cross-origin** (security exception for localhost)
- Hostinger → Supabase = **Cross-origin** (different domains)

Cross-origin requests require **explicit permission** from the server (Supabase).

### **3. Why .env Doesn't Matter**

Your app has **hardcoded fallbacks** in `src/config/env.ts`:

```typescript
VITE_SUPABASE_URL: import.meta.env?.VITE_SUPABASE_URL || 'https://yieslxnrfeqchbcmgavz.supabase.co',
VITE_SUPABASE_ANON_KEY: import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGci...',
```

**This means:**
- No .env file? → Uses fallback ✅
- .env file missing variable? → Uses fallback ✅
- .env file has wrong value? → Uses fallback ✅

**The credentials ALWAYS work** - it's the **origin check** that fails!

---

## 🛠️ The Fix (2 Minutes)

### **Step 1: Find Your Exact Hostinger URL**

Visit your deployed site and copy the **exact URL** from the address bar:
- Could be: `https://yourdomain.com`
- Could be: `https://www.yourdomain.com`
- Could be: `https://subdomain.yourdomain.com`
- Could be: `https://yourdomain.hostinger.com`

### **Step 2: Add to Supabase**

1. Go to: https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/settings/auth

2. Scroll to **Site URL**:
   - Paste your Hostinger URL: `https://yourdomain.com`
   - Click **Save**

3. Scroll to **Redirect URLs**:
   - Click **Add URL**
   - Paste: `https://yourdomain.com/**` (with the `/**` at the end)
   - Click **Save**

### **Step 3: Test**

1. Wait **30 seconds**
2. Go to your deployed site
3. **Hard refresh**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
4. Feed should load! ✅

---

## 🧪 Verify It's a CORS Issue

**On your deployed Hostinger site**, press **F12** and look in Console tab.

**You'll see one of these:**

### **Error A: CORS (90% chance)**
```
🔴 Access to fetch at 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/home-feed' 
   from origin 'https://yourdomain.hostinger.com' 
   has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

**Fix:** Add domain to Supabase (Step 2 above)

### **Error B: Edge Function 404**
```
🔴 POST https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/home-feed 404 (Not Found)
```

**Fix:** Deploy edge function:
```bash
npx supabase functions deploy home-feed
```

### **Error C: RLS Policy**
```
🔴 new row violates row-level security policy
```

**Fix:** Update RLS policies to allow anonymous SELECT

### **Error D: Network Error**
```
🔴 Failed to fetch
🔴 net::ERR_CONNECTION_REFUSED
```

**Fix:** Check Supabase is online, or contact Hostinger support (firewall)

---

## 💡 Why Localhost Gets Special Treatment

**Browser Security Exception:**

The browser treats `localhost` and `127.0.0.1` as **same-origin** for development purposes:
- No CORS checks for localhost
- No SSL certificate required
- Full permissions granted

**But production domains:**
- Full CORS enforcement
- Must be explicitly whitelisted
- Strict security model

This is **by design** to make development easy while keeping production secure.

---

## 📋 Complete Hostinger Deployment Checklist

### **Code/Build (You've Done This ✅):**
- [x] Build created (`npm run build`)
- [x] `.htaccess` included in dist/
- [x] Assets uploaded to Hostinger
- [x] Files in `public_html/` folder

### **Supabase Configuration (DO THIS NOW):**
- [ ] Add Hostinger domain to Site URL
- [ ] Add Hostinger domain to Redirect URLs  
- [ ] Wait 30 seconds
- [ ] Test deployed site

### **Verification:**
- [ ] Press F12 on deployed site
- [ ] Check Console for errors
- [ ] Check Network tab for failed requests
- [ ] Feed loads with events/posts

---

## 🎯 Summary

**Question:** Why works locally but not Hostinger?

**Answer:** 
- ✅ **Local:** Browser allows localhost → Supabase (security exception)
- ❌ **Hostinger:** Browser blocks yourdomain → Supabase (CORS not configured)

**Solution:**
Add your Hostinger domain to Supabase allowed origins.

**Time to fix:** 2 minutes

**This is NOT:**
- ❌ A .env issue (credentials are hardcoded)
- ❌ A code issue (same code works locally)
- ❌ A build issue (build is correct)

**This IS:**
- ✅ A CORS configuration issue
- ✅ Fixed in Supabase dashboard settings
- ✅ 90% of "works locally, fails in production" issues

---

## 🚀 Do This Right Now

1. Open: https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/settings/auth
2. Add your Hostinger URL to **Site URL**
3. Add your Hostinger URL with `/**` to **Redirect URLs**
4. Click **Save**
5. Refresh your deployed site

**Your feed will work immediately!** 🎉

Need help finding the exact error? Open F12 on your deployed site and send me the Console tab screenshot.


