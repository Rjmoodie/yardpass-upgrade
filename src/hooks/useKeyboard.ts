import { useEffect, useState } from 'react';
import { Keyboard, KeyboardInfo } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';

interface KeyboardState {
  isVisible: boolean;
  height: number;
}

/**
 * Hook to manage iOS/Android keyboard state and behavior
 * 
 * @returns {Object} Keyboard state and utility functions
 * @property {boolean} isVisible - Whether keyboard is currently visible
 * @property {number} height - Current keyboard height in pixels
 * @property {Function} hide - Manually hide the keyboard
 * @property {Function} show - Manually show the keyboard
 */
export function useKeyboard() {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isVisible: false,
    height: 0,
  });

  useEffect(() => {
    // Only run on native platforms
    if (!Capacitor.isNativePlatform()) return;

    // Keyboard will show event
    const showListener = Keyboard.addListener('keyboardWillShow', (info: KeyboardInfo) => {
      setKeyboardState({
        isVisible: true,
        height: info.keyboardHeight,
      });
    });

    // Keyboard did show event (for Android)
    const didShowListener = Keyboard.addListener('keyboardDidShow', (info: KeyboardInfo) => {
      setKeyboardState({
        isVisible: true,
        height: info.keyboardHeight,
      });
    });

    // Keyboard will hide event
    const hideListener = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardState({
        isVisible: false,
        height: 0,
      });
    });

    // Keyboard did hide event (for Android)
    const didHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardState({
        isVisible: false,
        height: 0,
      });
    });

    // Cleanup listeners
    return () => {
      showListener.remove();
      didShowListener.remove();
      hideListener.remove();
      didHideListener.remove();
    };
  }, []);

  // Utility functions
  const hide = async () => {
    if (!Capacitor.isNativePlatform()) return;
    await Keyboard.hide();
  };

  const show = async () => {
    if (!Capacitor.isNativePlatform()) return;
    await Keyboard.show();
  };

  return {
    isVisible: keyboardState.isVisible,
    height: keyboardState.height,
    hide,
    show,
  };
}

/**
 * Hook to automatically adjust element padding when keyboard appears
 * Useful for forms, chat inputs, etc.
 * 
 * @param {number} extraPadding - Additional padding to add (default: 0)
 * @returns {Object} Style object to apply to your container
 */
export function useKeyboardPadding(extraPadding: number = 0) {
  const { isVisible, height } = useKeyboard();

  return {
    paddingBottom: isVisible ? height + extraPadding : 0,
    transition: 'padding-bottom 0.2s ease-out',
  };
}

/**
 * Hook to handle "done" button on iOS keyboard
 * Automatically hides keyboard when user taps done/return
 */
export function useKeyboardDismiss() {
  const { hide } = useKeyboard();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      hide();
    }
  };

  return { handleKeyDown };
}





