import { toast } from 'sonner';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface NotifyOptions {
  haptic?: boolean;
  impactStyle?: ImpactStyle;
}

export function notify(message: string, options: NotifyOptions = {}) {
  const { haptic = true, impactStyle = ImpactStyle.Light } = options;
  
  toast.success(message);
  
  // Add haptic feedback on mobile
  if (haptic && (window as any).Capacitor?.isNativePlatform) {
    try {
      Haptics.impact({ style: impactStyle });
    } catch (error) {
      // Haptics not available, continue silently
    }
  }
}

export function notifyError(message: string, options: NotifyOptions = {}) {
  const { haptic = true, impactStyle = ImpactStyle.Medium } = options;
  
  toast.error(message);
  
  // Add haptic feedback on mobile
  if (haptic && (window as any).Capacitor?.isNativePlatform) {
    try {
      Haptics.impact({ style: impactStyle });
    } catch (error) {
      // Haptics not available, continue silently
    }
  }
}

export function notifyInfo(message: string, options: NotifyOptions = {}) {
  const { haptic = false } = options;
  
  toast.info(message);
  
  // Add haptic feedback on mobile
  if (haptic && (window as any).Capacitor?.isNativePlatform) {
    try {
      Haptics.impact({ style: ImpactStyle.Light });
    } catch (error) {
      // Haptics not available, continue silently
    }
  }
}