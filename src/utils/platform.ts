// Platform detection and iOS-specific utilities
export const isIOS = () =>
  typeof navigator !== 'undefined' &&
  /iPhone|iPad|iPod/i.test(navigator.userAgent);

// Focus gate to prevent navigation during input transitions
export const focusGate = {
  active: false,
  with<R>(fn: () => R, ms = 250): R {
    this.active = true;
    const out = fn();
    setTimeout(() => (this.active = false), ms);
    return out;
  },
};

// iOS-specific logging for debugging
export const log = (...args: any[]) => isIOS() && console.log('[iOS auth]', ...args);

// Clipboard utilities
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      return result;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

// Share utilities
export const shareContent = async (data: { title: string; text?: string; url: string }): Promise<boolean> => {
  try {
    if (navigator.share) {
      await navigator.share(data);
      return true;
    } else {
      // Fallback: copy to clipboard
      const shareText = `${data.title}${data.text ? ` - ${data.text}` : ''}\n${data.url}`;
      return await copyToClipboard(shareText);
    }
  } catch (error) {
    console.error('Failed to share content:', error);
    return false;
  }
};