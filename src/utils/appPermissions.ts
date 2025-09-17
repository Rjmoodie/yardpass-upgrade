// App permissions and capabilities for mobile deployment

export interface PermissionStatus {
  granted: boolean;
  canRequest: boolean;
  message?: string;
}

export interface AppCapabilities {
  camera: PermissionStatus;
  photos: PermissionStatus;
  notifications: PermissionStatus;
  location: PermissionStatus;
  contacts: PermissionStatus;
}

export async function checkAppCapabilities(): Promise<AppCapabilities> {
  const isNative = !!(window as any)?.Capacitor?.isNativePlatform;
  
  if (!isNative) {
    // Web fallback - check for basic web APIs
    return {
      camera: {
        granted: !!navigator.mediaDevices?.getUserMedia,
        canRequest: !!navigator.mediaDevices?.getUserMedia,
        message: 'Camera access via web APIs'
      },
      photos: {
        granted: false,
        canRequest: false,
        message: 'File upload available via web APIs'
      },
      notifications: {
        granted: Notification.permission === 'granted',
        canRequest: 'Notification' in window,
        message: 'Web notifications available'
      },
      location: {
        granted: false,
        canRequest: !!navigator.geolocation,
        message: 'Geolocation API available'
      },
      contacts: {
        granted: false,
        canRequest: false,
        message: 'Not available on web'
      }
    };
  }

  // Native platform capabilities
  return {
    camera: {
      granted: true,
      canRequest: true,
      message: 'Native camera access'
    },
    photos: {
      granted: true,
      canRequest: true,
      message: 'Native photo library access'
    },
    notifications: {
      granted: true,
      canRequest: true,
      message: 'Native push notifications'
    },
    location: {
      granted: true,
      canRequest: true,
      message: 'Native location services'
    },
    contacts: {
      granted: false,
      canRequest: true,
      message: 'Contact access requires additional setup'
    }
  };
}

// App Store / Play Store readiness checklist
export const deploymentChecklist = {
  ios: {
    required: [
      'App Store Connect account',
      'iOS Developer Program membership',
      'Valid provisioning profiles',
      'App Store guidelines compliance',
      'Privacy policy accessible',
      'Terms of service accessible',
      'Age rating determined',
      'App icon (1024x1024)',
      'Screenshots for all device sizes',
      'App description and keywords'
    ],
    recommended: [
      'TestFlight beta testing',
      'App Store optimization',
      'Localization for target markets',
      'In-app purchase configuration',
      'Push notification certificates'
    ]
  },
  android: {
    required: [
      'Google Play Console account',
      'App signing key',
      'Play Store guidelines compliance',
      'Privacy policy accessible',
      'Terms of service accessible',
      'Content rating questionnaire',
      'App icon (512x512)',
      'Screenshots for all device sizes',
      'Store listing details'
    ],
    recommended: [
      'Internal testing track',
      'Play Store optimization',
      'Localization for target markets',
      'In-app billing setup',
      'Firebase Cloud Messaging'
    ]
  }
};