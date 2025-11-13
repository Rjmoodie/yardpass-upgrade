# Liventix - Technical Architecture & Stack Documentation

> **Purpose:** Technical reference for developers auditing iOS Capacitor integration and overall architecture

---

## Executive Summary

Liventix is a mobile-first event ticketing and social platform built with React + Capacitor for cross-platform deployment (iOS, Android, Web). The backend is powered by Supabase (PostgreSQL + Edge Functions) with Stripe for payments.

---

## Tech Stack Overview

### Frontend Layer

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | React 18 | `^18.x` | UI library |
| **Build Tool** | Vite | `^5.x` | Fast dev server & bundling |
| **Language** | TypeScript | `^5.x` | Type safety |
| **Mobile Runtime** | Capacitor | `^6.x` | Native iOS/Android bridge |
| **Routing** | React Router | `^6.x` | SPA navigation |
| **State Management** | React Context + Hooks | Built-in | Global state |
| **UI Components** | Radix UI + Tailwind CSS | Latest | Design system |
| **Forms** | React Hook Form | `^7.x` | Form validation |
| **HTTP Client** | Supabase JS Client | `^2.x` | API & Realtime |

### Backend Layer

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Database** | PostgreSQL 15 (Supabase) | Primary data store |
| **Authentication** | Supabase Auth | User identity & sessions |
| **Storage** | Supabase Storage | Media uploads (images/video) |
| **Serverless Functions** | Supabase Edge Functions (Deno) | API logic & integrations |
| **Payments** | Stripe Embedded Checkout | Ticket purchases |
| **Email/SMS** | Resend + Twilio | Transactional messaging |
| **Real-time** | Supabase Realtime (WebSockets) | Live updates |

### iOS-Specific Integration

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **iOS Platform** | Capacitor iOS | Native iOS app wrapper |
| **Push Notifications** | Capacitor Push Notifications | iOS APNs integration |
| **Camera/Media** | Capacitor Camera | Photo/video capture |
| **Geolocation** | Capacitor Geolocation | Location services |
| **Share** | Capacitor Share | iOS share sheet |
| **Status Bar** | Capacitor Status Bar | iOS status bar control |
| **Keyboard** | Capacitor Keyboard | Keyboard behavior |
| **Haptics** | Capacitor Haptics | Tactile feedback |
| **App** | Capacitor App | App lifecycle & deep links |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     iOS Native Layer                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Capacitor iOS Runtime (WebView)             │    │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │         React Application (Vite)              │  │    │
│  │  │  ┌────────────────────────────────────────┐  │  │    │
│  │  │  │  Components (UI)                        │  │  │    │
│  │  │  │  - EventCreator, PostCreator, Feed     │  │  │    │
│  │  │  │  - EventCheckout, UserProfile, etc.    │  │  │    │
│  │  │  └────────────────────────────────────────┘  │  │    │
│  │  │  ┌────────────────────────────────────────┐  │  │    │
│  │  │  │  Hooks & State                          │  │  │    │
│  │  │  │  - useAuth, useProfile, useFeed        │  │  │    │
│  │  │  │  - useImpressionTracker, etc.          │  │  │    │
│  │  │  └────────────────────────────────────────┘  │  │    │
│  │  │  ┌────────────────────────────────────────┐  │  │    │
│  │  │  │  Capacitor Plugins (Bridge)             │  │  │    │
│  │  │  │  - Camera, Push, Geolocation, Share    │  │  │    │
│  │  │  └────────────────────────────────────────┘  │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  iOS Native APIs:                                           │
│  - AVFoundation (Camera)                                    │
│  - CoreLocation (GPS)                                       │
│  - UserNotifications (Push)                                 │
│  - UIActivityViewController (Share)                         │
└─────────────────────────────────────────────────────────────┘
                           ↓ HTTPS/WSS
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Backend                         │
│  ┌────────────────────────────────────────────────────┐    │
│  │  PostgreSQL 15 Database                             │    │
│  │  - Schemas: events, ticketing, users, payments     │    │
│  │  - RLS Policies for security                        │    │
│  │  - Views for simplified queries                     │    │
│  │  - Functions for business logic                     │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Edge Functions (Deno)                              │    │
│  │  - home-feed: Ranked feed algorithm                 │    │
│  │  - reactions-toggle: Like/unlike posts              │    │
│  │  - checkout-session: Stripe integration             │    │
│  │  - webhook handlers                                 │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Storage Buckets                                    │    │
│  │  - event-media: Event images/videos                 │    │
│  │  - post-media: User-generated content               │    │
│  │  - profile-photos: User avatars                     │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  External Services                          │
│  - Stripe: Payment processing                               │
│  - Resend: Email delivery                                   │
│  - Twilio: SMS messaging                                    │
│  - APNs: iOS push notifications                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Capacitor Configuration

### File Structure

```
liventix-upgrade/
├── capacitor.config.ts          # Main Capacitor configuration
├── ios/                          # iOS native project
│   ├── App/
│   │   ├── App/
│   │   │   ├── Info.plist       # iOS app permissions & config
│   │   │   ├── capacitor.config.json
│   │   │   └── GoogleService-Info.plist (if using Firebase)
│   │   ├── App.xcodeproj/       # Xcode project
│   │   └── Podfile              # CocoaPods dependencies
│   └── App.xcworkspace/         # Xcode workspace (use this!)
├── src/                          # React source code
│   ├── components/              # UI components
│   ├── hooks/                   # React hooks
│   ├── features/                # Feature modules
│   └── lib/                     # Utilities & clients
└── package.json                 # Dependencies
```

### Key Configuration Files

#### 1. `capacitor.config.ts`

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.liventix.app',        // CRITICAL: iOS Bundle ID
  appName: 'Liventix',
  webDir: 'dist',                    // Vite build output
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    // IMPORTANT: For local dev/testing
    // url: 'http://192.168.1.x:5173',
    // cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#6366f1',      // Brand color
      showSpinner: false
    },
    Keyboard: {
      resize: 'native',
      style: 'dark'
    }
  }
};

export default config;
```

#### 2. `ios/App/App/Info.plist` - iOS Permissions

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
  <!-- App Identity -->
  <key>CFBundleDisplayName</key>
  <string>Liventix</string>
  <key>CFBundleIdentifier</key>
  <string>com.liventix.app</string>
  
  <!-- CRITICAL: Required iOS Permissions -->
  
  <!-- Camera Permission -->
  <key>NSCameraUsageDescription</key>
  <string>Liventix needs access to your camera to capture photos and videos for event posts.</string>
  
  <!-- Photo Library -->
  <key>NSPhotoLibraryUsageDescription</key>
  <string>Liventix needs access to your photo library to select images for posts and profile.</string>
  
  <key>NSPhotoLibraryAddUsageDescription</key>
  <string>Liventix needs permission to save photos to your library.</string>
  
  <!-- Location -->
  <key>NSLocationWhenInUseUsageDescription</key>
  <string>Liventix uses your location to show nearby events and improve recommendations.</string>
  
  <key>NSLocationAlwaysUsageDescription</key>
  <string>Liventix uses your location to show nearby events even when the app is in the background.</string>
  
  <!-- Push Notifications (handled by Capacitor) -->
  
  <!-- Universal Links (Deep Links) -->
  <key>com.apple.developer.associated-domains</key>
  <array>
    <string>applinks:liventix.app</string>
    <string>applinks:www.liventix.app</string>
  </array>
  
  <!-- Allow HTTPS to Supabase -->
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
    <key>NSExceptionDomains</key>
    <dict>
      <key>supabase.co</key>
      <dict>
        <key>NSExceptionAllowsInsecureHTTPLoads</key>
        <false/>
        <key>NSIncludesSubdomains</key>
        <true/>
      </dict>
    </dict>
  </dict>
</dict>
</plist>
```

---

## Critical iOS Integration Points

### 1. **Push Notifications**

**Setup Required:**
- Apple Developer Account with APNs certificate
- Supabase project configured with APNs key
- Device registration flow

**Code Location:** `src/hooks/usePushNotifications.ts` (if exists)

```typescript
import { PushNotifications } from '@capacitor/push-notifications';

// Register for push
await PushNotifications.requestPermissions();
await PushNotifications.register();

// Handle token
PushNotifications.addListener('registration', (token) => {
  // Send token.value to Supabase
});

// Handle incoming notifications
PushNotifications.addListener('pushNotificationReceived', (notification) => {
  // Show in-app notification
});
```

### 2. **Camera & Media Upload**

**Code Location:** `src/components/PostCreatorModal.tsx`

```typescript
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

const captureMedia = async () => {
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: true,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera // or CameraSource.Photos
  });
  
  // Upload to Supabase Storage
  const file = await fetch(image.webPath!).then(r => r.blob());
  const { data } = await supabase.storage
    .from('post-media')
    .upload(`${userId}/${Date.now()}.jpg`, file);
};
```

### 3. **Geolocation**

**Code Location:** `src/hooks/useLocation.ts` (if exists) or feed components

```typescript
import { Geolocation } from '@capacitor/geolocation';

const getCurrentPosition = async () => {
  const position = await Geolocation.getCurrentPosition();
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude
  };
};
```

### 4. **Share Sheet**

**Code Location:** Various components

```typescript
import { Share } from '@capacitor/share';

const shareEvent = async (event) => {
  await Share.share({
    title: event.title,
    text: `Check out ${event.title} on Liventix!`,
    url: `https://liventix.app/events/${event.id}`,
    dialogTitle: 'Share Event'
  });
};
```

### 5. **Deep Links (Universal Links)**

**Configuration Required:**
- Apple Developer: Associated Domains enabled
- Server: `.well-known/apple-app-site-association` file hosted
- Capacitor: App URL Listener

**Code Location:** `src/App.tsx` or routing setup

```typescript
import { App } from '@capacitor/app';

App.addListener('appUrlOpen', (event) => {
  // Handle deep link: liventix.app/events/123
  const url = new URL(event.url);
  const path = url.pathname;
  
  // Navigate using React Router
  navigate(path);
});
```

---

## Database Architecture

### Schema Overview

```
┌─────────────────────────────────────────────────────────────┐
│  events schema                                              │
│  ├── events                   # Event listings              │
│  ├── event_posts              # Media posts for events      │
│  ├── event_comments           # Comments on posts           │
│  ├── event_reactions          # Likes on posts              │
│  ├── event_impressions        # View tracking               │
│  └── event_tags               # Tag metadata                │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  ticketing schema                                           │
│  ├── ticket_tiers             # Ticket types & pricing      │
│  ├── tickets                  # User-owned tickets          │
│  ├── checkout_sessions        # Stripe sessions             │
│  ├── orders                   # Purchase orders             │
│  ├── event_addons             # Merchandise                 │
│  └── checkout_questions       # Custom fields               │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  users schema                                               │
│  ├── profiles                 # User profiles               │
│  ├── follows                  # User/event follows          │
│  └── user_tag_preferences     # ML preferences              │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  payments schema                                            │
│  ├── payout_accounts          # Stripe Connect              │
│  ├── org_wallets              # Organization balances       │
│  └── org_wallet_transactions  # Payout history              │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  public schema (views & helper tables)                      │
│  ├── events (VIEW)            # Flattened events view       │
│  ├── event_posts (VIEW)       # Flattened posts view        │
│  ├── tickets (VIEW)           # Flattened tickets view      │
│  ├── user_profiles (VIEW)     # User data view              │
│  └── platform_settings        # App configuration           │
└─────────────────────────────────────────────────────────────┘
```

### Key Database Functions

| Function | Purpose | Used By |
|----------|---------|---------|
| `get_home_feed_ranked()` | ML-powered feed ranking | `home-feed` Edge Function |
| `get_collaborative_recommendations()` | User similarity matching | Recommendations |
| `update_user_tag_preferences()` | ML preference learning | Engagement triggers |
| `can_current_user_post()` | Permission check | RLS policies |
| `is_event_manager()` | Role check | RLS policies |

---

## Supabase Edge Functions

### Deployed Functions

| Function | Route | Purpose | iOS Integration |
|----------|-------|---------|-----------------|
| **home-feed** | `/functions/v1/home-feed` | Personalized feed | Main feed screen |
| **reactions-toggle** | `/functions/v1/reactions-toggle` | Like/unlike posts | Post interactions |
| **checkout-session** | `/functions/v1/checkout-session` | Create Stripe checkout | Ticket purchase flow |
| **stripe-webhook** | `/functions/v1/stripe-webhook` | Handle payment events | Background |
| **upload-presign** | `/functions/v1/upload-presign` | Signed upload URLs | Media uploads |

### Example: Feed Request from iOS

```typescript
// In React component (runs in iOS WebView)
const fetchFeed = async () => {
  const { data, error } = await supabase.functions.invoke('home-feed', {
    body: {
      locationFilters: ['Near Me'],
      categoryFilters: [],
      dateFilters: [],
      searchRadius: 25,
      viewerId: userId,
      userLocation: {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }
    }
  });
  
  // data contains ranked events + posts with media_urls
};
```

---

## iOS Build & Deployment Process

### Development Workflow

```bash
# 1. Install dependencies
npm install

# 2. Build React app
npm run build

# 3. Sync Capacitor (copies web assets to iOS project)
npx cap sync ios

# 4. Open in Xcode
npx cap open ios

# 5. In Xcode:
#    - Select target device/simulator
#    - Click Run (▶️)
```

### Production Deployment

```bash
# 1. Update version in package.json
# 2. Build production bundle
npm run build

# 3. Sync to iOS
npx cap sync ios

# 4. Open Xcode
npx cap open ios

# 5. In Xcode:
#    - Product > Archive
#    - Upload to App Store Connect
#    - Submit for review
```

### iOS-Specific Considerations

1. **Bundle Identifier:** Must match `capacitor.config.ts` and Apple Developer account
2. **Signing:** Configure in Xcode under "Signing & Capabilities"
3. **Provisioning Profile:** Required for TestFlight/App Store
4. **Push Notification Certificate:** Required for APNs
5. **App Store Assets:** Screenshots, app preview video, description

---

## Environment Variables

### `.env` File Structure

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Mapbox (for event maps)
VITE_MAPBOX_ACCESS_TOKEN=pk.eyJ1...

# Environment
VITE_ENV=production
```

**CRITICAL:** These are compiled into the iOS app bundle. Use Capacitor's Config API for dynamic config if needed.

---

## Security & Authentication Flow

### iOS Authentication with Supabase

```typescript
import { supabase } from '@/lib/supabase';

// 1. Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password',
  options: {
    data: {
      display_name: 'John Doe'
    }
  }
});

// 2. Store session in Capacitor Preferences
import { Preferences } from '@capacitor/preferences';
await Preferences.set({
  key: 'supabase.auth.token',
  value: JSON.stringify(data.session)
});

// 3. Auto-restore session on app launch
const { value } = await Preferences.get({ key: 'supabase.auth.token' });
if (value) {
  const session = JSON.parse(value);
  await supabase.auth.setSession(session);
}
```

### Row Level Security (RLS)

All database tables have RLS policies that check:
- `auth.uid()` - Current user ID
- `auth.role()` - User role (authenticated, anon, service_role)
- Custom functions like `can_current_user_post(event_id)`

**iOS Impact:** All API calls from iOS automatically include the user's JWT token, which RLS policies validate.

---

## Performance Optimization

### iOS-Specific Optimizations

1. **Image Optimization:**
   - Compress images before upload using Capacitor Camera's `quality` setting
   - Use WebP format where possible
   - Lazy load images in feed

2. **Network:**
   - Implement request debouncing (search, pagination)
   - Use Supabase Realtime for live updates instead of polling
   - Cache API responses in IndexedDB

3. **Bundle Size:**
   - Code splitting with React.lazy()
   - Tree-shaking unused libraries
   - Current bundle: ~2-3MB gzipped

4. **Rendering:**
   - Virtual scrolling for long feeds (react-window)
   - Memoization with React.memo, useMemo, useCallback
   - Avoid re-renders with proper key props

---

## Testing Checklist for iOS Audit

### ✅ Functionality Tests

- [ ] **Authentication:** Sign up, login, logout, password reset
- [ ] **Event Creation:** All steps work, media upload succeeds
- [ ] **Feed:** Events and posts load, infinite scroll works
- [ ] **Posts:** Create post with camera/photos, like/comment
- [ ] **Tickets:** Purchase flow, Stripe checkout, ticket display
- [ ] **Push Notifications:** Register, receive, tap to open
- [ ] **Geolocation:** "Near Me" filter works
- [ ] **Share:** iOS share sheet opens with correct data
- [ ] **Deep Links:** Universal links open correct screens
- [ ] **Offline:** Graceful handling of no connection

### ✅ Permissions Tests

- [ ] Camera permission requested and handled
- [ ] Photo library permission requested and handled
- [ ] Location permission requested and handled
- [ ] Push notification permission requested and handled
- [ ] All permission denial cases handled gracefully

### ✅ UI/UX Tests

- [ ] Keyboard behavior (dismiss, resize)
- [ ] Status bar styling (light/dark content)
- [ ] Safe area insets (notch, home indicator)
- [ ] Haptic feedback on interactions
- [ ] Loading states and skeletons
- [ ] Error messages user-friendly
- [ ] Dark mode support

### ✅ Performance Tests

- [ ] App launch time < 3 seconds
- [ ] Feed loads in < 2 seconds
- [ ] Image upload completes in < 10 seconds
- [ ] No memory leaks (use Xcode Instruments)
- [ ] Battery usage acceptable

---

## Common iOS Issues & Fixes

### Issue 1: White Screen on Launch
**Cause:** Vite build not synced or WebView error  
**Fix:**
```bash
npm run build
npx cap sync ios
```

### Issue 2: Camera Not Working
**Cause:** Missing permissions in Info.plist  
**Fix:** Add `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription`

### Issue 3: Push Notifications Not Received
**Cause:** APNs certificate not configured  
**Fix:** 
1. Generate .p8 key in Apple Developer
2. Upload to Supabase Dashboard
3. Test with device (not simulator)

### Issue 4: Deep Links Not Opening App
**Cause:** Associated Domains not configured  
**Fix:**
1. Enable Associated Domains in Xcode
2. Add `applinks:liventix.app`
3. Host `apple-app-site-association` file

### Issue 5: API Calls Failing
**Cause:** CORS or authentication token not sent  
**Fix:** Check Supabase client initialization includes `auth.persistSession: true`

---

## Key Files for Developer Review

### Critical Files
```
capacitor.config.ts              # Main Capacitor config
ios/App/App/Info.plist          # iOS permissions & settings
src/lib/supabase.ts             # Supabase client setup
src/App.tsx                     # Root component & routing
src/components/EventCreator.tsx # Event creation flow
src/components/PostCreatorModal.tsx # Post creation with camera
src/hooks/useAuth.ts            # Authentication logic
src/hooks/useFeed.ts            # Feed loading logic
package.json                    # Dependencies
.env                            # Environment variables
```

### iOS Native Files
```
ios/App/App.xcodeproj/          # Xcode project
ios/App/Podfile                 # CocoaPods dependencies
ios/App/App/AppDelegate.swift   # iOS app lifecycle (if customized)
```

---

## Contact & Resources

### Developer Resources
- **Capacitor Docs:** https://capacitorjs.com/docs/ios
- **Supabase Docs:** https://supabase.com/docs
- **Stripe iOS:** https://stripe.com/docs/payments/accept-a-payment
- **Apple Developer:** https://developer.apple.com/documentation/

### Project-Specific
- **Supabase Project:** `[Your Project URL]`
- **Stripe Dashboard:** `[Your Stripe URL]`
- **App Store Connect:** `[Your App ID]`
- **Repository:** `[GitHub/GitLab URL]`

---

## Appendix: Dependencies

### Core Dependencies (`package.json`)
```json
{
  "@capacitor/core": "^6.0.0",
  "@capacitor/ios": "^6.0.0",
  "@capacitor/camera": "^6.0.0",
  "@capacitor/geolocation": "^6.0.0",
  "@capacitor/push-notifications": "^6.0.0",
  "@capacitor/share": "^6.0.0",
  "@capacitor/status-bar": "^6.0.0",
  "@capacitor/keyboard": "^6.0.0",
  "@capacitor/haptics": "^6.0.0",
  "@capacitor/app": "^6.0.0",
  "@capacitor/preferences": "^6.0.0",
  "@supabase/supabase-js": "^2.39.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.21.0",
  "@stripe/stripe-js": "^2.4.0",
  "@stripe/react-stripe-js": "^2.4.0"
}
```

---

**Document Version:** 1.0  
**Last Updated:** January 4, 2025  
**Prepared For:** iOS Developer Audit






