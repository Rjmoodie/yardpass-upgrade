# Hostinger Deployment Notes

## ⚠️ Critical: `.htaccess` File Must Be Uploaded

The `.htaccess` file is **essential** for:
1. **SPA Routing** - React Router won't work without it
2. **Service Worker** - Must be served with correct headers
3. **Caching** - Browser caching for performance

### ✅ Verification Steps

1. **After uploading `dist` folder to Hostinger:**
   - Verify `.htaccess` file is in the root directory
   - Check file permissions (should be 644 or 755)
   - Ensure it's not blocked by server security

2. **Test the `.htaccess` file:**
   ```bash
   # Should return 200 OK, not 403
   curl -I https://liventix.tech/.htaccess
   ```

3. **Check service worker:**
   ```bash
   # Should return 200 OK with Content-Type: application/javascript
   curl -I https://liventix.tech/sw.js
   ```

### 🔧 If You Get 403 Errors

**Possible causes:**
1. `.htaccess` file not uploaded
2. File permissions incorrect
3. Hostinger security blocking `.htaccess`
4. Apache `mod_rewrite` not enabled

**Solutions:**
1. **Re-upload `.htaccess` file** to root directory
2. **Check file permissions** in Hostinger File Manager:
   - Right-click `.htaccess` → Properties
   - Set permissions to `644` or `755`
3. **Contact Hostinger support** if `.htaccess` is being blocked
4. **Verify Apache modules** are enabled:
   - `mod_rewrite`
   - `mod_headers`
   - `mod_mime`
   - `mod_deflate`
   - `mod_expires`

### 📋 `.htaccess` File Location

- **Source:** `public/.htaccess`
- **Build output:** `dist/.htaccess`
- **Server location:** Root directory (same level as `index.html`)

### 🚨 Common Issues

#### Issue: 403 Forbidden on Service Worker
**Solution:** Ensure `.htaccess` includes service worker headers:
```apache
<FilesMatch "sw\.js$">
  Header set Content-Type "application/javascript; charset=utf-8"
  Header set Service-Worker-Allowed "/"
</FilesMatch>
```

#### Issue: React Router routes return 404
**Solution:** Ensure SPA fallback rule is in `.htaccess`:
```apache
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

#### Issue: Service worker can't cache assets
**Solution:** Check that assets are accessible (not returning 403):
- Verify file permissions
- Check server logs for blocked requests
- Ensure no security plugins are blocking service worker

### ✅ Post-Deployment Checklist

- [ ] `.htaccess` file uploaded to root directory
- [ ] File permissions set to 644 or 755
- [ ] Service worker loads without 403 error
- [ ] React Router routes work (test `/tickets`, `/profile`, etc.)
- [ ] Static assets load correctly
- [ ] No 403 errors in browser console

---

**Last Updated:** June 2, 2025

