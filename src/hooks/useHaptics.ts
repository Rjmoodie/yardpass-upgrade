import { useCallback } from 'react';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

interface HapticOptions {
  enabled?: boolean;
}

export function useHaptics(options: HapticOptions = {}) {
  const { enabled = true } = options;

  const impactLight = useCallback(async () => {
    if (!enabled || !(window as any).Capacitor?.isNativePlatform) return;
    
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (error) {
      // Haptics not available, fail silently
      console.debug('Haptics not available:', error);
    }
  }, [enabled]);

  const impactMedium = useCallback(async () => {
    if (!enabled || !(window as any).Capacitor?.isNativePlatform) return;
    
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (error) {
      console.debug('Haptics not available:', error);
    }
  }, [enabled]);

  const impactHeavy = useCallback(async () => {
    if (!enabled || !(window as any).Capacitor?.isNativePlatform) return;
    
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (error) {
      console.debug('Haptics not available:', error);
    }
  }, [enabled]);

  const notificationSuccess = useCallback(async () => {
    if (!enabled || !(window as any).Capacitor?.isNativePlatform) return;
    
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (error) {
      console.debug('Haptics not available:', error);
    }
  }, [enabled]);

  const notificationWarning = useCallback(async () => {
    if (!enabled || !(window as any).Capacitor?.isNativePlatform) return;
    
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch (error) {
      console.debug('Haptics not available:', error);
    }
  }, [enabled]);

  const notificationError = useCallback(async () => {
    if (!enabled || !(window as any).Capacitor?.isNativePlatform) return;
    
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch (error) {
      console.debug('Haptics not available:', error);
    }
  }, [enabled]);

  const selectionChanged = useCallback(async () => {
    if (!enabled || !(window as any).Capacitor?.isNativePlatform) return;
    
    try {
      await Haptics.selectionChanged();
    } catch (error) {
      console.debug('Haptics not available:', error);
    }
  }, [enabled]);

  return {
    impactLight,
    impactMedium,
    impactHeavy,
    notificationSuccess,
    notificationWarning,
    notificationError,
    selectionChanged,
  };
}