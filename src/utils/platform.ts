// Cross-platform utilities for web APIs

export const isCapacitor = () => {
  return !!(window as any)?.Capacitor;
};

export const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Clipboard functionality with fallbacks
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    // Modern Clipboard API (preferred)
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for older browsers or insecure contexts
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
  } catch (error) {
    console.error('Clipboard operation failed:', error);
    return false;
  }
};

// Native share functionality with fallback
export const shareContent = async (data: {
  title?: string;
  text?: string;
  url?: string;
}): Promise<boolean> => {
  try {
    // Check if native sharing is available
    if (navigator.share) {
      await navigator.share(data);
      return true;
    }
    
    // Fallback: copy to clipboard
    const shareText = [data.title, data.text, data.url].filter(Boolean).join('\n');
    return await copyToClipboard(shareText);
  } catch (error) {
    console.error('Share operation failed:', error);
    // Final fallback: copy to clipboard
    const shareText = [data.title, data.text, data.url].filter(Boolean).join('\n');
    return await copyToClipboard(shareText);
  }
};

// Map opening functionality
export const openMap = (address: string, eventName?: string) => {
  const query = eventName ? `${eventName}, ${address}` : address;
  const encodedQuery = encodeURIComponent(query);
  
  // Detect platform and use appropriate map service
  const userAgent = navigator.userAgent;
  
  if (/iPad|iPhone|iPod/.test(userAgent)) {
    // iOS - try Apple Maps first, fallback to Google
    const appleUrl = `maps://maps.apple.com/?q=${encodedQuery}`;
    const googleUrl = `https://maps.google.com/maps?q=${encodedQuery}`;
    
    try {
      window.location.href = appleUrl;
      // Fallback to Google Maps if Apple Maps fails
      setTimeout(() => {
        window.open(googleUrl, '_blank');
      }, 500);
    } catch {
      window.open(googleUrl, '_blank');
    }
  } else if (/Android/.test(userAgent)) {
    // Android - use Google Maps
    const googleUrl = `geo:0,0?q=${encodedQuery}`;
    const fallbackUrl = `https://maps.google.com/maps?q=${encodedQuery}`;
    
    try {
      window.location.href = googleUrl;
      // Fallback to web Google Maps
      setTimeout(() => {
        window.open(fallbackUrl, '_blank');
      }, 500);
    } catch {
      window.open(fallbackUrl, '_blank');
    }
  } else {
    // Desktop - open Google Maps in new tab
    const googleUrl = `https://maps.google.com/maps?q=${encodedQuery}`;
    window.open(googleUrl, '_blank');
  }
};

// Phone number formatting and calling
export const callPhoneNumber = (phoneNumber: string) => {
  const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
  window.location.href = `tel:${cleanPhone}`;
};

// Email functionality
export const sendEmail = (email: string, subject?: string, body?: string) => {
  const params = new URLSearchParams();
  if (subject) params.append('subject', subject);
  if (body) params.append('body', body);
  
  const mailtoUrl = `mailto:${email}${params.toString() ? '?' + params.toString() : ''}`;
  window.location.href = mailtoUrl;
};