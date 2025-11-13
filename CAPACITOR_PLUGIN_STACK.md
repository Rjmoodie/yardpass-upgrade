# Liventix Capacitor Plugin Stack

This document outlines all Capacitor plugins used in the Liventix mobile application, their purpose, priority, and implementation status.

## Overview

Liventix uses Capacitor 7.x to provide a hybrid mobile experience that bridges web technologies with native iOS and Android capabilities. All plugins are carefully selected to support core features like ticketing, social feed, sponsorships, and real-time engagement.

## Plugin Inventory

### 🔧 Core Runtime & Platforms

| Plugin | Package | Version | Purpose | Platforms | Priority | Status |
|--------|---------|---------|---------|-----------|----------|--------|
| **Capacitor Core** | `@capacitor/core` | ^7.4.3 | Core bridge between web app and native iOS/Android | iOS, Android, Web | ✅ Required | ✅ Installed |
| **Capacitor iOS** | `@capacitor/ios` | ^7.4.3 | Native iOS project for App Store builds | iOS | ✅ Required | ✅ Installed |
| **Capacitor Android** | `@capacitor/android` | ^7.4.3 | Native Android project for Google Play builds | Android | ✅ Required | ✅ Installed |
| **Capacitor CLI** | `@capacitor/cli` | ^7.4.3 | Syncs web build to native projects, manages platforms | iOS, Android | ✅ Required | ✅ Installed |

### 📱 System & Lifecycle

| Plugin | Package | Version | Purpose | Platforms | Priority | Status |
|--------|---------|---------|---------|-----------|----------|--------|
| **App** | `@capacitor/app` | ^7.1.0 | App lifecycle events, deep-link handling for tickets/sponsorships/referrals | iOS, Android | 🔴 High | ✅ Installed |
| **Device** | `@capacitor/device` | ^7.0.2 | Device and platform metadata for analytics and support | iOS, Android | 🟡 Medium | ✅ Installed |
| **Preferences** | `@capacitor/preferences` | ^7.0.2 | Persist user config: filters, last venue, theme, experiment flags | iOS, Android | 🔴 High | ✅ Installed |

### 🌐 Networking

| Plugin | Package | Version | Purpose | Platforms | Priority | Status |
|--------|---------|---------|---------|-----------|----------|--------|
| **Network** | `@capacitor/network` | ^7.0.2 | Detects connectivity for offline banners and graceful fallbacks | iOS, Android | 🔴 High | ✅ Installed |

### 🎫 Ticketing & Access Control

| Plugin | Package | Version | Purpose | Platforms | Priority | Status |
|--------|---------|---------|---------|-----------|----------|--------|
| **Barcode Scanner** | `@capacitor/barcode-scanner` | ^2.2.0 | Scan ticket QR codes for entry validation at events | iOS, Android | 🔴 High | ✅ Installed |
| **Filesystem** | `@capacitor/filesystem` | ^7.1.4 | Store cached tickets, event imagery, offline resources | iOS, Android | 🟡 Medium | ✅ Installed |

### 📷 Media & Content

| Plugin | Package | Version | Purpose | Platforms | Priority | Status |
|--------|---------|---------|---------|-----------|----------|--------|
| **Camera** | `@capacitor/camera` | ^7.0.2 | Capture profile photos, event media, sponsorship content | iOS, Android | 🔴 High | ✅ Installed |

### 🔔 Notifications

| Plugin | Package | Version | Purpose | Platforms | Priority | Status |
|--------|---------|---------|---------|-----------|----------|--------|
| **Push Notifications** | `@capacitor/push-notifications` | ^7.0.3 | Push alerts for events, tickets, sponsorships, payouts | iOS, Android | 🔴 High | ✅ Installed |
| **Local Notifications** | `@capacitor/local-notifications` | ^7.0.3 | On-device reminders for gates opening, set times, deliverables | iOS, Android | 🟡 Medium | ✅ Installed |

### 🎨 UI & UX

| Plugin | Package | Version | Purpose | Platforms | Priority | Status |
|--------|---------|---------|---------|-----------|----------|--------|
| **Status Bar** | `@capacitor/status-bar` | ^7.0.3 | Align status bar styling with immersive mobile feed design | iOS, Android | 🔴 High | ✅ Installed |
| **Splash Screen** | `@capacitor/splash-screen` | ^7.0.3 | Branded splash while loading feed and wallet state | iOS, Android | 🔴 High | ✅ Installed |
| **Keyboard** | `@capacitor/keyboard` | ^7.0.3 | Manage keyboard overlay in forms (checkout, login, comments) | iOS, Android | 🔴 High | ✅ Installed |
| **Haptics** | `@capacitor/haptics` | ^7.0.2 | Subtle vibrations on likes, purchases, key interactions | iOS, Android | 🟡 Medium | ✅ Installed |
| **Toast** | `@capacitor/toast` | ^7.0.2 | Unobtrusive status messages (saved, updated, copied) | iOS, Android | 🟡 Medium | ✅ Installed |

### 🔗 Sharing & Navigation

| Plugin | Package | Version | Purpose | Platforms | Priority | Status |
|--------|---------|---------|---------|-----------|----------|--------|
| **Browser** | `@capacitor/browser` | ^7.0.2 | OAuth, terms, policies, sponsor external sites in-app browser | iOS, Android | 🔴 High | ✅ Installed |
| **Share** | `@capacitor/share` | ^7.0.2 | Native sharing of events, tickets, sponsorship pages | iOS, Android | 🟡 Medium | ✅ Installed |
| **Clipboard** | `@capacitor/clipboard` | ^7.0.2 | Copy referral codes, event links, wallet addresses | iOS, Android | 🔵 Low | ✅ Installed |

### 📍 Location Services

| Plugin | Package | Version | Purpose | Platforms | Priority | Status |
|--------|---------|---------|---------|-----------|----------|--------|
| **Geolocation** | `@capacitor/geolocation` | ^7.1.5 | Venue proximity detection, location-based event recommendations, geofencing | iOS, Android | 🔴 High | ✅ Installed |

## Configuration

All plugins are configured in `capacitor.config.ts`. Key configurations include:

```typescript
{
  SplashScreen: { launchShowDuration: 0, backgroundColor: '#ffffff' },
  StatusBar: { /* Set at runtime based on theme */ },
  Keyboard: { resize: 'native', style: 'dark' },
  PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  Browser: { toolbarColor: '#000000', showTitle: true },
  Geolocation: { enableHighAccuracy: true, timeout: 10000 }
}
```

## Initialization

Capacitor plugins are initialized at app startup in `src/main.tsx` using the centralized initialization service:

```typescript
import { initializeCapacitor } from '@/lib/capacitor-init';

initializeCapacitor().then((state) => {
  console.log('[Liventix] Capacitor initialized:', state.platform);
});
```

## Usage in Components

Use the React hooks provided in `src/hooks/useCapacitorInit.ts`:

```typescript
// Monitor network connectivity
const networkStatus = useNetworkStatus();
const isOnline = useIsOnline();

// Monitor app lifecycle (pause video when backgrounded)
const isAppActive = useIsAppActive();

// Trigger haptic feedback
const haptics = useHapticFeedback();
haptics.light(); // On button tap
haptics.medium(); // On like/reaction
haptics.heavy(); // On purchase success

// Sync status bar with theme
useStatusBarSync(isDarkTheme);

// Check plugin availability
const hasBarcodeScanner = usePluginAvailable('barcodeScanner');

// Get device info
const deviceInfo = useDeviceInfo();
```

## Future Plugins (Roadmap)

| Plugin | Purpose | Priority | Timeline |
|--------|---------|----------|----------|
| **NFC** (Community) | Optional NFC tap-to-enter for premium venues | 🔵 Optional | Phase 3 |
| **File Viewer** | Open PDFs, contracts, sponsorship documents | 🔵 Optional | Phase 2 |
| **Privacy Screen** | Hide wallet balances in app switcher | 🔴 High | Phase 2 |

## Testing & Validation

### Development
```bash
npm run dev                    # Web preview
npx cap run ios               # iOS simulator
npx cap run android           # Android emulator
```

### Plugin Sync
```bash
npx cap sync                  # Sync web build to native platforms
npx cap update                # Update all plugins to latest compatible versions
```

### Build
```bash
npm run build                 # Build web app
npx cap copy                  # Copy web build to native projects
npx cap open ios             # Open Xcode
npx cap open android         # Open Android Studio
```

## Version Compatibility

All plugins are maintained at **Capacitor 7.x** for consistency and compatibility:
- Core: `7.4.3`
- Platform packages (iOS/Android): `7.4.3`
- Official plugins: `7.0.x` - `7.1.x`

## Security Considerations

1. **Permissions**: All sensitive plugins (Camera, Location, Push Notifications) request permissions on first use, not at startup
2. **Storage**: Preferences are used for non-sensitive data only; sensitive tokens use secure platform-specific keystores
3. **Network**: All API calls use HTTPS; network status is monitored for security-sensitive operations
4. **Deep Links**: URL schemes validated before processing to prevent injection attacks

## Support & Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [iOS Platform Guide](https://capacitorjs.com/docs/ios)
- [Android Platform Guide](https://capacitorjs.com/docs/android)
- [Plugin API Reference](https://capacitorjs.com/docs/apis)

## Maintenance

**Last Updated**: November 5, 2025  
**Capacitor Version**: 7.4.3  
**Maintained By**: Liventix Engineering Team

---

For questions or plugin requests, contact the Liventix development team or create an issue in the repository.

