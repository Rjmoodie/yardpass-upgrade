import React, { useEffect, useState } from 'react';
import { Bell, X, Check, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useRealtime, RealtimeEvent } from '@/hooks/useRealtime';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  data?: any;
  eventType?: RealtimeEvent['type'];
}

type NotificationRow = Database['public']['Tables']['notifications']['Row'];

export function NotificationSystem() {
  const { user } = useAuth();
  const { permission, requestPermission, showNotification } = usePushNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Use realtime to listen for events that should create notifications
  useRealtime({
    userId: user?.id,
    onEvent: handleRealtimeEvent,
    enableNotifications: false // We'll handle notifications manually
  });

  async function handleRealtimeEvent(event: RealtimeEvent) {
    if (!user) return;

    const notification = createNotificationFromEvent(event);
    if (notification) {
      addNotification(notification);

      // Show browser notification if permission granted
      if (permission.granted) {
        showNotification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: notification.id
        });
      }

      await persistNotification(notification, event);
    }
  }

  function createNotificationFromEvent(event: RealtimeEvent): Notification | null {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${event.type}-${Date.now()}`;
    const timestamp = new Date();
    const actorId = event.data?.user_id || event.data?.author_user_id;

    if (actorId && actorId === user?.id) {
      return null;
    }

    switch (event.type) {
      case 'payment_completed':
        return {
          id,
          title: 'Payment Successful',
          message: 'Your payment has been processed successfully',
          type: 'success',
          timestamp,
          read: false,
          actionUrl: '/tickets',
          eventType: event.type
        };

      case 'payment_failed':
        return {
          id,
          title: 'Payment Failed',
          message: 'There was an issue processing your payment',
          type: 'error',
          timestamp,
          read: false,
          data: event.data,
          eventType: event.type,
          actionUrl: '/tickets'
        };

      case 'ticket_issued':
        return {
          id,
          title: 'Ticket Issued',
          message: 'Your ticket has been issued successfully',
          type: 'success',
          timestamp,
          read: false,
          actionUrl: '/tickets',
          eventType: event.type
        };

      case 'refund_processed':
        return {
          id,
          title: 'Refund Processed',
          message: 'Your refund has been processed',
          type: 'info',
          timestamp,
          read: false,
          eventType: event.type,
          actionUrl: '/wallet'
        };

      case 'post_created':
        if (event.data.author_user_id !== user?.id) {
          return {
            id,
            title: 'New Post',
            message: 'Someone posted in an event you\'re attending',
            type: 'info',
            timestamp,
            read: false,
            actionUrl: event.eventId ? `/events/${event.eventId}` : undefined,
            eventType: event.type,
            data: event.data
          };
        }
        break;

      case 'reaction_added':
        if (event.data.user_id !== user?.id) {
          return {
            id,
            title: 'New Reaction',
            message: 'Someone reacted to a post',
            type: 'info',
            timestamp,
            read: false,
            eventType: event.type,
            data: event.data
          };
        }
        break;

      case 'reaction_removed':
        return {
          id,
          title: 'Reaction Removed',
          message: 'A reaction was removed from a post you follow',
          type: 'info',
          timestamp,
          read: false,
          eventType: event.type,
          data: event.data
        };

      case 'post_updated':
        return {
          id,
          title: 'Post Updated',
          message: 'A post you follow has new updates',
          type: 'info',
          timestamp,
          read: false,
          eventType: event.type,
          actionUrl: event.eventId ? `/events/${event.eventId}` : undefined,
          data: event.data
        };

      case 'comment_added':
        return {
          id,
          title: 'New Comment',
          message: 'Someone commented on a post you follow',
          type: 'info',
          timestamp,
          read: false,
          eventType: event.type,
          actionUrl: event.eventId ? `/events/${event.eventId}` : undefined,
          data: event.data
        };

      case 'comment_removed':
        return {
          id,
          title: 'Comment Removed',
          message: 'A comment was removed from your feed',
          type: 'warning',
          timestamp,
          read: false,
          eventType: event.type,
          data: event.data
        };

      case 'event_updated':
        return {
          id,
          title: 'Event Updated',
          message: 'Details for an event you follow were updated',
          type: 'info',
          timestamp,
          read: false,
          eventType: event.type,
          actionUrl: event.eventId ? `/events/${event.eventId}` : undefined,
          data: event.data
        };

      case 'follow_updated':
        return {
          id,
          title: 'Follower Activity',
          message: 'Your followed profiles list has changed',
          type: 'info',
          timestamp,
          read: false,
          eventType: event.type,
          actionUrl: '/profile',
          data: event.data
        };

      case 'order_status_changed':
        return {
          id,
          title: 'Order Updated',
          message: `An order status changed to ${event.data?.status || 'updated'}`,
          type: event.data?.status === 'failed' ? 'error' : 'info',
          timestamp,
          read: false,
          eventType: event.type,
          actionUrl: '/tickets',
          data: event.data
        };

      default:
        return null;
    }

    return null;
  }

  function addNotification(notification: Notification) {
    setNotifications(prev => {
      const withoutDuplicate = prev.filter(notif => notif.id !== notification.id);
      return [notification, ...withoutDuplicate].slice(0, 50); // Keep last 50
    });
  }

  function markAsRead(id: string) {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );

    if (user) {
      void supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);
    }
  }

  function markAllAsRead() {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));

    if (user) {
      void supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);
    }
  }

  function removeNotification(id: string) {
    setNotifications(prev => {
      return prev.filter(n => n.id !== id);
    });

    if (user) {
      void supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
    }
  }

  function getNotificationIcon(type: Notification['type']) {
    switch (type) {
      case 'success':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  }

  function formatTimestamp(timestamp: Date) {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  async function persistNotification(notification: Notification, event: RealtimeEvent) {
    if (!user) return;

    try {
      await supabase.from('notifications').upsert({
        id: notification.id,
        user_id: user.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        created_at: notification.timestamp.toISOString(),
        read_at: notification.read ? notification.timestamp.toISOString() : null,
        action_url: notification.actionUrl ?? null,
        event_type: notification.eventType ?? event.type,
        data: notification.data ?? event.data ?? null
      }, { onConflict: 'id' });
    } catch (error) {
      console.error('Failed to persist notification', error);
    }
  }

  function mapRowToNotification(row: NotificationRow): Notification {
    return {
      id: row.id,
      title: row.title,
      message: row.message,
      type: row.type,
      timestamp: row.created_at ? new Date(row.created_at) : new Date(),
      read: !!row.read_at,
      actionUrl: row.action_url ?? undefined,
      data: row.data ?? undefined,
      eventType: (row.event_type as RealtimeEvent['type'] | undefined) ?? undefined
    };
  }

  useEffect(() => {
    setUnreadCount(notifications.filter(notification => !notification.read).length);
  }, [notifications]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error('Failed to load notifications', error);
          return;
        }

        if (data) {
          setNotifications(data.map(mapRowToNotification));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Request permission on first load if not already decided
  useEffect(() => {
    if (permission.default && user) {
      requestPermission();
    }
  }, [permission.default, user, requestPermission]);

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Notification Bell Button */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>

        {/* Notification Panel */}
        {isOpen && (
          <Card className="absolute right-0 top-full mt-2 w-96 max-h-96 overflow-hidden z-50 shadow-lg">
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="font-semibold">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs"
                  >
                    Mark all read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-6 w-6"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No notifications yet
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-3 border-b hover:bg-muted/50 cursor-pointer transition-colors",
                      !notification.read && "bg-muted/30"
                    )}
                    onClick={() => {
                      markAsRead(notification.id);
                      if (notification.actionUrl) {
                        window.location.href = notification.actionUrl;
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm truncate">
                            {notification.title}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNotification(notification.id);
                            }}
                            className="h-4 w-4 opacity-60 hover:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimestamp(notification.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Permission prompt */}
            {permission.default && (
              <div className="p-3 border-t bg-muted/50">
                <p className="text-xs text-muted-foreground mb-2">
                  Enable browser notifications to stay updated
                </p>
                <Button
                  size="sm"
                  onClick={requestPermission}
                  className="w-full"
                >
                  Enable Notifications
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}