/**
 * React Hook for Capacitor Initialization
 * 
 * Provides a React-friendly interface to Capacitor plugin state and utilities.
 * Use this hook in components that need to access plugin status or subscribe to events.
 * 
 * @module hooks/useCapacitorInit
 */

import { useState, useEffect } from 'react';
import {
  CapacitorState,
  getCapacitorState,
  onAppStateChange,
  onNetworkStatusChange,
  onKeyboardChange,
  triggerHaptic,
  updateStatusBarStyle,
} from '@/lib/capacitor-init';
import { AppState } from '@capacitor/app';
import { ConnectionStatus } from '@capacitor/network';
import { ImpactStyle } from '@capacitor/haptics';

/**
 * Hook to access Capacitor state
 * Returns the current state of all initialized plugins
 */
export const useCapacitorState = (): CapacitorState => {
  const [state, setState] = useState<CapacitorState>(getCapacitorState());

  useEffect(() => {
    // Update state when app state or network changes
    const unsubscribeApp = onAppStateChange(() => {
      setState(getCapacitorState());
    });

    const unsubscribeNetwork = onNetworkStatusChange(() => {
      setState(getCapacitorState());
    });

    return () => {
      unsubscribeApp();
      unsubscribeNetwork();
    };
  }, []);

  return state;
};

/**
 * Hook to monitor app state (active/background)
 * Useful for pausing video, stopping timers, etc.
 */
export const useAppState = (callback?: (state: AppState) => void): AppState | null => {
  const [appState, setAppState] = useState<AppState | null>(getCapacitorState().appState);

  useEffect(() => {
    const unsubscribe = onAppStateChange((state) => {
      setAppState(state);
      callback?.(state);
    });

    return unsubscribe;
  }, [callback]);

  return appState;
};

/**
 * Hook to monitor network connectivity
 * Returns current connection status and updates on change
 * Perfect for showing offline banners or disabling features
 */
export const useNetworkStatus = (callback?: (status: ConnectionStatus) => void): ConnectionStatus | null => {
  const [networkStatus, setNetworkStatus] = useState<ConnectionStatus | null>(
    getCapacitorState().networkStatus
  );

  useEffect(() => {
    const unsubscribe = onNetworkStatusChange((status) => {
      setNetworkStatus(status);
      callback?.(status);
    });

    return unsubscribe;
  }, [callback]);

  return networkStatus;
};

/**
 * Hook to monitor keyboard state (height when visible)
 * Useful for adjusting layout when keyboard appears
 */
export const useKeyboardHeight = (): number => {
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = onKeyboardChange((info) => {
      setKeyboardHeight(info.keyboardHeight);
    });

    return unsubscribe;
  }, []);

  return keyboardHeight;
};

/**
 * Hook to check if we're online
 * Simpler than useNetworkStatus when you just need boolean
 */
export const useIsOnline = (): boolean => {
  const networkStatus = useNetworkStatus();
  return networkStatus?.connected ?? true; // Default to true for web
};

/**
 * Hook to check if app is in foreground
 * Useful for resuming/pausing activities
 */
export const useIsAppActive = (): boolean => {
  const appState = useAppState();
  return appState?.isActive ?? true; // Default to true for web
};

/**
 * Hook to access device info
 * Returns device model, OS version, platform, etc.
 */
export const useDeviceInfo = () => {
  const state = useCapacitorState();
  return state.deviceInfo;
};

/**
 * Hook to check if specific plugin is available
 * Useful for progressive enhancement
 */
export const usePluginAvailable = (pluginName: keyof CapacitorState['plugins']): boolean => {
  const state = useCapacitorState();
  return state.plugins[pluginName]?.initialized ?? false;
};

/**
 * Hook to provide haptic feedback utilities
 * Returns a function to trigger haptics with different styles
 */
export const useHapticFeedback = () => {
  const isAvailable = usePluginAvailable('haptics');

  return {
    isAvailable,
    light: () => triggerHaptic(ImpactStyle.Light),
    medium: () => triggerHaptic(ImpactStyle.Medium),
    heavy: () => triggerHaptic(ImpactStyle.Heavy),
  };
};

/**
 * Hook to sync status bar with theme
 * Call this in your theme provider or top-level component
 */
export const useStatusBarSync = (isDark: boolean): void => {
  const isAvailable = usePluginAvailable('statusBar');

  useEffect(() => {
    if (isAvailable) {
      updateStatusBarStyle(isDark);
    }
  }, [isDark, isAvailable]);
};

/**
 * Hook to get platform-specific values
 * Useful for conditional rendering or behavior
 * 
 * @example
 * const padding = usePlatformValue({ ios: 20, android: 16, web: 12 });
 */
export const usePlatformValue = <T>(values: {
  ios?: T;
  android?: T;
  web?: T;
  default?: T;
}): T | undefined => {
  const state = useCapacitorState();
  
  return values[state.platform] ?? values.default;
};

/**
 * Hook to detect if running in native container
 * Simpler alternative to usePlatform for just checking native vs web
 */
export const useIsNativeApp = (): boolean => {
  const state = useCapacitorState();
  return state.isNative;
};

