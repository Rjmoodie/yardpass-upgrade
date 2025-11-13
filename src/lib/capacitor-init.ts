/**
 * Capacitor Plugin Initialization Service
 * 
 * Centralizes initialization of all Capacitor plugins for Liventix.
 * Handles platform detection, permission requests, and lifecycle events.
 * 
 * @module lib/capacitor-init
 */

import { Capacitor } from '@capacitor/core';
import { App, AppState } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Network, ConnectionStatus } from '@capacitor/network';
import { Device, DeviceInfo } from '@capacitor/device';
import { Keyboard, KeyboardInfo } from '@capacitor/keyboard';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PushNotifications } from '@capacitor/push-notifications';

// Plugin availability and status tracking
export interface PluginStatus {
  available: boolean;
  initialized: boolean;
  error?: string;
}

export interface CapacitorState {
  isNative: boolean;
  platform: 'ios' | 'android' | 'web';
  deviceInfo: DeviceInfo | null;
  networkStatus: ConnectionStatus | null;
  appState: AppState | null;
  plugins: {
    statusBar: PluginStatus;
    splashScreen: PluginStatus;
    network: PluginStatus;
    device: PluginStatus;
    keyboard: PluginStatus;
    haptics: PluginStatus;
    pushNotifications: PluginStatus;
    camera: PluginStatus;
    geolocation: PluginStatus;
    barcodeScanner: PluginStatus;
  };
}

// Event listeners registry
type AppStateListener = (state: AppState) => void;
type NetworkListener = (status: ConnectionStatus) => void;
type KeyboardListener = (info: KeyboardInfo) => void;

const listeners = {
  appState: new Set<AppStateListener>(),
  network: new Set<NetworkListener>(),
  keyboard: new Set<KeyboardListener>(),
};

// Internal state
let capacitorState: CapacitorState = {
  isNative: false,
  platform: 'web',
  deviceInfo: null,
  networkStatus: null,
  appState: null,
  plugins: {
    statusBar: { available: false, initialized: false },
    splashScreen: { available: false, initialized: false },
    network: { available: false, initialized: false },
    device: { available: false, initialized: false },
    keyboard: { available: false, initialized: false },
    haptics: { available: false, initialized: false },
    pushNotifications: { available: false, initialized: false },
    camera: { available: false, initialized: false },
    geolocation: { available: false, initialized: false },
    barcodeScanner: { available: false, initialized: false },
  },
};

/**
 * Check if a specific plugin is available on the current platform
 */
const isPluginAvailable = (pluginName: string): boolean => {
  return Capacitor.isPluginAvailable(pluginName);
};

/**
 * Initialize Status Bar plugin
 */
const initStatusBar = async (): Promise<PluginStatus> => {
  if (!isPluginAvailable('StatusBar')) {
    return { available: false, initialized: false, error: 'Plugin not available' };
  }

  try {
    // Set initial style (will be updated by theme system)
    await StatusBar.setStyle({ style: Style.Dark });
    
    // Show status bar
    await StatusBar.show();
    
    return { available: true, initialized: true };
  } catch (error) {
    console.error('[Capacitor] StatusBar init failed:', error);
    return { available: true, initialized: false, error: String(error) };
  }
};

/**
 * Initialize Splash Screen plugin
 */
const initSplashScreen = async (): Promise<PluginStatus> => {
  if (!isPluginAvailable('SplashScreen')) {
    return { available: false, initialized: false, error: 'Plugin not available' };
  }

  try {
    // Hide splash screen once app is ready
    await SplashScreen.hide();
    
    return { available: true, initialized: true };
  } catch (error) {
    console.error('[Capacitor] SplashScreen init failed:', error);
    return { available: true, initialized: false, error: String(error) };
  }
};

/**
 * Initialize Network plugin
 */
const initNetwork = async (): Promise<PluginStatus> => {
  if (!isPluginAvailable('Network')) {
    return { available: false, initialized: false, error: 'Plugin not available' };
  }

  try {
    // Get initial network status
    const status = await Network.getStatus();
    capacitorState.networkStatus = status;

    // Listen for network changes
    await Network.addListener('networkStatusChange', (status) => {
      capacitorState.networkStatus = status;
      listeners.network.forEach((listener) => listener(status));
    });

    return { available: true, initialized: true };
  } catch (error) {
    console.error('[Capacitor] Network init failed:', error);
    return { available: true, initialized: false, error: String(error) };
  }
};

/**
 * Initialize Device plugin
 */
const initDevice = async (): Promise<PluginStatus> => {
  if (!isPluginAvailable('Device')) {
    return { available: false, initialized: false, error: 'Plugin not available' };
  }

  try {
    // Get device info
    const info = await Device.getInfo();
    capacitorState.deviceInfo = info;

    return { available: true, initialized: true };
  } catch (error) {
    console.error('[Capacitor] Device init failed:', error);
    return { available: true, initialized: false, error: String(error) };
  }
};

/**
 * Initialize Keyboard plugin
 */
const initKeyboard = async (): Promise<PluginStatus> => {
  if (!isPluginAvailable('Keyboard')) {
    return { available: false, initialized: false, error: 'Plugin not available' };
  }

  try {
    // Listen for keyboard show/hide events
    await Keyboard.addListener('keyboardWillShow', (info) => {
      listeners.keyboard.forEach((listener) => listener(info));
    });

    await Keyboard.addListener('keyboardWillHide', () => {
      listeners.keyboard.forEach((listener) => listener({ keyboardHeight: 0 }));
    });

    return { available: true, initialized: true };
  } catch (error) {
    console.error('[Capacitor] Keyboard init failed:', error);
    return { available: true, initialized: false, error: String(error) };
  }
};

/**
 * Initialize Haptics plugin (lazy - on first user interaction)
 * Browsers require user gesture before allowing vibrate API
 */
let hapticsInitialized = false;

const initHaptics = async (): Promise<PluginStatus> => {
  // Mark as available but not initialized yet (will init on first tap)
  return { available: isPluginAvailable('Haptics'), initialized: false };
};

/**
 * Initialize haptics on first user interaction
 * Call this from main.tsx after Capacitor init
 */
export function initHapticsOnFirstTap() {
  if (hapticsInitialized || !isPluginAvailable('Haptics')) return;
  
  const handler = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
      hapticsInitialized = true;
      console.log('[Capacitor] Haptics initialized on user interaction');
    } catch (error) {
      console.debug('[Capacitor] Haptics not available:', error);
    }
  };
  
  // Initialize on first pointer/touch interaction
  window.addEventListener('pointerdown', handler, { once: true });
}

/**
 * Initialize Push Notifications plugin
 */
const initPushNotifications = async (): Promise<PluginStatus> => {
  if (!isPluginAvailable('PushNotifications')) {
    return { available: false, initialized: false, error: 'Plugin not available' };
  }

  try {
    // Check permissions (don't request yet - will be done on user action)
    const permResult = await PushNotifications.checkPermissions();
    
    if (permResult.receive === 'granted') {
      // Register for push notifications
      await PushNotifications.register();
    }

    // Add listeners for push notification events
    await PushNotifications.addListener('registration', (token) => {
      console.log('[Capacitor] Push registration success:', token.value);
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[Capacitor] Push registration error:', error);
    });

    return { available: true, initialized: true };
  } catch (error) {
    console.error('[Capacitor] PushNotifications init failed:', error);
    return { available: true, initialized: false, error: String(error) };
  }
};

/**
 * Initialize App plugin (lifecycle events)
 */
const initApp = async (): Promise<void> => {
  if (!isPluginAvailable('App')) {
    return;
  }

  try {
    // Get initial app state
    const state = await App.getState();
    capacitorState.appState = state;

    // Listen for app state changes
    await App.addListener('appStateChange', (state) => {
      capacitorState.appState = state;
      listeners.appState.forEach((listener) => listener(state));
    });

    // Listen for deep links (for ticket/event sharing)
    await App.addListener('appUrlOpen', (event) => {
      console.log('[Capacitor] Deep link opened:', event.url);
      // Deep link handling will be done in the router
    });

    // Handle back button (Android)
    await App.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        App.exitApp();
      }
    });
  } catch (error) {
    console.error('[Capacitor] App lifecycle init failed:', error);
  }
};

/**
 * Initialize Camera plugin (lazy - permission checked on first use)
 */
const initCamera = async (): Promise<PluginStatus> => {
  if (!isPluginAvailable('Camera')) {
    return { available: false, initialized: false, error: 'Plugin not available' };
  }

  return { available: true, initialized: true };
};

/**
 * Initialize Geolocation plugin (lazy - permission checked on first use)
 */
const initGeolocation = async (): Promise<PluginStatus> => {
  if (!isPluginAvailable('Geolocation')) {
    return { available: false, initialized: false, error: 'Plugin not available' };
  }

  return { available: true, initialized: true };
};

/**
 * Initialize Barcode Scanner plugin (lazy - permission checked on first use)
 */
const initBarcodeScanner = async (): Promise<PluginStatus> => {
  if (!isPluginAvailable('BarcodeScanner')) {
    return { available: false, initialized: false, error: 'Plugin not available' };
  }

  return { available: true, initialized: true };
};

/**
 * Main initialization function
 * Call this once at app startup (in main.tsx or App.tsx)
 */
export const initializeCapacitor = async (): Promise<CapacitorState> => {
  console.log('[Capacitor] Starting initialization...');

  // Detect platform
  capacitorState.isNative = Capacitor.isNativePlatform();
  capacitorState.platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';

  console.log('[Capacitor] Platform:', capacitorState.platform, '| Native:', capacitorState.isNative);

  // Initialize plugins in parallel where possible
  const [
    statusBarStatus,
    splashScreenStatus,
    networkStatus,
    deviceStatus,
    keyboardStatus,
    hapticsStatus,
    pushNotificationsStatus,
    cameraStatus,
    geolocationStatus,
    barcodeScannerStatus,
  ] = await Promise.all([
    initStatusBar(),
    initSplashScreen(),
    initNetwork(),
    initDevice(),
    initKeyboard(),
    initHaptics(),
    initPushNotifications(),
    initCamera(),
    initGeolocation(),
    initBarcodeScanner(),
  ]);

  // Update state
  capacitorState.plugins = {
    statusBar: statusBarStatus,
    splashScreen: splashScreenStatus,
    network: networkStatus,
    device: deviceStatus,
    keyboard: keyboardStatus,
    haptics: hapticsStatus,
    pushNotifications: pushNotificationsStatus,
    camera: cameraStatus,
    geolocation: geolocationStatus,
    barcodeScanner: barcodeScannerStatus,
  };

  // Initialize app lifecycle listeners
  await initApp();

  console.log('[Capacitor] Initialization complete:', capacitorState);

  return capacitorState;
};

/**
 * Get current Capacitor state
 */
export const getCapacitorState = (): CapacitorState => {
  return capacitorState;
};

/**
 * Subscribe to app state changes
 */
export const onAppStateChange = (listener: AppStateListener): (() => void) => {
  listeners.appState.add(listener);
  return () => listeners.appState.delete(listener);
};

/**
 * Subscribe to network status changes
 */
export const onNetworkStatusChange = (listener: NetworkListener): (() => void) => {
  listeners.network.add(listener);
  return () => listeners.network.delete(listener);
};

/**
 * Subscribe to keyboard events
 */
export const onKeyboardChange = (listener: KeyboardListener): (() => void) => {
  listeners.keyboard.add(listener);
  return () => listeners.keyboard.delete(listener);
};

/**
 * Utility: Trigger haptic feedback
 */
export const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Medium): Promise<void> => {
  if (!capacitorState.plugins.haptics.initialized) return;
  
  try {
    await Haptics.impact({ style });
  } catch (error) {
    console.warn('[Capacitor] Haptic feedback failed:', error);
  }
};

/**
 * Utility: Update status bar style (for theme changes)
 */
export const updateStatusBarStyle = async (isDark: boolean): Promise<void> => {
  if (!capacitorState.plugins.statusBar.initialized) return;
  
  try {
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
  } catch (error) {
    console.warn('[Capacitor] Status bar style update failed:', error);
  }
};

