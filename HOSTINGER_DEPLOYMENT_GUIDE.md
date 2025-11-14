# 🚀 Hostinger Deployment Guide for Liventix

## 🎯 Issue: Feed Shows "Refresh Feed" Error

When your app is deployed to Hostinger but the feed isn't loading, it's showing the error state from `FeedPageNewDesign.tsx` line 499-507.

---

## 🔍 Root Causes & Solutions

### **1. SPA Routing Not Configured** ⚠️ **MOST COMMON**

**Problem:**  
Hostinger serves `index.html` for the root `/` but returns **404 errors** for routes like `/tickets`, `/profile`, etc. This breaks React Router.

**Solution:**  
Add a `.htaccess` file to redirect all routes to `index.html`:

**Create this file:** `public/.htaccess`

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # Don't rewrite files or directories
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  
  # Rewrite everything else to index.html
  RewriteRule ^ index.html [L]
</IfModule>

# Enable CORS for API calls
<IfModule mod_headers.c>
  Header set Access-Control-Allow-Origin "*"
  Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
  Header set Access-Control-Allow-Headers "Content-Type, Authorization"
</IfModule>

# Enable Gzip compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
  ExpiresByType application/json "access plus 1 week"
  ExpiresByType text/html "access plus 0 seconds"
</IfModule>
```

---

### **2. CORS Issues with Supabase** ⚠️

**Problem:**  
Hostinger domain not whitelisted in Supabase, causing API calls to fail.

**Solution:**

1. **Go to Supabase Dashboard:**
   - Open: https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz
   - Navigate to: **Settings** → **API** → **URL Configuration**

2. **Add your Hostinger domain to allowed origins:**
   ```
   https://yourdomain.com
   https://www.yourdomain.com
   ```

3. **Check Site URL:**
   - Settings → Auth → Site URL
   - Set to: `https://yourdomain.com`

4. **Add Redirect URLs:**
   - Settings → Auth → Redirect URLs
   - Add:
     ```
     https://yourdomain.com/**
     https://www.yourdomain.com/**
     ```

---

### **3. Missing Environment Variables** ⚠️

**Problem:**  
Hostinger build doesn't have access to environment variables during build.

**Solution:**

Your app has **hardcoded fallbacks** (good!), but verify:

**File:** `src/config/env.ts` lines 33-40

```typescript
VITE_SUPABASE_URL: import.meta.env?.VITE_SUPABASE_URL || 'https://yieslxnrfeqchbcmgavz.supabase.co',
VITE_SUPABASE_ANON_KEY: import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGci...',
```

✅ These fallbacks ensure your app works even without .env file!

---

### **4. Build Path Issues** ⚠️

**Problem:**  
Assets not found (404s) because paths are incorrect.

**Solution:**

Check `vite.config.ts` - ensure base path is correct:

```typescript
export default defineConfig({
  base: '/',  // Use '/' for root domain, or '/subfolder/' if in subdirectory
  // ...
});
```

If your site is at `https://yourdomain.com` → Use `base: '/'`  
If your site is at `https://yourdomain.com/app/` → Use `base: '/app/'`

---

### **5. RLS Policies Blocking Public Data** ⚠️

**Problem:**  
Database Row Level Security policies might be blocking public feed access.

**Solution:**

Check your RLS policies allow **anonymous** access to feed data:

```sql
-- Check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('events', 'event_posts', 'user_profiles')
ORDER BY tablename, policyname;

-- Ensure public SELECT is allowed on events
CREATE POLICY "Public events are viewable by everyone"
ON events FOR SELECT
TO anon, authenticated
USING (is_public = true OR status = 'published');

-- Ensure public SELECT on event_posts  
CREATE POLICY "Public posts viewable"
ON event_posts FOR SELECT
TO anon, authenticated
USING (true);  -- Or add your visibility logic
```

---

## 📁 Hostinger Deployment Steps

### **Step 1: Build Your App**

```bash
npm run build
```

This creates the `dist/` folder with:
- `index.html`
- `assets/` folder (all JS/CSS)
- `liventix-logo.png`
- Other static assets

### **Step 2: Create .htaccess File**

Create `public/.htaccess` with the content above, then rebuild:

```bash
npm run build
```

The `.htaccess` file will be copied to `dist/.htaccess`.

### **Step 3: Upload to Hostinger**

**Option A: File Manager (Easy)**

1. Log in to Hostinger control panel
2. Go to **Files** → **File Manager**
3. Navigate to `public_html/` (or your domain folder)
4. **Delete all existing files** in that folder
5. **Upload everything from your `dist/` folder:**
   - `index.html`
   - `.htaccess`
   - `assets/` folder
   - `manifest.json`
   - `liventix-logo.png`
   - All other files

**Option B: FTP (Recommended for large uploads)**

1. Get FTP credentials from Hostinger:
   - Hosting → Manage → **FTP Accounts**
   - Use hostname, username, password

2. Use FileZilla or WinSCP:
   ```
   Host: ftp.yourdomain.com
   Username: [from Hostinger]
   Password: [from Hostinger]
   Port: 21
   ```

3. Upload `dist/` contents to `public_html/`

**Option C: SSH (Fastest)**

1. Enable SSH in Hostinger:
   - Advanced → **SSH Access** → Enable

2. Upload via SCP:
   ```bash
   scp -r dist/* username@yourdomain.com:public_html/
   ```

### **Step 4: Verify Deployment**

1. **Clear browser cache** (Ctrl+Shift+R)
2. Visit `https://yourdomain.com`
3. **Open DevTools** → Console tab
4. Check for errors:
   - ❌ 404 errors on assets → Check paths
   - ❌ CORS errors → Update Supabase settings
   - ❌ Network errors → Check Supabase connection

---

## 🐛 Debugging Feed Error on Hostinger

### **Check 1: Open Browser DevTools**

Press **F12** → **Console** tab

Look for errors like:
```
❌ Failed to fetch
❌ CORS policy: No 'Access-Control-Allow-Origin'
❌ 404 (Not Found) on /assets/...
❌ Supabase connection error
```

### **Check 2: Network Tab**

Press **F12** → **Network** tab → Refresh

Look for:
- ❌ Red/failed requests to Supabase
- ❌ 404s on JS/CSS files
- ❌ CORS errors

### **Check 3: Check Supabase Connection**

Add this temporary debug in `src/config/env.ts`:

```typescript
// After line 90, add:
console.log('🔍 Supabase Config:', {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey,
  keyPreview: supabaseAnonKey?.substring(0, 20) + '...'
});
```

Rebuild and check console to ensure Supabase credentials are loaded.

### **Check 4: Test Supabase Directly**

Open browser console on your deployed site and run:

```javascript
// Test Supabase connection
fetch('https://yieslxnrfeqchbcmgavz.supabase.co/rest/v1/events?select=id,title&limit=1', {
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY'
  }
})
.then(r => r.json())
.then(d => console.log('✅ Supabase works:', d))
.catch(e => console.error('❌ Supabase error:', e));
```

If this returns events → Supabase works  
If this errors → CORS or RLS issue

---

## 📋 Quick Deployment Checklist

### Before Deploying:

- [ ] Create `public/.htaccess` file for SPA routing
- [ ] Run `npm run build` locally
- [ ] Test with `npm run preview` (localhost:4173)
- [ ] Verify feed works locally

### On Hostinger:

- [ ] Upload all `dist/` contents to `public_html/`
- [ ] Verify `.htaccess` is uploaded
- [ ] Check file permissions (755 for folders, 644 for files)
- [ ] Clear browser cache and test

### In Supabase Dashboard:

- [ ] Add Hostinger domain to allowed origins
- [ ] Set Site URL to your domain
- [ ] Add redirect URLs
- [ ] Verify RLS policies allow public SELECT

### Test Deployed App:

- [ ] Feed loads (shows events/posts)
- [ ] Navigation works (routes don't 404)
- [ ] Auth works (login/signup)
- [ ] Modals scroll properly
- [ ] Bottom nav doesn't overlap content

---

## 🎯 Most Likely Fix

**Create the `.htaccess` file:**

1. Create `public/.htaccess` with the Apache config above
2. Rebuild: `npm run build`
3. Re-upload to Hostinger
4. Clear cache and test

This fixes **90% of SPA routing issues** on Hostinger.

---

## 🆘 If Still Not Working

Send me:
1. Your Hostinger domain URL
2. Browser console errors (screenshot or copy/paste)
3. Network tab errors (F12 → Network → filter for failed requests)

And I'll help you debug the specific issue!


