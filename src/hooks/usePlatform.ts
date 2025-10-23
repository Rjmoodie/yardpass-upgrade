// Platform detection hook for hybrid web/mobile deployment (REVAMPED)
// Uses feature detection over UA parsing, with pointer type and breakpoint checks

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export type Platform = 'web' | 'native';
export type Screen = 'mobile' | 'tablet' | 'desktop';
export type PointerType = 'coarse' | 'fine';

export interface PlatformInfo {
  platform: Platform;
  isNative: boolean;
  isWeb: boolean;
  screen: Screen;
  isMobile: boolean;
  isDesktop: boolean;
  pointer: PointerType;
}

const DEFAULT_PLATFORM_INFO: PlatformInfo = {
  platform: 'web',
  isNative: false,
  isWeb: true,
  screen: 'desktop',
  isMobile: false,
  isDesktop: true,
  pointer: 'fine'
};

const computePlatformInfo = (): PlatformInfo => {
  if (typeof window === 'undefined') {
    return DEFAULT_PLATFORM_INFO;
  }

  // Check if native platform (Capacitor)
  const isNative = typeof (window as any).Capacitor !== 'undefined' && Capacitor.isNativePlatform();
  const isWeb = !isNative;

  // Feature detection: pointer type (coarse = touch, fine = mouse/trackpad)
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const pointer: PointerType = coarse ? 'coarse' : 'fine';

  // Breakpoint detection (prefer Tailwind breakpoints)
  const lg = window.matchMedia('(min-width: 1024px)').matches;
  const md = window.matchMedia('(min-width: 768px)').matches;

  const screen: Screen = lg ? 'desktop' : md ? 'tablet' : 'mobile';
  const isMobile = screen === 'mobile';
  const isDesktop = screen === 'desktop';

  return {
    platform: isNative ? 'native' : 'web',
    isNative,
    isWeb,
    screen,
    isMobile,
    isDesktop,
    pointer,
  } as const;
};

const shallowEqual = (a: PlatformInfo, b: PlatformInfo) =>
  a.platform === b.platform &&
  a.isNative === b.isNative &&
  a.isWeb === b.isWeb &&
  a.screen === b.screen &&
  a.isMobile === b.isMobile &&
  a.isDesktop === b.isDesktop &&
  a.pointer === b.pointer;

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
