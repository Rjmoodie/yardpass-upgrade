import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Bell, X, Check, AlertCircle, Info, BellDot, BellOff } from 'lucide-react';
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
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Use realtime to listen for events that should create notifications
  const handleRealtimeEvent = useCallback(async (event: RealtimeEvent) => {
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
  }, [user, permission.granted, showNotification]);

  useRealtime({
    userId: user?.id,
    onEvent: handleRealtimeEvent,
    enableNotifications: false // We'll handle notifications manually
  });

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

  const markAsRead = useCallback(async (id: string) => {
    // Immediately update UI state
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );

    // Update unread count immediately
    setUnreadCount(prev => Math.max(0, prev - 1));

    // Persist to database
    if (user) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', user.id);
        
        if (error) {
          console.error('Failed to mark notification as read:', error);
        }
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    }
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    // Immediately update UI state
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    
    // Update unread count immediately
    setUnreadCount(0);

    // Persist to database
    if (user) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .is('read_at', null);
        
        if (error) {
          console.error('Failed to mark all notifications as read:', error);
        }
      } catch (err) {
        console.error('Error marking all notifications as read:', err);
      }
    }
  }, [user]);

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

  // Update unread count based on notifications array (fallback)
  useEffect(() => {
    const actualUnreadCount = notifications.filter(notification => !notification.read).length;
    setUnreadCount(actualUnreadCount);
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

  // Close notification panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isOpen &&
        panelRef.current &&
        buttonRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Notification Bell Button */}
      <div className="relative">
        <Button
          ref={buttonRef}
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "relative hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary transition-all",
            isOpen && "bg-accent"
          )}
        >
          {unreadCount > 0 ? (
            <BellDot className="h-5 w-5 text-primary" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs font-semibold animate-pulse"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>

        {/* Notification Panel */}
        {isOpen && (
          <Card 
            ref={panelRef}
            className="absolute right-0 top-full mt-2 w-96 max-h-96 overflow-hidden z-50 shadow-lg border-2"
          >
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
                      "p-3 border-b hover:bg-muted/50 cursor-pointer transition-colors group",
                      !notification.read && "bg-primary/5 border-l-2 border-l-primary"
                    )}
                    onClick={async () => {
                      // Mark as read first
                      if (!notification.read) {
                        await markAsRead(notification.id);
                      }
                      
                      // Close the notification panel
                      setIsOpen(false);
                      
                      // Navigate if there's an action URL
                      if (notification.actionUrl) {
                        window.location.href = notification.actionUrl;
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn(
                            "font-medium text-sm truncate",
                            !notification.read && "font-semibold"
                          )}>
                            {notification.title}
                          </p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await markAsRead(notification.id);
                                }}
                                className="h-5 w-5"
                                title="Mark as read"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNotification(notification.id);
                              }}
                              className="h-5 w-5"
                              title="Remove notification"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground">
                            {formatTimestamp(notification.timestamp)}
                          </p>
                          {!notification.read && (
                            <Badge variant="secondary" className="text-xs px-1 py-0">
                              New
                            </Badge>
                          )}
                        </div>
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