# 🚀 Rebrand Quick Start: Liventix → Liventix

---

## 📊 **Scope**

- **Files affected:** 362 files
- **Text replacements:** 1,240 instances
- **Time estimate:** 2-4 hours
- **Difficulty:** Moderate

---

## ⚡ **Quick Steps**

### **1. Backup & Branch**
```bash
git checkout -b rebrand-to-liventix
git add .
git commit -m "Pre-rebrand checkpoint"
```

### **2. Run Automated Script** 
```bash
./REBRAND_TO_LIVENTIX.sh
```
Type `YES` to confirm and let it run (~2-3 minutes)

### **3. Update Critical Files Manually**

**package.json:**
```json
{
  "name": "liventix"
}
```

**index.html:**
```html
<title>Liventix - Live Event Ticketing</title>
```

**capacitor.config.ts:**
```typescript
appId: 'com.liventix.app',
appName: 'Liventix'
```

**public/manifest.json:**
```json
{
  "name": "Liventix",
  "short_name": "Liventix"
}
```

### **4. Verify Changes**
```bash
./VERIFY_REBRAND.sh
```

### **5. Test Locally**
```bash
npm run dev
```
Check that branding shows "Liventix" everywhere

### **6. Commit & Deploy**
```bash
git add .
git commit -m "Rebrand: Liventix → Liventix"
git push origin rebrand-to-liventix

# Deploy
npm run build
supabase functions deploy --all
# Deploy to your hosting
```

---

## 📋 **What Gets Replaced**

| Old | New |
|-----|-----|
| `Liventix` | `Liventix` |
| `liventix` | `liventix` |
| `LIVENTIX` | `LIVENTIX` |
| `Yardpass` | `Liventix` |

---

## 🎨 **Don't Forget**

- [ ] Replace logo images in `public/` folder
- [ ] Update iOS app icon in `ios/App/App/Assets.xcassets/`
- [ ] Update Android app icon in `android/app/src/main/res/`
- [ ] Update Stripe business name
- [ ] Update email "From" name in Resend
- [ ] Announce rebrand to users

---

## ⚠️ **What NOT to Change**

- Database table names ❌
- Supabase project URL (unless migrating) ❌
- Git repo name (optional) ⚠️
- Old URLs (keep for redirects) ⚠️

---

## 📞 **Need Help?**

See detailed guides:
- `REBRAND_CHECKLIST.md` - Complete checklist
- `git diff` - See all changes
- `./VERIFY_REBRAND.sh` - Verify completion

---

## 🎯 **Expected Result**

**Before:**
```
Liventix - Live Event Ticketing
```

**After:**
```
Liventix - Live Event Ticketing
```

Everywhere: app name, emails, titles, branding ✨

---

**Ready? Run the script!**

```bash
./REBRAND_TO_LIVENTIX.sh
```

🎉 **Welcome to Liventix!**


