# 🎨 Rebrand Checklist: Liventix → Liventix

**Status:** Ready to Execute  
**Scope:** 1,240 replacements across 362 files

---

## 📋 **Pre-Rebrand Checklist**

### **1. Backup Everything**
```bash
# Create a branch for the rebrand
git checkout -b rebrand-to-liventix

# Or create a backup
cp -r . ../liventix-backup
```

### **2. Commit Current Work**
```bash
git add .
git commit -m "Pre-rebrand checkpoint"
```

---

## 🤖 **Automated Rebrand (Run Script)**

```bash
chmod +x REBRAND_TO_LIVENTIX.sh
./REBRAND_TO_LIVENTIX.sh
```

**This will replace:**
- `Liventix` → `Liventix`
- `liventix` → `liventix`
- `LIVENTIX` → `LIVENTIX`
- `Yardpass` → `Liventix`

---

## ✅ **Post-Rebrand Manual Tasks**

### **1. Update Package.json** ⚠️ CRITICAL
```json
{
  "name": "liventix",
  "description": "Liventix - Live Event Ticketing Platform",
  "version": "2.0.0"
}
```

### **2. Update Capacitor Config** ⚠️ CRITICAL
```typescript
// capacitor.config.ts
const config: CapacitorConfig = {
  appId: 'com.liventix.app',
  appName: 'Liventix',
  webDir: 'dist',
  // ...
};
```

### **3. Update PWA Manifest** ⚠️ CRITICAL
```json
// public/manifest.json
{
  "name": "Liventix",
  "short_name": "Liventix",
  "description": "Live Event Ticketing Platform",
  // ...
}
```

### **4. Update Index.html** ⚠️ CRITICAL
```html
<!-- index.html -->
<title>Liventix - Live Event Ticketing</title>
<meta name="description" content="Liventix - Live Event Ticketing Platform">
<meta property="og:site_name" content="Liventix">
```

### **5. Update iOS Info.plist** ⚠️ CRITICAL
```xml
<!-- ios/App/App/Info.plist -->
<key>CFBundleDisplayName</key>
<string>Liventix</string>
<key>CFBundleName</key>
<string>Liventix</string>
```

### **6. Replace Logo Images** 🎨
```bash
# Replace these files with new Liventix branding:
public/logo.png
public/logo-192x192.png
public/logo-512x512.png
public/apple-touch-icon.png
public/favicon.ico
ios/App/App/Assets.xcassets/AppIcon.appiconset/
android/app/src/main/res/mipmap-*/ic_launcher.png
```

### **7. Update Email Templates** 📧
Check all email templates in:
- `supabase/functions/send-*-confirmation/`
- `supabase/functions/send-email/`
- `src/components/EmailTemplates.tsx`

Make sure logos and branding are updated.

### **8. Update Supabase Project Name** (Optional)
- Go to Supabase Dashboard
- Project Settings → rename if desired

### **9. Update Environment Variables** (If needed)
```bash
# .env files
VITE_APP_NAME=Liventix
VITE_SITE_URL=https://liventix.com
```

### **10. Update Stripe Business Name** 💳
- Go to: https://dashboard.stripe.com/settings/public
- Update "Business name" to "Liventix"
- Update "Statement descriptor" to "LIVENTIX"

### **11. Update Resend Domain** (If applicable) 📧
- Go to: https://resend.com/domains
- Add new domain: mail.liventix.com
- Update FROM email addresses

### **12. Update README.md**
```markdown
# Liventix

Live Event Ticketing Platform

## About
Liventix is a modern event ticketing platform...
```

---

## 🧪 **Testing Checklist**

### **Frontend Tests:**
- [ ] Home page loads with "Liventix" branding
- [ ] Login/signup pages show "Liventix"
- [ ] Email templates display correctly
- [ ] PWA manifest shows "Liventix"
- [ ] Browser tab title shows "Liventix"
- [ ] Sharing links show "Liventix"
- [ ] All navigation mentions "Liventix"

### **Backend Tests:**
- [ ] Emails send with "Liventix" branding
- [ ] Stripe receipts show "Liventix"
- [ ] QR codes work (branding is cosmetic)
- [ ] Webhooks still function
- [ ] Edge Functions deploy successfully

### **Mobile Tests (iOS/Android):**
- [ ] App name shows as "Liventix" on home screen
- [ ] Splash screen shows Liventix logo
- [ ] Push notifications mention "Liventix"
- [ ] Share sheet shows "Liventix"
- [ ] Deep links still work

---

## 🚀 **Deployment Steps**

### **1. Build & Test Locally**
```bash
npm install
npm run build
npm run dev  # Test locally
```

### **2. Deploy Edge Functions**
```bash
supabase functions deploy --all
```

### **3. Deploy Frontend**
```bash
# Your deployment command
npm run build
# Deploy to your hosting
```

### **4. Update Mobile Apps**
```bash
# iOS
npx cap sync ios
cd ios/App
# Open in Xcode, update branding, rebuild

# Android
npx cap sync android
cd android
# Open in Android Studio, update branding, rebuild
```

### **5. Submit to App Stores**
- App Store: New app submission as "Liventix"
- Google Play: New app submission as "Liventix"

---

## ⚠️ **Important Notes**

### **What NOT to Change:**
- ❌ Database table names (will break queries)
- ❌ Supabase project URL (unless migrating)
- ❌ Old deployed URLs (keep for redirects)
- ❌ Git repository name (optional, can stay liventix)
- ❌ Stripe product IDs (they're UUIDs)

### **Domain Migration:**
If you're also changing domains:
1. Register new domain (liventix.com)
2. Set up DNS records
3. Update Supabase allowed domains
4. Update Stripe webhook URLs
5. Set up 301 redirects from old domain

---

## 🎊 **Post-Launch**

### **Announce the Rebrand:**
- [ ] Update social media profiles
- [ ] Send email to existing users
- [ ] Update marketing materials
- [ ] Update support documentation
- [ ] Update API documentation
- [ ] Press release (if applicable)

### **Monitor:**
- [ ] Check for broken links
- [ ] Monitor error logs
- [ ] Check email deliverability
- [ ] Verify all payment flows
- [ ] Test ticket generation
- [ ] Verify QR code scanning

---

## 📞 **Support**

If you encounter issues:
1. Check git diff to see all changes
2. Revert specific files if needed
3. Test edge functions individually
4. Check Supabase logs
5. Monitor Stripe dashboard

---

## 🎯 **Summary**

**Automated:** 1,240 text replacements ✅  
**Manual:** ~12 critical files to update ⚠️  
**Testing:** ~20 test cases to verify ✅  
**Deploy:** 4 deployment steps 🚀  

**Estimated Time:** 2-4 hours for complete rebrand

---

## ✅ **Final Checklist**

Before going live:
- [ ] All tests pass
- [ ] Logos replaced everywhere
- [ ] Emails look correct
- [ ] Stripe branding updated
- [ ] Mobile apps rebuilt
- [ ] Domain configured (if new)
- [ ] Redirects set up (if applicable)
- [ ] Documentation updated
- [ ] Team informed
- [ ] Users notified

---

**Ready to rebrand? Run the script!** 🎨

```bash
./REBRAND_TO_LIVENTIX.sh
```


