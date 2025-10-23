// Platform wrapper components for conditional rendering
// Allows components to be shown only on specific platforms

import React, { useMemo } from 'react';
import { usePlatform } from '@/hooks/usePlatform';

interface PlatformWrapperProps {
  children: React.ReactNode;
  webOnly?: boolean;
  mobileOnly?: boolean;
  nativeOnly?: boolean;
  desktopOnly?: boolean;
  fallback?: React.ReactNode;
}

/**
 * PlatformWrapper - Conditionally renders children based on platform
 * 
 * @param webOnly - Only show on web platform
 * @param mobileOnly - Only show on mobile platform (native or responsive)
 * @param nativeOnly - Only show on native mobile apps
 * @param desktopOnly - Only show on desktop web
 * @param fallback - Component to show when conditions aren't met
 */
export const PlatformWrapper: React.FC<PlatformWrapperProps> = ({
  children,
  webOnly = false,
  mobileOnly = false,
  nativeOnly = false,
  desktopOnly = false,
  fallback = null
}) => {
  const { isWeb, isMobile, isNative, isDesktop } = usePlatform();

  const shouldRender = useMemo(() => {
    if (webOnly && !isWeb) return false;
    if (mobileOnly && !isMobile) return false;
    if (nativeOnly && !isNative) return false;
    if (desktopOnly && !isDesktop) return false;
    return true;
  }, [desktopOnly, isDesktop, isMobile, isNative, isWeb, mobileOnly, nativeOnly, webOnly]);

  if (!shouldRender) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

/**
 * WebOnly - Only renders on web platform
 */
export const WebOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback = null
}) => {
  return (
    <PlatformWrapper webOnly fallback={fallback}>
      {children}
    </PlatformWrapper>
  );
};

/**
 * MobileOnly - Only renders on mobile platform (native or responsive)
 */
export const MobileOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback = null
}) => {
  return (
    <PlatformWrapper mobileOnly fallback={fallback}>
      {children}
    </PlatformWrapper>
  );
};

/**
 * NativeOnly - Only renders on native mobile apps
 */
export const NativeOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback = null
}) => {
  return (
    <PlatformWrapper nativeOnly fallback={fallback}>
      {children}
    </PlatformWrapper>
  );
};

/**
 * DesktopOnly - Only renders on desktop web
 */
export const DesktopOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback = null
}) => {
  return (
    <PlatformWrapper desktopOnly fallback={fallback}>
      {children}
    </PlatformWrapper>
  );
};

/**
 * ResponsiveWrapper - Renders different content based on screen size
 */
interface ResponsiveWrapperProps {
  mobile: React.ReactNode;
  tablet?: React.ReactNode;
  desktop: React.ReactNode;
}

export const ResponsiveWrapper: React.FC<ResponsiveWrapperProps> = ({
  mobile,
  tablet,
  desktop
}) => {
  const { screenSize } = usePlatform();

  switch (screenSize) {
    case 'mobile':
      return <>{mobile}</>;
    case 'tablet':
      return <>{tablet || mobile}</>;
    case 'desktop':
      return <>{desktop}</>;
    default:
      return <>{desktop}</>;
  }
};

/**
 * PlatformAware - Renders content with platform-specific styling
 */
interface PlatformAwareProps {
  children: React.ReactNode;
  className?: string;
  mobileClassName?: string;
  desktopClassName?: string;
}

export const PlatformAware: React.FC<PlatformAwareProps> = ({
  children,
  className = '',
  mobileClassName = '',
  desktopClassName = ''
}) => {
  const { isMobile, isDesktop } = usePlatform();

  const getClassName = () => {
    let baseClass = className;
    
    if (isMobile && mobileClassName) {
      baseClass += ` ${mobileClassName}`;
    }
    
    if (isDesktop && desktopClassName) {
      baseClass += ` ${desktopClassName}`;
    }
    
    return baseClass.trim();
  };

  return (
    <div className={getClassName()}>
      {children}
    </div>
  );
};

export default PlatformWrapper;
