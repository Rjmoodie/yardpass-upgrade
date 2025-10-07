// iOS Capacitor Runtime Configuration
// Handles StatusBar overlay, Keyboard behavior, and theme-aware styling

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';

/**
 * Initialize iOS-specific Capacitor settings
 * Call this early in your app lifecycle (e.g., main.tsx or App.tsx)
 */
export async function initIOSCapacitor() {
  // Only run on iOS platform
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    return;
  }

  try {
    // 1. Set up StatusBar overlay mode
    await StatusBar.setOverlaysWebView({ overlay: true });
    
    // 2. Set initial StatusBar style based on system theme
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    await StatusBar.setStyle({ 
      style: prefersDark ? Style.Light : Style.Dark 
    });

    // 3. Set up Keyboard behavior for iOS
    await Keyboard.setResizeMode({ mode: 'native' });

    // 4. Listen for theme changes and update StatusBar accordingly
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener('change', async (e) => {
        await StatusBar.setStyle({ 
          style: e.matches ? Style.Light : Style.Dark 
        });
      });
    }

    console.log('✅ iOS Capacitor configuration initialized');
  } catch (error) {
    console.warn('⚠️ Failed to initialize iOS Capacitor config:', error);
  }
}

/**
 * Update StatusBar style when app theme changes
 * Call this when user toggles between light/dark mode
 */
export async function updateStatusBarForTheme(isDark: boolean) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    return;
  }

  try {
    await StatusBar.setStyle({ 
      style: isDark ? Style.Light : Style.Dark 
    });
  } catch (error) {
    console.warn('⚠️ Failed to update StatusBar style:', error);
  }
}

/**
 * Set up keyboard listeners for enhanced UX
 * Optional: Add extra padding when keyboard is open
 */
export function setupKeyboardListeners() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    return;
  }

  // Add/remove class when keyboard shows/hides
  Keyboard.addListener('keyboardWillShow', () => {
    document.documentElement.classList.add('keyboard-open');
  });

  Keyboard.addListener('keyboardWillHide', () => {
    document.documentElement.classList.remove('keyboard-open');
  });
}
