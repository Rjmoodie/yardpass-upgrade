# 📱 iOS Pre-Deployment Checklist

**Date:** January 2025  
**Status:** ⚠️ **CRITICAL ISSUE FOUND** - Config Mismatch

---

## 🚨 **CRITICAL ISSUE: Config Mismatch**

### **Problem:**
There's a **mismatch** between configuration files:

1. **`capacitor.config.ts`** (root):
   - `appId: 'com.liventix.app'`
   - `appName: 'Liventix'`

2. **`ios/App/App/capacitor.config.json`** (iOS native):
   - `appId: "com.yardpass.app"`
   - `appName: "YardPass"`

3. **Xcode Project** (`project.pbxproj`):
   - `PRODUCT_BUNDLE_IDENTIFIER = com.yardpass.app`

### **Impact:**
- App may fail to build or have incorrect bundle identifier
- App Store submission will use wrong bundle ID
- Deep linking and universal links may not work
- Push notifications may fail

### **Fix Required:**
The iOS native config needs to match the root `capacitor.config.ts`. After fixing, run:
```bash
npx cap sync ios
```

---

## ✅ **Capacitor Setup Status**

### **1. Capacitor Core** ✅
- **Version:** `@capacitor/core: ^7.4.3`
- **CLI:** `@capacitor/cli: ^7.4.3`
- **iOS Platform:** `@capacitor/ios: ^7.4.3`
- **Status:** ✅ Installed and configured

### **2. Capacitor Plugins** ✅

All required plugins are installed:

| Plugin | Version | Status | Purpose |
|--------|---------|--------|---------|
| `@capacitor/app` | ^7.1.0 | ✅ | App lifecycle, URL handling |
| `@capacitor/barcode-scanner` | ^2.2.0 | ✅ | QR code scanning |
| `@capacitor/browser` | ^7.0.2 | ✅ | In-app browser |
| `@capacitor/camera` | ^7.0.2 | ✅ | Photo/video capture |
| `@capacitor/clipboard` | ^7.0.2 | ✅ | Copy/paste |
| `@capacitor/device` | ^7.0.2 | ✅ | Device info |
| `@capacitor/filesystem` | ^7.1.4 | ✅ | File operations |
| `@capacitor/geolocation` | ^7.1.5 | ✅ | Location services |
| `@capacitor/haptics` | ^7.0.2 | ✅ | Haptic feedback |
| `@capacitor/keyboard` | ^7.0.3 | ✅ | Keyboard handling |
| `@capacitor/local-notifications` | ^7.0.3 | ✅ | Local notifications |
| `@capacitor/network` | ^7.0.2 | ✅ | Network status |
| `@capacitor/preferences` | ^7.0.2 | ✅ | Persistent storage |
| `@capacitor/push-notifications` | ^7.0.3 | ✅ | Push notifications |
| `@capacitor/share` | ^7.0.2 | ✅ | Native sharing |
| `@capacitor/splash-screen` | ^7.0.3 | ✅ | Splash screen |
| `@capacitor/status-bar` | ^7.0.3 | ✅ | Status bar control |
| `@capacitor/toast` | ^7.0.2 | ✅ | Toast messages |
| `capacitor-plugin-safe-area` | ^4.0.2 | ✅ | Safe area insets |

### **3. iOS Native Project** ✅

**Structure:**
- ✅ `ios/App/App.xcodeproj` - Xcode project exists
- ✅ `ios/App/App.xcworkspace` - Workspace exists
- ✅ `ios/App/Podfile` - CocoaPods configured
- ✅ `ios/App/App/AppDelegate.swift` - App delegate configured
- ✅ `ios/App/App/Info.plist` - Info.plist with permissions

**Podfile Status:**
- ✅ All Capacitor plugins listed
- ✅ iOS deployment target: `14.0`
- ✅ `capacitor-plugin-safe-area` included

**Info.plist Permissions:**
- ✅ Camera (`NSCameraUsageDescription`)
- ✅ Microphone (`NSMicrophoneUsageDescription`)
- ✅ Photo Library Read (`NSPhotoLibraryUsageDescription`)
- ✅ Photo Library Write (`NSPhotoLibraryAddUsageDescription`)
- ✅ Location (`NSLocationWhenInUseUsageDescription`)
- ✅ Background Modes (Push Notifications)
- ✅ Universal Links configured (`liventix.app`, `www.liventix.app`)
- ✅ App Transport Security configured (Supabase, Stripe, Mapbox)

### **4. Capacitor Configuration** ⚠️

**Root Config (`capacitor.config.ts`):**
- ✅ App ID: `com.liventix.app`
- ✅ App Name: `Liventix`
- ✅ Web Dir: `dist`
- ✅ All plugins configured
- ✅ iOS settings: `contentInset: 'automatic'`, safe area support

**iOS Native Config (`ios/App/App/capacitor.config.json`):**
- ⚠️ **MISMATCH:** App ID: `com.yardpass.app` (should be `com.liventix.app`)
- ⚠️ **MISMATCH:** App Name: `YardPass` (should be `Liventix`)

**Xcode Project:**
- ⚠️ **MISMATCH:** Bundle ID: `com.yardpass.app` (should be `com.liventix.app`)

---

## 🔧 **Required Fixes Before Deployment**

### **1. Fix Config Mismatch** (CRITICAL)

**Option A: Update iOS to match root config (Recommended)**
```bash
# 1. Update capacitor.config.ts is already correct (com.liventix.app)
# 2. Sync to iOS
npx cap sync ios

# 3. Verify Xcode project bundle ID matches
# Open ios/App/App.xcodeproj in Xcode
# Check: Target → General → Bundle Identifier = com.liventix.app
```

**Option B: Update root config to match iOS (if you want to keep com.yardpass.app)**
```typescript
// capacitor.config.ts
appId: 'com.yardpass.app',
appName: 'YardPass',
```

### **2. Verify Build Directory**
```bash
# Ensure dist/ exists and is built
npm run build

# Verify dist/ contains built assets
ls -la dist/
```

### **3. Sync Capacitor**
```bash
# Sync web assets and config to iOS
npx cap sync ios

# This will:
# - Copy dist/ → ios/App/public/
# - Update capacitor.config.json in iOS
# - Update Podfile if plugins changed
```

### **4. Install Pods**
```bash
cd ios/App
pod install
cd ../..
```

### **5. Verify Xcode Project**
- Open `ios/App/App.xcworkspace` in Xcode
- Check Bundle Identifier matches config
- Check Signing & Capabilities
- Verify all plugins are linked

---

## 📋 **Pre-Deployment Checklist**

### **Before Building:**

- [ ] **Fix config mismatch** (appId/appName)
- [ ] **Build web assets:** `npm run build`
- [ ] **Sync Capacitor:** `npx cap sync ios`
- [ ] **Install pods:** `cd ios/App && pod install`
- [ ] **Verify bundle ID** in Xcode matches config
- [ ] **Check signing** (development/distribution certificates)
- [ ] **Verify permissions** in Info.plist are correct
- [ ] **Test on simulator** before device build
- [ ] **Check universal links** domain matches (`liventix.app` or `liventix.tech`?)

### **Build Commands:**

```bash
# 1. Build web assets
npm run build

# 2. Sync to iOS
npx cap sync ios

# 3. Install pods
cd ios/App
pod install
cd ../..

# 4. Open in Xcode
open ios/App/App.xcworkspace
```

### **In Xcode:**

1. **Select Target:** App
2. **General Tab:**
   - ✅ Bundle Identifier: `com.liventix.app` (or your choice)
   - ✅ Display Name: `Liventix`
   - ✅ Version: `1.0`
   - ✅ Build: `1`
3. **Signing & Capabilities:**
   - ✅ Select your development/distribution team
   - ✅ Enable Push Notifications (if using)
   - ✅ Enable Associated Domains (for universal links)
4. **Build Settings:**
   - ✅ iOS Deployment Target: `14.0` (matches Podfile)
5. **Product → Archive** (for App Store)
   - Or **Product → Run** (for simulator/device)

---

## 🔍 **Additional Checks**

### **Universal Links:**
- ✅ Info.plist has `com.apple.developer.associated-domains`
- ⚠️ **Verify domains:** Currently set to `liventix.app` and `www.liventix.app`
- ⚠️ **Check if you're using `liventix.tech`** - may need to update

### **App Transport Security:**
- ✅ Configured for Supabase, Stripe, Mapbox
- ✅ `NSAllowsArbitraryLoads: false` (secure)

### **Safe Areas:**
- ✅ `capacitor-plugin-safe-area` installed
- ✅ Feed components use `env(safe-area-inset-*)`
- ✅ MainFeed uses `100dvh` with safe area padding

### **Dependencies:**
- ✅ All Capacitor plugins at compatible versions (v7.x)
- ✅ iOS deployment target: 14.0 (supports iOS 14+)

---

## ⚠️ **Action Required**

**Before pushing to iOS, you MUST:**

1. **Decide on bundle ID:**
   - Use `com.liventix.app` (matches current root config)
   - OR use `com.yardpass.app` (matches current iOS config)
   - **Recommendation:** Use `com.liventix.app` (matches branding)

2. **Sync configs:**
   ```bash
   # If keeping com.liventix.app:
   npx cap sync ios
   
   # Then manually update Xcode bundle ID if needed
   ```

3. **Update universal links** (if using `liventix.tech` instead of `liventix.app`):
   - Update `Info.plist` associated domains
   - Update Apple Developer portal associated domains

4. **Test build:**
   ```bash
   npm run build
   npx cap sync ios
   cd ios/App && pod install && cd ../..
   # Open in Xcode and build
   ```

---

## 📚 **References**

- `CAPACITOR_STATUS_REPORT.md` - Full Capacitor setup details
- `CLOUD_IOS_BUILD_SETUP.md` - iOS build setup guide
- `docs/capacitor-quick-reference.md` - Capacitor commands

---

## ✅ **Status Summary**

| Component | Status | Notes |
|-----------|--------|-------|
| Capacitor Core | ✅ | v7.4.3 installed |
| Plugins | ✅ | All 18 plugins installed |
| iOS Project | ✅ | Structure exists |
| Podfile | ✅ | All pods configured |
| Info.plist | ✅ | Permissions configured |
| Config Sync | ⚠️ | **MISMATCH - needs fix** |
| Bundle ID | ⚠️ | **MISMATCH - needs fix** |
| Universal Links | ⚠️ | Verify domain (`liventix.app` vs `liventix.tech`) |

**Overall:** ⚠️ **READY AFTER FIXING CONFIG MISMATCH**

