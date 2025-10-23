// Platform detection hook for hybrid web/mobile deployment
// Determines if the app is running on web or mobile (native) platform

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export interface PlatformInfo {
  isNative: boolean;
  isWeb: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  platform: 'web' | 'mobile';
  userAgent: string;
  screenSize: 'mobile' | 'tablet' | 'desktop';
}

export const usePlatform = (): PlatformInfo => {
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>({
    isNative: false,
    isWeb: true,
    isMobile: false,
    isDesktop: true,
    platform: 'web',
    userAgent: '',
    screenSize: 'desktop'
  });

  useEffect(() => {
    const detectPlatform = () => {
      const isNative = Capacitor.isNativePlatform();
      const isWeb = !isNative;
      const userAgent = navigator.userAgent;
      
      // Screen size detection
      const width = window.innerWidth;
      let screenSize: 'mobile' | 'tablet' | 'desktop' = 'desktop';
      let isMobile = false;
      let isDesktop = true;

      if (width < 768) {
        screenSize = 'mobile';
        isMobile = true;
        isDesktop = false;
      } else if (width < 1024) {
        screenSize = 'tablet';
        isMobile = true;
        isDesktop = false;
      }

      // Override for native platforms
      if (isNative) {
        isMobile = true;
        isDesktop = false;
        screenSize = 'mobile';
      }

      setPlatformInfo({
        isNative,
        isWeb,
        isMobile,
        isDesktop,
        platform: isNative ? 'mobile' : 'web',
        userAgent,
        screenSize
      });
    };

    detectPlatform();

    // Listen for resize events
    const handleResize = () => {
      detectPlatform();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return platformInfo;
};

// Convenience hooks for specific platform checks
export const useIsWeb = () => {
  const { isWeb } = usePlatform();
  return isWeb;
};

export const useIsMobile = () => {
  const { isMobile } = usePlatform();
  return isMobile;
};

export const useIsNative = () => {
  const { isNative } = usePlatform();
  return isNative;
};

export const useIsDesktop = () => {
  const { isDesktop } = usePlatform();
  return isDesktop;
};
