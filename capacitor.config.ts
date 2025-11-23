import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.liventix.app',
  appName: 'Liventix',
  webDir: 'dist',
  server: {
    hostname: 'liventix.tech',
    iosScheme: 'liventix',
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      // Let the native storyboard show, then hide ASAP when your web app is ready
      launchShowDuration: 0,
      backgroundColor: '#ffffff',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      iosSpinnerStyle: 'large',
      spinnerColor: '#000000'
    },
    // We'll set StatusBar style at runtime based on theme; keep config minimal
    StatusBar: {},
    Haptics: {},
    Share: {},
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    Keyboard: {
      resize: 'native',           // 'native' | 'body' | 'ionic' | 'none'
      style: 'dark',              // 'dark' | 'light' (iOS only)
      resizeOnFullScreen: true    // Resize even in fullscreen (iOS only)
    },
    // Network monitoring for offline detection and feed refresh
    Network: {},
    // Persistent user preferences, feature flags, and device settings
    Preferences: {},
    // In-app browser for OAuth, terms, policies, and sponsor external sites
    Browser: {
      // Custom toolbar color to match Liventix branding
      toolbarColor: '#000000',
      // Show title in toolbar
      showTitle: true,
      // iOS presentation style
      presentationStyle: 'popover'
    },
    // QR code and barcode scanning for ticket validation
    BarcodeScanner: {
      // Camera permission description
      cameraPermissionDescription: 'Liventix needs camera access to scan ticket QR codes'
    },
    // Clipboard for copying referral codes and event links
    Clipboard: {},
    // Local notifications for venue-local reminders
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#000000'
    },
    // Quick toast messages for user feedback
    Toast: {
      duration: 'short'  // 'short' | 'long'
    },
    // Geolocation for venue proximity and event discovery
    Geolocation: {
      // High accuracy for precise venue location
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    backgroundColor: '#ffffff',
    // Ensure proper safe area handling
    scheme: 'Liventix',
    // Optimize for iOS deployment
    cordovaSwiftVersion: '5.0',
    // Ensure proper status bar handling
    statusBarStyle: 'default'
  },
  android: {
    allowMixedContent: false,          // safer default
    captureInput: true,
    webContentsDebuggingEnabled: false // disable for release
  }
};

export default config;
