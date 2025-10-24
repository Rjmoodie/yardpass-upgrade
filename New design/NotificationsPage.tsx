import { Heart, MessageCircle, UserPlus, Ticket, Calendar, TrendingUp, Bell } from "lucide-react";
import { useState } from "react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'ticket' | 'event' | 'trending';
  user?: {
    name: string;
    avatar: string;
  };
  message: string;
  timestamp: string;
  read: boolean;
  image?: string;
  action?: string;
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "like",
    user: {
      name: "Sarah Martinez",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200"
    },
    message: "liked your post",
    timestamp: "2m ago",
    read: false,
    image: "https://images.unsplash.com/photo-1656283384093-1e227e621fad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200"
  },
  {
    id: "2",
    type: "comment",
    user: {
      name: "Mike Chen",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200"
    },
    message: "commented: \"This looks amazing! Can't wait!\"",
    timestamp: "15m ago",
    read: false,
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200"
  },
  {
    id: "3",
    type: "follow",
    user: {
      name: "Emily Johnson",
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200"
    },
    message: "started following you",
    timestamp: "1h ago",
    read: true
  },
  {
    id: "4",
    type: "ticket",
    message: "Your ticket for Summer Music Festival is confirmed",
    timestamp: "2h ago",
    read: true,
    image: "https://images.unsplash.com/photo-1656283384093-1e227e621fad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200",
    action: "View Ticket"
  },
  {
    id: "5",
    type: "event",
    message: "Tech Conference 2025 is happening in 3 days",
    timestamp: "5h ago",
    read: true,
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200",
    action: "View Event"
  },
  {
    id: "6",
    type: "trending",
    message: "Jazz Night Live is trending in your area",
    timestamp: "1d ago",
    read: true,
    image: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200"
  },
  {
    id: "7",
    type: "like",
    user: {
      name: "David Park",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200"
    },
    message: "and 12 others liked your post",
    timestamp: "2d ago",
    read: true,
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200"
  }
];

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'like':
      return <Heart className="h-4 w-4 text-red-500 sm:h-5 sm:w-5" />;
    case 'comment':
      return <MessageCircle className="h-4 w-4 text-blue-500 sm:h-5 sm:w-5" />;
    case 'follow':
      return <UserPlus className="h-4 w-4 text-purple-500 sm:h-5 sm:w-5" />;
    case 'ticket':
      return <Ticket className="h-4 w-4 text-[#FF8C00] sm:h-5 sm:w-5" />;
    case 'event':
      return <Calendar className="h-4 w-4 text-green-500 sm:h-5 sm:w-5" />;
    case 'trending':
      return <TrendingUp className="h-4 w-4 text-yellow-500 sm:h-5 sm:w-5" />;
  }
};

export function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState(mockNotifications);

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="min-h-screen bg-black pb-20 pt-4 sm:pt-6">
      {/* Header */}
      <div className="mb-6 px-3 sm:px-4 md:px-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-white">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-white/60">
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="rounded-full bg-white/5 px-4 py-2 text-xs text-white transition-all hover:bg-white/10 sm:text-sm"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 rounded-full py-2.5 text-sm transition-all sm:py-3 sm:text-base ${
              filter === 'all'
                ? 'bg-[#FF8C00] text-white shadow-lg'
                : 'border border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 rounded-full py-2.5 text-sm transition-all sm:py-3 sm:text-base ${
              filter === 'unread'
                ? 'bg-[#FF8C00] text-white shadow-lg'
                : 'border border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-2 px-3 sm:px-4 md:px-6">
        {filteredNotifications.map((notification) => (
          <div
            key={notification.id}
            onClick={() => markAsRead(notification.id)}
            className={`flex gap-3 rounded-2xl border p-3 transition-all hover:border-white/20 sm:gap-4 sm:rounded-3xl sm:p-4 ${
              notification.read
                ? 'border-white/5 bg-white/5'
                : 'border-[#FF8C00]/30 bg-[#FF8C00]/10'
            }`}
          >
            {/* Icon/Avatar */}
            <div className="flex-shrink-0">
              {notification.user ? (
                <div className="relative">
                  <ImageWithFallback
                    src={notification.user.avatar}
                    alt={notification.user.name}
                    className="h-10 w-10 rounded-full object-cover sm:h-12 sm:w-12"
                  />
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-black bg-black sm:h-6 sm:w-6">
                    {getNotificationIcon(notification.type)}
                  </div>
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 sm:h-12 sm:w-12">
                  {getNotificationIcon(notification.type)}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-sm text-white sm:text-base">
                {notification.user && (
                  <span className="font-medium">{notification.user.name} </span>
                )}
                {notification.message}
              </p>
              <p className="text-xs text-white/50 sm:text-sm">{notification.timestamp}</p>
              
              {/* Action Button */}
              {notification.action && (
                <button className="mt-2 rounded-full bg-[#FF8C00] px-4 py-1.5 text-xs text-white transition-all hover:bg-[#FF9D1A] active:scale-95 sm:text-sm">
                  {notification.action}
                </button>
              )}
            </div>

            {/* Thumbnail */}
            {notification.image && (
              <div className="flex-shrink-0">
                <ImageWithFallback
                  src={notification.image}
                  alt="Notification"
                  className="h-12 w-12 rounded-lg object-cover sm:h-16 sm:w-16"
                />
              </div>
            )}

            {/* Unread Indicator */}
            {!notification.read && (
              <div className="flex-shrink-0">
                <div className="h-2 w-2 rounded-full bg-[#FF8C00]" />
              </div>
            )}
          </div>
        ))}

        {/* Empty State */}
        {filteredNotifications.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center backdrop-blur-xl sm:rounded-3xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
              <Bell className="h-8 w-8 text-white/30" />
            </div>
            <h3 className="mb-2 text-white">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
            </h3>
            <p className="text-sm text-white/60">
              {filter === 'unread' 
                ? "You're all caught up!"
                : "When you get notifications, they'll show up here"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
