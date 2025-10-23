// Platform detection hook for hybrid web/mobile deployment
// Determines if the app is running on web or mobile (native) platform

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

const DEFAULT_PLATFORM_INFO: PlatformInfo = {
  isNative: false,
  isWeb: true,
  isMobile: false,
  isDesktop: true,
  platform: 'web',
  userAgent: '',
  screenSize: 'desktop'
};

const MOBILE_USER_AGENT_REGEX = /Mobi|Android|iP(ad|hone)|Windows Phone/i;

const computePlatformInfo = (): PlatformInfo => {
  if (typeof window === 'undefined') {
    return DEFAULT_PLATFORM_INFO;
  }

  const isNative = Capacitor.isNativePlatform();
  const isWeb = !isNative;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const width = window.innerWidth;
  const prefersTouch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

  let screenSize: PlatformInfo['screenSize'] = 'desktop';
  if (width < 768) {
    screenSize = 'mobile';
  } else if (width < 1024) {
    screenSize = 'tablet';
  }

  const inferredMobile = MOBILE_USER_AGENT_REGEX.test(userAgent) || prefersTouch || screenSize !== 'desktop';
  const isMobile = isNative || inferredMobile;
  const isDesktop = !isMobile && !isNative;

  return {
    isNative,
    isWeb,
    isMobile,
    isDesktop,
    platform: isMobile ? 'mobile' : 'web',
    userAgent,
    screenSize: isNative ? 'mobile' : screenSize
  };
};

const shallowEqual = (a: PlatformInfo, b: PlatformInfo) =>
  a.isNative === b.isNative &&
  a.isWeb === b.isWeb &&
  a.isMobile === b.isMobile &&
  a.isDesktop === b.isDesktop &&
  a.platform === b.platform &&
  a.userAgent === b.userAgent &&
  a.screenSize === b.screenSize;

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
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>(() => computePlatformInfo());

  useEffect(() => {
    const detectPlatform = () => {
      const nextInfo = computePlatformInfo();
      setPlatformInfo((previous) => (shallowEqual(previous, nextInfo) ? previous : nextInfo));
    };

    detectPlatform();

    if (typeof window === 'undefined') {
      return;
    }

    const resizeHandler = () => detectPlatform();
    const orientationHandler = () => detectPlatform();

    window.addEventListener('resize', resizeHandler);
    window.addEventListener('orientationchange', orientationHandler);

    return () => {
      window.removeEventListener('resize', resizeHandler);
      window.removeEventListener('orientationchange', orientationHandler);
    };
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
