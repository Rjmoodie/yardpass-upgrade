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

// Map utilities
export const openMap = (address: string): void => {
  try {
    // Encode the address for URL
    const encodedAddress = encodeURIComponent(address);
    
    // Try to open in the default map app
    if (isIOS()) {
      // iOS: Try Apple Maps first, then fallback to Google Maps
      const appleMapsUrl = `maps://maps.apple.com/?q=${encodedAddress}`;
      const googleMapsUrl = `https://maps.google.com/maps?q=${encodedAddress}`;
      
      // Try Apple Maps first
      const appleMapsLink = document.createElement('a');
      appleMapsLink.href = appleMapsUrl;
      appleMapsLink.target = '_blank';
      appleMapsLink.click();
    } else {
      // Android/Desktop: Use Google Maps
      const googleMapsUrl = `https://maps.google.com/maps?q=${encodedAddress}`;
      window.open(googleMapsUrl, '_blank');
    }
  } catch (error) {
    console.error('Failed to open map:', error);
    // Fallback: open Google Maps in new tab
    const encodedAddress = encodeURIComponent(address);
    const googleMapsUrl = `https://maps.google.com/maps?q=${encodedAddress}`;
    window.open(googleMapsUrl, '_blank');
  }
};

// Phone call utilities
export const callPhoneNumber = (phoneNumber: string): void => {
  try {
    // Clean the phone number (remove spaces, dashes, etc.)
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
    const telUrl = `tel:${cleaned}`;
    
    // Create a link and click it to initiate the call
    const link = document.createElement('a');
    link.href = telUrl;
    link.click();
  } catch (error) {
    console.error('Failed to initiate phone call:', error);
  }
};

// Email utilities
export const sendEmail = (email: string, subject?: string, body?: string): void => {
  try {
    const mailtoUrl = `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}${body ? `${subject ? '&' : '?'}body=${encodeURIComponent(body)}` : ''}`;
    window.open(mailtoUrl, '_blank');
  } catch (error) {
    console.error('Failed to open email client:', error);
  }
};