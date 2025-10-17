import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yardpass.app',
  appName: 'YardPass',
  webDir: 'dist',
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
    }
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    backgroundColor: '#ffffff',
    // Ensure proper safe area handling
    scheme: 'YardPass',
    // Optimize for iOS deployment
    cordovaSwiftVersion: '5.0',
    // Enable proper keyboard handling
    keyboardResize: 'native',
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
