import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, UserPlus, Calendar, Ticket, Settings, Filter } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { transformNotification, getTimeAgo } from "@/lib/dataTransformers";

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'event' | 'ticket';
  user: {
    id?: string;
    name: string;
    avatar: string;
  };
  message: string;
  time: string;
  isRead: boolean;
  postId?: string;
  eventId?: string;
}

const notificationIcons = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  event: Calendar,
  ticket: Ticket
};

const notificationColors = {
  like: 'text-red-500',
  comment: 'text-blue-500',
  follow: 'text-purple-500',
  event: 'text-yellow-500',
  ticket: 'text-green-500'
};

export function NotificationsPageIntegrated() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Load notifications
  useEffect(() => {
    const loadNotifications = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Fetch reactions (likes/comments on user's posts)
        const { data: reactions } = await supabase
          .from('event_reactions')
          .select(`
            id,
            kind,
            created_at,
            user_id,
            post_id,
            user_profiles!event_reactions_user_id_fkey (
              user_id,
              display_name,
              photo_url
            ),
            event_posts!event_reactions_post_id_fkey (
              author_user_id,
              event_id
            )
          `)
          .eq('event_posts.author_user_id', user.id)
          .neq('user_id', user.id) // Don't show own reactions
          .order('created_at', { ascending: false })
          .limit(30);

        // Fetch new followers
        const { data: follows } = await supabase
          .from('follows')
          .select(`
            id,
            created_at,
            follower_user_id,
            user_profiles!follows_follower_user_id_fkey (
              user_id,
              display_name,
              photo_url
            )
          `)
          .eq('target_id', user.id)
          .eq('target_type', 'user')
          .order('created_at', { ascending: false })
          .limit(20);

        // Combine and transform
        const combined: Notification[] = [
          ...(reactions || []).map((r: any) => ({
            id: r.id,
            type: r.kind === 'like' ? 'like' as const : 'comment' as const,
            user: {
              id: r.user_profiles?.user_id,
              name: r.user_profiles?.display_name || 'User',
              avatar: r.user_profiles?.photo_url || ''
            },
            message: r.kind === 'like' ? 'liked your post' : 'commented on your post',
            time: getTimeAgo(r.created_at),
            isRead: false,
            postId: r.post_id,
            eventId: r.event_posts?.event_id
          })),
          ...(follows || []).map((f: any) => ({
            id: f.id,
            type: 'follow' as const,
            user: {
              id: f.user_profiles?.user_id,
              name: f.user_profiles?.display_name || 'User',
              avatar: f.user_profiles?.photo_url || ''
            },
            message: 'started following you',
            time: getTimeAgo(f.created_at),
            isRead: false
          }))
        ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

        setNotifications(combined);
      } catch (error) {
        console.error('Error loading notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [user?.id]);

  const filteredNotifications = notifications.filter(notif => 
    filter === 'all' || !notif.isRead
  );

  const handleNotificationClick = (notification: Notification) => {
    if (notification.postId) {
      navigate(`/post/${notification.postId}`);
    } else if (notification.eventId) {
      navigate(`/e/${notification.eventId}`);
    } else if (notification.user.id && notification.type === 'follow') {
      navigate(`/profile/${notification.user.id}`);
    }
  };

  const markAllAsRead = async () => {
    // Mark all as read in database
    setNotifications(prev => 
      prev.map(n => ({ ...n, isRead: true }))
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#FF8C00]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/80 px-3 py-4 backdrop-blur-xl sm:px-4 md:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Notifications</h1>
          <button 
            onClick={() => navigate('/notifications/settings')}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:bg-white/10"
          >
            <Settings className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition-all sm:text-base ${
              filter === 'all'
                ? 'bg-[#FF8C00] text-white'
                : 'border border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition-all sm:text-base ${
              filter === 'unread'
                ? 'bg-[#FF8C00] text-white'
                : 'border border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Unread {notifications.filter(n => !n.isRead).length > 0 && `(${notifications.filter(n => !n.isRead).length})`}
          </button>
        </div>

        {/* Mark All Read */}
        {notifications.filter(n => !n.isRead).length > 0 && (
          <button
            onClick={markAllAsRead}
            className="mt-3 text-xs text-[#FF8C00] hover:text-[#FF9D1A] sm:text-sm"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="px-3 pt-2 sm:px-4 md:px-6">
        {filteredNotifications.length > 0 ? (
          <div className="space-y-2">
            {filteredNotifications.map((notif) => {
              const Icon = notificationIcons[notif.type];
              const iconColor = notificationColors[notif.type];

              return (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full rounded-2xl border p-3 text-left transition-all hover:border-white/20 hover:bg-white/10 sm:p-4 ${
                    notif.isRead
                      ? 'border-white/5 bg-white/5'
                      : 'border-white/10 bg-white/10'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <ImageWithFallback
                        src={notif.user.avatar}
                        alt={notif.user.name}
                        className="h-10 w-10 rounded-full object-cover sm:h-12 sm:w-12"
                      />
                      <div className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-black bg-white ${iconColor}`}>
                        <Icon className="h-3 w-3" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white sm:text-base">
                        <span className="font-semibold">{notif.user.name}</span>{' '}
                        <span className="text-white/70">{notif.message}</span>
                      </p>
                      <p className="mt-1 text-xs text-white/50">{notif.time}</p>
                    </div>
                    {!notif.isRead && (
                      <div className="h-2 w-2 rounded-full bg-[#FF8C00]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center backdrop-blur-xl sm:rounded-3xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
              <Heart className="h-8 w-8 text-white/30" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-white">No notifications</h3>
            <p className="text-sm text-white/60">
              {filter === 'unread' ? 'You\'re all caught up!' : 'New notifications will appear here'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default NotificationsPageIntegrated;

