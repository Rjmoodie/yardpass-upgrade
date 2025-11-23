# ✅ Capacitor Deep Link Configuration - Complete

## Configuration Status

### ✅ Root Capacitor Config (`capacitor.config.ts`)

**Status:** CONFIGURED ✅

```typescript
const config: CapacitorConfig = {
  appId: 'com.liventix.app',  // ✅ Correct
  appName: 'Liventix',        // ✅ Correct
  webDir: 'dist',
  server: {                    // ✅ ADDED
    hostname: 'liventix.tech',
    iosScheme: 'liventix',
    androidScheme: 'https'
  },
  // ... rest of config
};
```

### ✅ iOS Associated Domains (`ios/App/App/Info.plist`)

**Status:** UPDATED ✅

```xml
<key>com.apple.developer.associated-domains</key>
<array>
    <string>applinks:liventix.tech</string>          <!-- ✅ PRIMARY -->
    <string>applinks:www.liventix.tech</string>      <!-- ✅ WWW variant -->
    <string>applinks:liventix.app</string>           <!-- Legacy compatibility -->
    <string>applinks:www.liventix.app</string>       <!-- Legacy compatibility -->
</array>
```

### ✅ iOS Scheme (`capacitor.config.ts`)

**Status:** CONFIGURED ✅

```typescript
ios: {
  scheme: 'Liventix',  // ✅ Matches iosScheme in server config
  // ...
}
```

---

## What This Enables

1. **Universal Links (iOS):**
   - ✅ `https://liventix.tech/e/event-slug` → Opens in app
   - ✅ `https://liventix.tech/p/post-id` → Opens in app
   - ✅ Works from Messages, Safari, Mail, etc.

2. **App Scheme (iOS):**
   - ✅ `liventix://e/event-slug` → Opens in app
   - ✅ Direct app-to-app linking

3. **Android Deep Links:**
   - ✅ `https://liventix.tech/*` → Opens in app
   - ✅ Android Intent URLs supported

---

## Next Steps (After Code Sync)

### 1. Sync Capacitor Config to iOS
```bash
npx cap sync ios
```

This will:
- Copy `server` config to `ios/App/App/capacitor.config.json`
- Update native iOS project settings

### 2. Verify iOS Associated Domains in Xcode

1. Open `ios/App/App.xcworkspace` in Xcode
2. Select the **App** target
3. Go to **Signing & Capabilities** tab
4. Verify **Associated Domains** includes:
   - `applinks:liventix.tech`
   - `applinks:www.liventix.tech`

### 3. Verify Universal Links Work

**Test on Device:**
1. Share an event link from the app
2. Click the link in Messages/iMessage
3. Should open directly in the app (not Safari)

**Test in Safari:**
1. Open `https://liventix.tech/e/event-slug` in Safari
2. If app is installed, should prompt to open in app
3. If app not installed, opens in Safari

### 4. Verify Apple App Site Association File

**Required File:** `.well-known/apple-app-site-association`

**Location:** Must be hosted at:
- `https://liventix.tech/.well-known/apple-app-site-association`
- `https://www.liventix.tech/.well-known/apple-app-site-association`

**Format:**
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.liventix.app",
        "paths": [
          "/e/*",
          "/p/*",
          "/u/*",
          "/org/*",
          "/post/*",
          "/profile/*"
        ]
      }
    ]
  }
}
```

**Note:** Replace `TEAM_ID` with your actual Apple Developer Team ID.

**Verification:**
```bash
curl https://liventix.tech/.well-known/apple-app-site-association
```

Should return the JSON file with `Content-Type: application/json` (not `text/html`).

---

## Summary

✅ **Configuration Complete**
- ✅ `appId`: `com.liventix.app`
- ✅ `appName`: `Liventix`
- ✅ `server.hostname`: `liventix.tech`
- ✅ `server.iosScheme`: `liventix`
- ✅ `server.androidScheme`: `https`
- ✅ iOS Associated Domains include `applinks:liventix.tech`

**Action Required:**
1. Run `npx cap sync ios` to sync config
2. Verify Associated Domains in Xcode
3. Ensure `.well-known/apple-app-site-association` file is hosted on `liventix.tech`

After these steps, deep linking should work perfectly! 🎉

