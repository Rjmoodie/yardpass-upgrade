# Multi-Issue Fixes Summary

## Issues Fixed ✅

### 1. **Email Logo Not Showing**
**Problem:** Logo wasn't displaying in emails, and dark gradient header was causing appearance issues.

**Fix:**
- Updated email header background from dark gradient to neutral gray (`#fafafa`) matching single-color scheme
- Changed logo URL to use `https://liventix.tech/liventix-logo-full.png` (absolute URL)
- Logo URL now prioritizes org logo if available, falls back to Liventix logo

**Files Changed:**
- `supabase/functions/send-purchase-confirmation/index.ts`

### 2. **Yardpass Reference Removed**
**Problem:** Found "YardPass" in page title.

**Fix:**
- Changed `<title>{event.title} | YardPass</title>` to `<title>{event.title} | Liventix</title>`

**Files Changed:**
- `src/pages/new-design/EventDetailsPage.tsx`

### 3. **Going Counter Not Tracking Unique Users**
**Problem:** Counter was incrementing on every click instead of tracking unique users per event.

**Fix:**
- Changed from separate `insert`/`update` logic to `upsert` with conflict handling on `(user_id, event_id)`
- Added refetch of actual count from database after toggle to ensure accuracy
- Removed optimistic local state updates that could drift from database

**Files Changed:**
- `src/pages/new-design/EventDetailsPage.tsx`

---

## Issues Remaining 🔄

### 4. **Scanner Not Loading**
**Status:** Need to debug initialization issue.

**Possible Causes:**
- Camera permissions not granted
- BarcodeDetector API not supported on device
- Route or lazy loading issue

**Next Steps:**
- Check browser console for errors
- Verify camera permissions
- Test on different devices/browsers
- Check if `ScannerPage` lazy load is completing

**Files to Check:**
- `src/components/scanner/ScannerView.tsx`
- `src/components/ScannerPage.tsx`
- `src/App.tsx` (route definition)

### 5. **User Profile Banner Upload**
**Status:** Currently only organizations can change banners, not user profiles.

**Current State:**
- ✅ Organizations can upload banners via `OrganizationProfilePage.tsx`
- ❌ User profiles only have `photo_url` (avatar), no `banner_url` field

**Implementation Needed:**
1. Add `banner_url` column to `user_profiles` table (if not exists)
2. Add banner upload UI to `EditProfilePage.tsx`
3. Create storage bucket/folder for user banners
4. Add RLS policies for banner access

**Files to Modify:**
- `src/features/profile/routes/EditProfilePage.tsx` or `src/pages/EditProfilePage.tsx`
- `src/components/ProfilePictureUpload.tsx` (extend or create new component)
- Database migration for `banner_url` column

### 6. **Privacy Policy Placement**
**Status:** Needs verification.

**Current State:**
- ✅ Route exists: `/privacy-policy` → `PrivacyPolicy` component
- ❓ Need to verify:
  - Is it linked in footer/terms?
  - Is it accessible from auth modal?
  - Does it meet business compliance requirements?

**Files to Check:**
- `src/pages/PrivacyPolicy.tsx`
- `src/App.tsx` (route)
- Footer components
- Auth modal links

### 7. **Yardpass Logo in Build Files**
**Status:** User reports seeing Yardpass logo in `dist/` folder.

**Action Required:**
- Search entire codebase for `yardpass-logo` references
- Replace with Liventix logo files
- Ensure build process copies correct logo files
- Check `public/` folder for old Yardpass assets

**Files to Check:**
- `public/` folder contents
- `vite.config.ts` (asset handling)
- `package.json` (build scripts)
- Any logo imports in code

---

## Recommendations

### Immediate Actions:
1. ✅ Test email logo display after deployment
2. ✅ Verify going counter works correctly (no duplicate counting)
3. 🔄 Debug scanner initialization issue
4. 🔄 Remove Yardpass logos from build/dist

### Short-term (Next Sprint):
1. Implement user profile banner upload
2. Verify privacy policy compliance
3. Audit all logo references for Yardpass

### Testing Checklist:
- [ ] Email logo displays correctly
- [ ] Going counter tracks unique users only
- [ ] Scanner loads and initializes properly
- [ ] No Yardpass references remain in codebase
- [ ] Privacy policy is accessible and compliant
- [ ] User profile banner upload works (after implementation)

