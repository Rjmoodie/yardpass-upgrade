# 🚀 Next Steps - iOS Integration

## ✅ What's Done (Just Completed)

- [x] Installed `@capacitor/camera` and `@capacitor/geolocation`
- [x] Created camera helper functions (`src/lib/camera.ts`)
- [x] Created location hook (`src/hooks/useLocation.ts`)
- [x] Created push notifications hook (`src/hooks/usePushNotifications.ts`)
- [x] Integrated camera button in PostCreatorModal
- [x] Integrated push notifications in App.tsx
- [x] Updated Info.plist with ALL iOS permissions
- [x] Created user_devices migration for push tokens
- [x] Synced Capacitor (web assets + plugins updated)

---

## 🔧 What You Need to Do Now

### 1. Fix CocoaPods & Build (5 minutes)

```bash
cd ios/App
pod repo update
pod install
cd ../..

# Or let Xcode handle it:
npx cap open ios
# In Xcode: File → Packages → Update to Latest Package Versions
```

### 2. Run Database Migration (1 minute)

```bash
# Apply the user_devices table migration
supabase db push

# Or run manually in Supabase SQL Editor:
# Copy contents of: supabase/migrations/20250104_create_user_devices.sql
```

### 3. Test on Real iPhone (30 minutes)

```bash
# Build
npm run build

# Open Xcode
npx cap open ios

# Connect iPhone via USB
# In Xcode: Select your iPhone → Click Run (▶️)
```

**Test These:**
- [ ] Camera button appears in post creator (only on iOS)
- [ ] Tapping camera shows iOS permission prompt
- [ ] Camera/photo picker opens after permission granted
- [ ] Photo uploads successfully
- [ ] "Near Me" filter requests location permission
- [ ] Events near you load correctly
- [ ] Push notification permission requested on login
- [ ] Device token stored in `user_devices` table

### 4. Xcode Capabilities (5 minutes)

In Xcode (App target → Signing & Capabilities):

- [ ] Verify **Signing** is configured (Team selected)
- [ ] Add **Push Notifications** capability
- [ ] Add **Associated Domains** capability
  - Add: `applinks:yardpass.app`
  - Add: `applinks:www.yardpass.app`

### 5. Apple Developer - APNs Setup (15 minutes)

**Only needed for Push Notifications:**

1. Go to: https://developer.apple.com/account/resources/authkeys/list
2. Create new key:
   - Name: "YardPass APNs"
   - Enable: Apple Push Notifications service (APNs)
   - Download `.p8` file
   - Save **Key ID** and **Team ID**

3. In Supabase Dashboard:
   - Project → Authentication → Providers → Apple
   - Upload APNs Auth Key (`.p8`)
   - Enter Key ID
   - Enter Team ID
   - Enter Bundle ID: `com.yardpass.app`

### 6. Use Location in Feed (10 minutes)

Add to your feed component:

```typescript
import { useLocation } from '@/hooks/useLocation';

// In component:
const { coords, requestLocation } = useLocation();

// When "Near Me" clicked:
const handleNearMe = async () => {
  const location = await requestLocation();
  if (!location) return;
  
  fetchFeed({
    locationFilters: ['Near Me'],
    searchRadius: 25,
    user_lat: location.lat,
    user_lng: location.lng
  });
};
```

---

## 📱 Testing Checklist

### Camera & Media
- [ ] Camera button shows on iOS (not web)
- [ ] Permission prompt is clear and appropriate
- [ ] Camera opens successfully
- [ ] Photo library opens successfully
- [ ] Photos upload to Supabase
- [ ] Video recording still works
- [ ] Media button (file picker) still works as fallback

### Location
- [ ] Location permission prompt appears
- [ ] "Near Me" filter works
- [ ] Events filter by distance correctly
- [ ] Location permission denial handled gracefully

### Push Notifications
- [ ] Permission prompt appears (not on app launch!)
- [ ] Device token stored in `user_devices` table
- [ ] Test notification sends successfully
- [ ] Tapping notification opens correct screen
- [ ] Background notifications work

### Permissions
- [ ] No crashes when permission denied
- [ ] Clear explanation in each permission prompt
- [ ] Can still use app without granting permissions
- [ ] Permissions only requested when feature is used

---

## 🐛 If Something Doesn't Work

### "Camera not found" or crashes
```bash
# 1. Check Info.plist has camera permissions
cat ios/App/App/Info.plist | grep NSCameraUsageDescription

# 2. Rebuild
npm run build
npx cap sync ios

# 3. Clean build in Xcode
# Product → Clean Build Folder
# Then Run again
```

### Location not working
```bash
# Must test on real device (not simulator)
# Check iOS Settings → YardPass → Location
```

### Push notifications not received
```bash
# 1. Check token stored
# In your app: console.log should show "APNs token received"

# 2. Verify in database
# SELECT * FROM user_devices WHERE user_id = 'your-user-id';

# 3. Test with Supabase
# Project → Authentication → Users → Send notification
```

### CocoaPods SSL error
```bash
# Update CocoaPods
sudo gem install cocoapods
pod repo update
cd ios/App && pod install && cd ../..
```

---

## 📚 Reference Documents

- **`YARDPASS_ARCHITECTURE.md`** - Complete system architecture
- **`URGENT_IOS_CAMERA_FIX.md`** - Detailed camera implementation guide
- **`IOS_INTEGRATION_COMPLETE.md`** - Summary of what was implemented
- **`NEXT_STEPS.md`** - This file (what to do next)

---

## 🎯 Success Criteria

You'll know it's working when:

1. ✅ App builds and runs on real iPhone without crashes
2. ✅ Camera button appears in post creator
3. ✅ Tapping camera shows iOS permission prompt with your custom message
4. ✅ Photos upload successfully
5. ✅ "Near Me" filter requests location and shows nearby events
6. ✅ Push notification permission requested at appropriate time
7. ✅ Device token appears in `user_devices` table
8. ✅ All Xcode capabilities are green (no warnings)

---

## ⏱️ Time Estimates

- Fix CocoaPods: **5 minutes**
- Run migration: **1 minute**
- Test on iPhone: **30 minutes**
- Xcode capabilities: **5 minutes**
- APNs setup: **15 minutes**
- Integrate location in feed: **10 minutes**

**Total: ~1 hour** (not including App Store submission)

---

## 🚀 Ready for App Store?

Before submitting:

- [ ] All features tested on real device
- [ ] Permissions prompts are clear and honest
- [ ] Privacy Policy mentions camera, location, push data usage
- [ ] Screenshots show permission prompts
- [ ] No crashes or errors
- [ ] App works without granting all permissions

---

**Questions?** Check the reference documents or test on a real iPhone to see it in action!





