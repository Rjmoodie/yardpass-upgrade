import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>({
    granted: false,
    denied: false,
    default: true
  });
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported (Capacitor native or web fallback)
    const isCapacitor = Capacitor.isNativePlatform();
    const isWebSupported = 'Notification' in window;
    setIsSupported(isCapacitor || isWebSupported);
    
    if (isCapacitor) {
      // In Capacitor, check native permission
      PushNotifications.checkPermissions().then((result) => {
        setPermission({
          granted: result.receive === 'granted',
          denied: result.receive === 'denied',
          default: result.receive === 'prompt'
        });
      });
    } else if (isWebSupported) {
      // Web fallback
      setPermission({
        granted: Notification.permission === 'granted',
        denied: Notification.permission === 'denied',
        default: Notification.permission === 'default'
      });
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      // Only show error in development, not in production
      if (process.env.NODE_ENV === 'development') {
        toast({
          title: "Not Supported",
          description: "Push notifications are not supported in this browser",
          variant: "destructive",
        });
      }
      return false;
    }

    try {
      const isCapacitor = Capacitor.isNativePlatform();
      let granted = false;

      if (isCapacitor) {
        // Use Capacitor native push notifications
        const result = await PushNotifications.requestPermissions();
        granted = result.receive === 'granted';
        
        setPermission({
          granted,
          denied: result.receive === 'denied',
          default: result.receive === 'prompt'
        });
      } else {
        // Web fallback
        const result = await Notification.requestPermission();
        granted = result === 'granted';
        
        setPermission({
          granted,
          denied: result === 'denied',
          default: result === 'default'
        });
      }

      if (granted) {
        toast({
          title: "Notifications Enabled",
          description: "You'll receive updates about your tickets",
        });
      } else {
        toast({
          title: "Notifications Disabled",
          description: "You can enable them later in your device settings",
          variant: "destructive",
        });
      }

      return granted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({
        title: "Error",
        description: "Failed to request notification permission",
        variant: "destructive",
      });
      return false;
    }
  }, [isSupported]);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!permission.granted) {
      console.warn('Notifications not granted');
      return;
    }

    try {
      const isCapacitor = Capacitor.isNativePlatform();
      
      if (isCapacitor) {
        // In Capacitor, use local notifications
        PushNotifications.schedule({
          notifications: [{
            title,
            body: options?.body || '',
            id: Date.now(),
            schedule: { at: new Date(Date.now() + 1000) }, // Show immediately
            sound: 'default',
            attachments: undefined,
            actionTypeId: '',
            extra: options?.data || {}
          }]
        });
      } else {
        // Web fallback
        const notification = new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options
        });

        // Auto-close after 5 seconds
        setTimeout(() => {
          notification.close();
        }, 5000);

        return notification;
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [permission.granted]);

  const showTicketNotification = useCallback((ticketTitle: string, eventTitle: string, type: 'reminder' | 'update' | 'checkin') => {
    const messages = {
      reminder: `Don't forget! ${eventTitle} is coming up soon`,
      update: `Update for ${eventTitle}`,
      checkin: `Time to check in for ${eventTitle}`
    };

    showNotification(messages[type], {
      body: `Your ${ticketTitle} ticket is ready`,
      tag: `ticket-${type}`,
      requireInteraction: type === 'reminder'
    });
  }, [showNotification]);

  const showProfileNotification = useCallback((message: string, type: 'role_change' | 'verification' | 'update') => {
    const titles = {
      role_change: 'Role Updated',
      verification: 'Verification Status',
      update: 'Profile Updated'
    };

    showNotification(titles[type], {
      body: message,
      tag: `profile-${type}`
    });
  }, [showNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    showTicketNotification,
    showProfileNotification
  };
}

// Service Worker registration for background notifications
export function useServiceWorker() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registered:', reg);
          setRegistration(reg);
          setIsRegistered(true);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  const sendMessageToSW = useCallback((message: any) => {
    if (registration?.active) {
      registration.active.postMessage(message);
    }
  }, [registration]);

  return {
    isRegistered,
    registration,
    sendMessageToSW
  };
}
