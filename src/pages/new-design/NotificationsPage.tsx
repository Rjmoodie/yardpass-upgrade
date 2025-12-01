import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, UserPlus, Calendar, Ticket, Settings, Filter, Check, Trash2 } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  action_url: string | null;
  event_type: string | null;
  data: Record<string, any> | null;
  read_at: string | null;
  created_at: string;
}

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'event' | 'ticket' | 'message';
  user: {
    id?: string;
    name: string;
    avatar: string;
  };
  message: string;
  time: string;
  isRead: boolean;
  actionUrl?: string;
  data?: Record<string, any>;
}

const notificationIcons = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  event: Calendar,
  ticket: Ticket,
  message: MessageCircle,
};

const notificationColors = {
  like: 'text-red-500',
  comment: 'text-blue-500',
  follow: 'text-purple-500',
  event: 'text-yellow-500',
  ticket: 'text-green-500',
  message: 'text-blue-500',
};

type FilterType = 'all' | 'unread' | 'likes' | 'comments' | 'follows' | 'messages' | 'tickets';

const filterConfig: { key: FilterType; label: string; types: Notification['type'][] }[] = [
  { key: 'all', label: 'All', types: [] },
  { key: 'unread', label: 'Unread', types: [] },
  { key: 'likes', label: 'Likes', types: ['like'] },
  { key: 'comments', label: 'Comments', types: ['comment'] },
  { key: 'follows', label: 'Follows', types: ['follow'] },
  { key: 'messages', label: 'Messages', types: ['message'] },
  { key: 'tickets', label: 'Tickets', types: ['ticket'] },
];

export function NotificationsPageIntegrated() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Transform DB row to UI notification
  const transformNotification = useCallback((row: NotificationRow): Notification => {
    // Determine notification type from event_type
    let type: Notification['type'] = 'event';
    if (row.event_type?.includes('follow')) type = 'follow';
    else if (row.event_type?.includes('like')) type = 'like';
    else if (row.event_type?.includes('comment')) type = 'comment';
    else if (row.event_type?.includes('ticket')) type = 'ticket';
    else if (row.event_type?.includes('message')) type = 'message';

    // Extract user info from data
    const userName = row.data?.follower_name || row.data?.user_name || 'Someone';
    const userAvatar = row.data?.user_avatar || '';
    const userId = row.data?.follower_user_id || row.data?.user_id;

    return {
      id: row.id,
      type,
      user: {
        id: userId,
        name: userName,
        avatar: userAvatar,
      },
      message: row.message,
      time: formatDistanceToNow(new Date(row.created_at), { addSuffix: true }),
      isRead: !!row.read_at,
      actionUrl: row.action_url || undefined,
      data: row.data || undefined,
    };
  }, []);

  // Load notifications from table
  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const transformed = (data || []).map(transformNotification);
      setNotifications(transformed);
    } catch (error) {
      console.error('Error loading notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, transformNotification]);

  // Initial load
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Real-time subscriptions
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newRow = payload.new as NotificationRow;
          const newNotification = transformNotification(newRow);
          setNotifications(prev => [newNotification, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updatedRow = payload.new as NotificationRow;
          const updatedNotification = transformNotification(updatedRow);
          setNotifications(prev =>
            prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const deletedId = (payload.old as NotificationRow).id;
          setNotifications(prev => prev.filter(n => n.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, transformNotification]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Optimistically update UI
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [user?.id]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);

      if (error) throw error;

      // Optimistically update UI
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [user?.id]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Optimistically update UI
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [user?.id]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(notif => {
      // Unread filter
      if (filter === 'unread') return !notif.isRead;
      // All filter
      if (filter === 'all') return true;
      // Type-based filters
      const config = filterConfig.find(f => f.key === filter);
      if (config && config.types.length > 0) {
        return config.types.includes(notif.type);
      }
      return true;
    });
  }, [notifications, filter]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Counts for each filter tab
  const filterCounts = useMemo(() => {
    const counts: Record<FilterType, number> = {
      all: notifications.length,
      unread: unreadCount,
      likes: notifications.filter(n => n.type === 'like').length,
      comments: notifications.filter(n => n.type === 'comment').length,
      follows: notifications.filter(n => n.type === 'follow').length,
      messages: notifications.filter(n => n.type === 'message').length,
      tickets: notifications.filter(n => n.type === 'ticket').length,
    };
    return counts;
  }, [notifications, unreadCount]);

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    // Navigate to action URL if exists
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    } else if (notification.data?.post_id) {
      navigate(`/post/${notification.data.post_id}`);
    } else if (notification.data?.event_id) {
      navigate(`/e/${notification.data.event_id}`);
    } else if (notification.user?.id) {
      navigate(`/user/${notification.user.id}`);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-border/10 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border/10 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {unreadCount} unread
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="gap-2"
              >
                <Check className="h-4 w-4" />
                Mark all read
              </Button>
            )}
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Filter Tabs - Scrollable */}
        <div className="overflow-x-auto scrollbar-hide pb-3">
          <div className="flex gap-2 px-4 min-w-max">
            {filterConfig.map(({ key, label }) => {
              const count = filterCounts[key];
              // Hide tabs with 0 items (except All and Unread)
              if (count === 0 && key !== 'all' && key !== 'unread') return null;
              
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                    filter === key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-background/80 text-foreground/80 hover:bg-foreground/5'
                  }`}
                >
                  {label} {count > 0 ? `(${count})` : ''}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="divide-y divide-border/5">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
              {filter === 'likes' ? <Heart className="h-8 w-8 text-muted-foreground" /> :
               filter === 'comments' ? <MessageCircle className="h-8 w-8 text-muted-foreground" /> :
               filter === 'follows' ? <UserPlus className="h-8 w-8 text-muted-foreground" /> :
               filter === 'tickets' ? <Ticket className="h-8 w-8 text-muted-foreground" /> :
               <UserPlus className="h-8 w-8 text-muted-foreground" />}
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {filter === 'unread' ? 'No unread notifications' : 
               filter === 'likes' ? 'No likes yet' :
               filter === 'comments' ? 'No comments yet' :
               filter === 'follows' ? 'No follows yet' :
               filter === 'messages' ? 'No messages yet' :
               filter === 'tickets' ? 'No ticket notifications' :
               'No notifications yet'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {filter === 'unread' ? "You're all caught up!" : 
               filter === 'likes' ? 'When someone likes your posts, it will show here' :
               filter === 'comments' ? 'Comments and replies will appear here' :
               filter === 'follows' ? 'New followers will appear here' :
               filter === 'messages' ? 'New messages will appear here' :
               filter === 'tickets' ? 'Ticket purchase notifications will appear here' :
               'When people interact with you, you\'ll see it here'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            const Icon = notificationIcons[notification.type] || MessageCircle;
            const iconColor = notificationColors[notification.type] || 'text-foreground';

            return (
              <div
                key={notification.id}
                className={`group relative flex items-start gap-3 p-4 transition-all hover:bg-muted/30 ${
                  !notification.isRead ? 'bg-primary/5' : ''
                }`}
              >
                {/* Unread indicator */}
                {!notification.isRead && (
                  <div className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" />
                )}

                {/* Avatar */}
                <Avatar className="h-11 w-11 flex-shrink-0">
                  <AvatarImage src={notification.user.avatar} alt={notification.user.name} />
                  <AvatarFallback className="bg-muted">
                    {notification.user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Content */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${iconColor}`} />
                      <p className="text-sm font-medium text-foreground">
                        {notification.user.name}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {notification.time}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80">{notification.message}</p>
                </div>

                {/* Actions (on hover) */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!notification.isRead && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default NotificationsPageIntegrated;
