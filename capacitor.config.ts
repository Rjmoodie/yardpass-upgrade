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
    backgroundColor: '#ffffff'
  },
  android: {
    allowMixedContent: false,          // safer default
    captureInput: true,
    webContentsDebuggingEnabled: false // disable for release
  }
};

export default config;
