// components/ResponsiveDebugger.tsx
import { useEffect, useState } from 'react';

interface ViewportInfo {
  width: number;
  height: number;
  breakpoint: string;
  deviceType: string;
  orientation: 'portrait' | 'landscape';
  safeAreaInsets: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

/**
 * Development utility component for responsive design debugging
 * Shows current viewport info and breakpoint detection
 * Only renders in development mode
 */
export function ResponsiveDebugger() {
  const [viewport, setViewport] = useState<ViewportInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show in development
    if (import.meta.env?.PROD) return;

    const updateViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Determine breakpoint
      let breakpoint = 'XS';
      if (width >= 1600) breakpoint = '2XL';
      else if (width >= 1280) breakpoint = 'XL';
      else if (width >= 1024) breakpoint = 'LG';
      else if (width >= 768) breakpoint = 'MD';
      else if (width >= 640) breakpoint = 'SM';

      // Determine device type
      let deviceType = 'Desktop';
      if (width <= 430) {
        if (width <= 360) deviceType = 'Small Android';
        else if (width <= 375) deviceType = 'iPhone X';
        else if (width <= 393) deviceType = 'iPhone 12/14';
        else deviceType = 'iPhone 14 Pro Max';
      } else if (width <= 768) deviceType = 'Large Phone';
      else if (width <= 1024) deviceType = 'Tablet';

      // Get safe area insets (iOS)
      const safeAreaInsets = {
        top: parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)') || '0'),
        right: parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-right)') || '0'),
        bottom: parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)') || '0'),
        left: parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-left)') || '0'),
      };

      setViewport({
        width,
        height,
        breakpoint,
        deviceType,
        orientation: width > height ? 'landscape' : 'portrait',
        safeAreaInsets,
      });
    };

    // Initial update
    updateViewport();

    // Listen for resize
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);

    // Toggle visibility with 'D' key
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'd' && e.ctrlKey) {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  if (import.meta.env?.PROD || !isVisible || !viewport) return null;

  return (
    <div className="fixed top-0 left-0 z-[9999] bg-black/90 text-white p-2 text-xs font-mono pointer-events-none">
      <div className="space-y-1">
        <div><strong>Breakpoint:</strong> {viewport.breakpoint}</div>
        <div><strong>Device:</strong> {viewport.deviceType}</div>
        <div><strong>Viewport:</strong> {viewport.width}×{viewport.height}</div>
        <div><strong>Orientation:</strong> {viewport.orientation}</div>
        <div><strong>Safe Area:</strong> T:{viewport.safeAreaInsets.top} R:{viewport.safeAreaInsets.right} B:{viewport.safeAreaInsets.bottom} L:{viewport.safeAreaInsets.left}</div>
        <div className="text-gray-400 text-[10px]">Press Ctrl+D to toggle</div>
      </div>
    </div>
  );
}

/**
 * Hook for responsive design utilities
 */
export function useResponsive() {
  const [viewport, setViewport] = useState<ViewportInfo | null>(null);

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      let breakpoint = 'XS';
      if (width >= 1600) breakpoint = '2XL';
      else if (width >= 1280) breakpoint = 'XL';
      else if (width >= 1024) breakpoint = 'LG';
      else if (width >= 768) breakpoint = 'MD';
      else if (width >= 640) breakpoint = 'SM';

      let deviceType = 'Desktop';
      if (width <= 430) {
        if (width <= 360) deviceType = 'Small Android';
        else if (width <= 375) deviceType = 'iPhone X';
        else if (width <= 393) deviceType = 'iPhone 12/14';
        else deviceType = 'iPhone 14 Pro Max';
      } else if (width <= 768) deviceType = 'Large Phone';
      else if (width <= 1024) deviceType = 'Tablet';

      const safeAreaInsets = {
        top: parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)') || '0'),
        right: parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-right)') || '0'),
        bottom: parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)') || '0'),
        left: parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-left)') || '0'),
      };

      setViewport({
        width,
        height,
        breakpoint,
        deviceType,
        orientation: width > height ? 'landscape' : 'portrait',
        safeAreaInsets,
      });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  return {
    viewport,
    isMobile: viewport?.width ? viewport.width <= 640 : false,
    isTablet: viewport?.width ? viewport.width > 640 && viewport.width <= 1024 : false,
    isDesktop: viewport?.width ? viewport.width > 1024 : false,
    isLandscape: viewport?.orientation === 'landscape',
    isPortrait: viewport?.orientation === 'portrait',
    hasNotch: viewport?.safeAreaInsets.top ? viewport.safeAreaInsets.top > 0 : false,
    hasHomeIndicator: viewport?.safeAreaInsets.bottom ? viewport.safeAreaInsets.bottom > 0 : false,
  };
}
