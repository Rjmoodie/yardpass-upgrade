import { useEffect, useState, useCallback } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface PushPermission {
  granted: boolean;
  denied: boolean;
  prompt: boolean;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [permission, setPermission] = useState<PushPermission>({
    granted: false,
    denied: false,
    prompt: true,
  });

  // Request push notification permission
  const requestPermission = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications only available on native platforms');
      return { granted: false };
    }

    try {
      const permResult = await PushNotifications.requestPermissions();
      
      const newPermission = {
        granted: permResult.receive === 'granted',
        denied: permResult.receive === 'denied',
        prompt: permResult.receive === 'prompt',
      };

      setPermission(newPermission);

      if (newPermission.granted) {
        await PushNotifications.register();
      }

      return newPermission;
    } catch (error) {
      console.error('Error requesting push permission:', error);
      return { granted: false };
    }
  }, []);

  // Show a notification (for web/testing - actual push handled by backend)
  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!Capacitor.isNativePlatform() && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, options);
    }
  }, []);

  useEffect(() => {
    // Only run on native platforms
    if (!Capacitor.isNativePlatform()) return;
    if (!user) return;

    const setupPushNotifications = async () => {
      try {
        // Check current permission status
        const permResult = await PushNotifications.checkPermissions();
        
        setPermission({
          granted: permResult.receive === 'granted',
          denied: permResult.receive === 'denied',
          prompt: permResult.receive === 'prompt',
        });

        // If already granted, register
        if (permResult.receive === 'granted') {
          await PushNotifications.register();
        }

        // Handle successful registration
        PushNotifications.addListener('registration', async (token) => {
          console.log('APNs token received:', token.value);

          try {
            // Store device token in database
            await supabase.from('user_devices').upsert({
              user_id: user.id,
              platform: 'ios',
              push_token: token.value,
              last_seen_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,push_token',
            });

            console.log('Device token stored successfully');
          } catch (error) {
            console.error('Failed to store device token:', error);
          }
        });

        // Handle registration errors
        PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
        });

        // Handle notifications received while app is in foreground
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received (foreground):', notification);
          
          // You can show an in-app toast here
          // Example: toast({ title: notification.title, description: notification.body });
        });

        // Handle notification taps (deep linking)
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('Push notification action performed:', action);
          
          const data = action.notification.data;

          // Handle different notification types
          if (data?.type === 'event' && data.id) {
            navigate(`/events/${data.id}`);
          } else if (data?.type === 'post' && data.id) {
            navigate(`/posts/${data.id}`);
          } else if (data?.type === 'ticket' && data.id) {
            navigate(`/tickets/${data.id}`);
          } else if (data?.deepLink) {
            navigate(data.deepLink);
          }
        });

        console.log('Push notifications setup complete');

      } catch (error) {
        console.error('Push notification setup error:', error);
      }
    };

    setupPushNotifications();

    // Cleanup listeners on unmount
    return () => {
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [user, navigate]);

  return {
    permission,
    requestPermission,
    showNotification,
  };
}

