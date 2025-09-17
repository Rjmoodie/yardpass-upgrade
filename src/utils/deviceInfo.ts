import { Device } from '@capacitor/device';
import { App } from '@capacitor/app';

export interface DeviceInfo {
  platform: string;
  version: string;
  model: string;
  manufacturer: string;
  isNative: boolean;
  appVersion: string;
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  try {
    // Check if we're in a Capacitor environment
    const isNative = !!(window as any)?.Capacitor?.isNativePlatform;
    
    if (isNative) {
      const [deviceInfo, appInfo] = await Promise.all([
        Device.getInfo(),
        App.getInfo()
      ]);
      
      return {
        platform: deviceInfo.platform,
        version: deviceInfo.osVersion,
        model: deviceInfo.model,
        manufacturer: deviceInfo.manufacturer,
        isNative: true,
        appVersion: appInfo.version
      };
    } else {
      // Web fallback
      return {
        platform: 'web',
        version: navigator.userAgent,
        model: 'unknown',
        manufacturer: 'unknown',
        isNative: false,
        appVersion: '1.0.0'
      };
    }
  } catch (error) {
    console.warn('Failed to get device info:', error);
    return {
      platform: 'unknown',
      version: 'unknown',
      model: 'unknown',
      manufacturer: 'unknown',
      isNative: false,
      appVersion: '1.0.0'
    };
  }
}

export function isMobilePlatform(): boolean {
  const platform = (window as any)?.Capacitor?.getPlatform?.() || 'web';
  return platform === 'ios' || platform === 'android';
}

export function isIOSPlatform(): boolean {
  const platform = (window as any)?.Capacitor?.getPlatform?.() || 'web';
  return platform === 'ios';
}

export function isAndroidPlatform(): boolean {
  const platform = (window as any)?.Capacitor?.getPlatform?.() || 'web';
  return platform === 'android';
}