// Hardware and browser capability detection hook
// Detects available features for progressive enhancement

export interface Capabilities {
  camera: boolean;
  nfc: boolean;
  haptics: boolean;
  payments: boolean;
  geolocation: boolean;
  notifications: boolean;
}

export function useCapabilities(): Capabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      camera: false,
      nfc: false,
      haptics: false,
      payments: false,
      geolocation: false,
      notifications: false,
    };
  }

  return {
    // Camera access (for QR scanner, etc.)
    camera: !!(navigator.mediaDevices?.getUserMedia),
    
    // NFC for contactless ticket validation
    nfc: 'NDEFReader' in window,
    
    // Haptic feedback
    haptics: 'vibrate' in navigator,
    
    // Payment Request API (Apple/Google Pay)
    payments: 'PaymentRequest' in window,
    
    // Geolocation for location-based discovery
    geolocation: 'geolocation' in navigator,
    
    // Push notifications
    notifications: 'Notification' in window,
  } as const;
}

// Convenience hooks for specific capabilities
export const useHasCamera = () => useCapabilities().camera;
export const useHasNFC = () => useCapabilities().nfc;
export const useHasHaptics = () => useCapabilities().haptics;
export const useHasPayments = () => useCapabilities().payments;
export const useHasGeolocation = () => useCapabilities().geolocation;
export const useHasNotifications = () => useCapabilities().notifications;

