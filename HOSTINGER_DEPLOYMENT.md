# 🚀 Hostinger Deployment Guide

## Performance Optimizations Applied

### ✅ Code Optimizations (Automatic)
- LCP image preload with Supabase optimization
- Lazy-loaded routes (Index, Analytics, Dashboard)
- Tree-shaken icons (Lucide)
- Lazy-loaded heavy libraries (Mapbox, HLS, Charts)
- Optimized hero images (WebP, 1920x, quality 85)
- Optimized avatars (WebP, 200x200, quality 85)

### ✅ Server Optimizations (Hostinger)
- Gzip compression enabled (`.htaccess`)
- Browser caching configured (1 year for static assets)
- Cache-Control headers for immutability

---

## 📦 Deployment Steps

### 1. Build Production Bundle

```bash
npm run build
```

This creates an optimized `/dist` folder with:
- Minified JavaScript
- Hashed filenames for cache-busting
- Compressed assets
- **Expected size: ~2-3 MB** (down from 12 MB)

### 2. Upload to Hostinger

**Option A: File Manager**
1. Log into Hostinger control panel
2. Go to **Files** → **File Manager**
3. Navigate to `public_html/`
4. Upload entire `/dist` folder contents
5. Ensure `.htaccess` is uploaded (may be hidden)

**Option B: FTP (Recommended)**
1. Use FileZilla or similar FTP client
2. Connect to your Hostinger FTP:
   - Host: `ftp.yourdomain.com`
   - Username: Your Hostinger username
   - Password: Your Hostinger password
3. Upload `/dist` contents to `public_html/`
4. **Important:** Ensure `.htaccess` is uploaded!

### 3. Verify .htaccess is Working

Visit: `https://yourdomain.com/assets/index-[hash].js`

Check response headers (Chrome DevTools → Network tab):
```
✅ Content-Encoding: gzip
✅ Cache-Control: public, max-age=31536000, immutable
```

---

## 🔧 Hostinger Panel Settings

### Enable Additional Optimizations

1. **Go to:** Hostinger Panel → Website → Optimize
2. **Enable:**
   - ✅ Enable Cloudflare CDN (free)
   - ✅ Enable LiteSpeed Cache (if available)
   - ✅ Enable HTTP/2
   - ✅ Enable Brotli compression (if available)

### Set PHP Version (if needed)
- Go to: Advanced → PHP Version
- Select: PHP 8.2+ (for best performance)

---

## 📊 Expected Performance After Deployment

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| **Performance Score** | 42 | **75-85** | 90+ |
| **LCP** | 11.4s | **2.5-4s** | <2.5s |
| **JS Bundle** | 12.7 MB | **2-3 MB** | <2 MB |
| **FCP** | 3.1s | **1.5-2s** | <1s |
| **TBT** | 280ms | **150-200ms** | <150ms |

---

## 🧪 Testing After Deployment

1. **Clear Cloudflare cache** (if enabled):
   - Hostinger Panel → Cloudflare → Purge Cache

2. **Test with Lighthouse:**
   ```bash
   npx lighthouse https://yourdomain.com --view
   ```

3. **Check compression:**
   ```bash
   curl -I -H "Accept-Encoding: gzip" https://yourdomain.com/assets/index.js
   ```
   Should return: `Content-Encoding: gzip`

---

## 🐛 Troubleshooting

### .htaccess not working?

**Check if mod_rewrite is enabled:**
1. Create `test.php` in `public_html/`:
   ```php
   <?php phpinfo(); ?>
   ```
2. Visit: `https://yourdomain.com/test.php`
3. Search for "mod_rewrite" → should show "Loaded"
4. Delete `test.php` after checking

### Images not optimizing?

**Verify Supabase Storage URLs:**
- Open browser DevTools → Network tab
- Check image URLs should have: `?width=1920&quality=85&format=webp`
- If missing, check `src/utils/imageOptimizer.ts` is imported correctly

### SPA routing not working (404 on refresh)?

**Ensure .htaccess has:**
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## 🎯 Next Level Optimizations (Optional)

### 1. Enable Cloudflare CDN (Free)
- Go to Hostinger Panel → Cloudflare
- Enable free plan
- This adds edge caching globally

### 2. Preload Key Resources
Add to `index.html` (in build output):
```html
<link rel="preconnect" href="https://yieslxnrfeqchbcmgavz.supabase.co">
<link rel="dns-prefetch" href="https://fonts.googleapis.com">
```

### 3. Monitor Performance
- Use Vercel Analytics (free tier)
- Or PostHog Web Vitals tracking
- Set up alerts for LCP > 4s

---

## 📞 Support

If performance scores are still low after deployment:
1. Share Lighthouse report URL
2. Check browser console for errors
3. Verify all `.htaccess` directives are working
4. Test on mobile network (not just WiFi)

---

**Expected Result:** Performance score **75-85** with LCP under **3 seconds** 🚀

