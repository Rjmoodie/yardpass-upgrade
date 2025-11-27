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

/**
 * Register device token with retry logic
 */
async function registerTokenWithRetry(userId: string, token: string, maxRetries = 3): Promise<void> {
  const backoffSchedule = [1000, 5000, 30000]; // 1s, 5s, 30s

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Get device info for analytics
      let deviceInfo: { model?: string; appVersion?: string; version?: string; manufacturer?: string } | null = null;
      try {
        const { getDeviceInfo } = await import('@/utils/deviceInfo');
        deviceInfo = await getDeviceInfo();
      } catch (err) {
        console.warn('Could not get device info:', err);
      }
      
      // Mark old token as invalid if this is a refresh
      if (attempt === 0) {
        // Check if there's an existing active token for this user
        const { data: existingDevices } = await supabase
          .from('user_devices')
          .select('push_token')
          .eq('user_id', userId)
          .eq('platform', 'ios')
          .eq('active', true)
          .neq('push_token', token);

        if (existingDevices && existingDevices.length > 0) {
          // Mark old tokens as inactive (Phase 2.2.3: Enhanced lifecycle management)
          // They may still be valid, just replaced by a new token
          await supabase
            .from('user_devices')
            .update({ 
              active: false,
              status: 'inactive', // Explicit lifecycle status
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
            .eq('platform', 'ios')
            .in('push_token', existingDevices.map(d => d.push_token));
        }
      }
      
      // Store/update device token in database (Phase 2.2.3: Enhanced lifecycle management)
      const { error: upsertError } = await supabase.from('user_devices').upsert({
        user_id: userId,
        platform: 'ios',
        push_token: token,
        active: true,
        status: 'active', // Explicit lifecycle status
        device_model: deviceInfo?.model || null,
        device_name: deviceInfo?.manufacturer ? `${deviceInfo.manufacturer} ${deviceInfo.model}`.trim() : null,
        app_version: deviceInfo?.appVersion || null,
        os_version: deviceInfo?.version || null,
        last_seen_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,push_token',
      });

      if (upsertError) {
        throw new Error(`Failed to store device token: ${upsertError.message}`);
      }

      console.log('Device token stored/updated successfully');
      return; // Success

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (attempt === maxRetries) {
        // All retries failed
        console.error(`Failed to register token after ${maxRetries + 1} attempts:`, errorMessage);
        throw error;
      }

      // Wait before retry
      const delayMs = backoffSchedule[Math.min(attempt, backoffSchedule.length - 1)];
      console.warn(`Token registration attempt ${attempt + 1} failed, retrying in ${delayMs}ms:`, errorMessage);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
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

        // Handle successful registration / token refresh
        PushNotifications.addListener('registration', async (token) => {
          console.log('APNs token received:', token.value);

          if (user) {
            try {
              // Retry token registration with exponential backoff
              await registerTokenWithRetry(user.id, token.value);
            } catch (error) {
              console.error('Failed to register token after retries:', error);
            }
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

  // Handle logout - mark tokens as inactive (don't delete, for re-engagement)
  useEffect(() => {
    if (!user && Capacitor.isNativePlatform()) {
      // On logout, we could mark tokens inactive, but we'll keep them active
      // so users can receive notifications when they log back in
      // This is optional - you may want to keep tokens active for re-engagement
      console.log('User logged out - push notification tokens kept active for re-engagement');
    }
  }, [user]);

  return {
    permission,
    requestPermission,
    showNotification,
  };
}

