// iOS keyboard handling for auth screens
import { Capacitor } from '@capacitor/core';
import { focusGate, isIOS } from './platform';

let originalResizeMode: any = null;
let originalOverlay: any = null;

export function installIosAuthScreenTuning() {
  // Only run on native iOS platform
  if (!isIOS() || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    return;
  }

  // Dynamically import Capacitor plugins only on native iOS
  Promise.all([
    import('@capacitor/keyboard').then(m => m.Keyboard),
    import('@capacitor/status-bar').then(m => m.StatusBar)
  ]).then(([Keyboard, StatusBar]) => {
    // Store original settings
    Keyboard.getResizeMode().then(mode => {
      originalResizeMode = mode;
    }).catch(() => {});
    
    StatusBar.getInfo().then(info => {
      originalOverlay = info.overlays;
    }).catch(() => {});

    // For auth screen, use stable layout during typing
    Keyboard.setResizeMode({ mode: 'body' }).catch(() => {}); // Less jumpy than 'native' on iOS
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {}); // Prevent top inset changes

    // Mark focus gate active during keyboard transitions
    Keyboard.addListener('keyboardWillShow', () => {
      focusGate.active = true;
    });

    Keyboard.addListener('keyboardWillHide', () => {
      // Allow viewport to restore before allowing navigation
      setTimeout(() => (focusGate.active = false), 200);
    });
  }).catch(() => {
    // Silently fail if plugins aren't available
  });
}

export function restoreIosAuthScreenTuning() {
  // Only run on native iOS platform
  if (!isIOS() || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    return;
  }

  // Dynamically import and restore settings
  Promise.all([
    import('@capacitor/keyboard').then(m => m.Keyboard),
    import('@capacitor/status-bar').then(m => m.StatusBar)
  ]).then(([Keyboard, StatusBar]) => {
    // Restore original settings
    if (originalResizeMode !== null) {
      Keyboard.setResizeMode({ mode: originalResizeMode }).catch(() => {});
    }
    if (originalOverlay !== null) {
      StatusBar.setOverlaysWebView({ overlay: originalOverlay }).catch(() => {});
    }
  }).catch(() => {
    // Silently fail if plugins aren't available
  });
}
