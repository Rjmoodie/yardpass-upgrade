import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Bell,
  Calendar,
  Heart,
  MessageCircle,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';

interface NotificationItem {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'ticket' | 'event' | 'trending';
  title: string;
  description: string;
  time: string;
  action?: string;
  unread?: boolean;
  image?: string;
}

const ICON_MAP: Record<NotificationItem['type'], ReactNode> = {
  like: <Heart className="h-4 w-4" />,
  comment: <MessageCircle className="h-4 w-4" />,
  follow: <Users className="h-4 w-4" />,
  ticket: <Ticket className="h-4 w-4" />,
  event: <Calendar className="h-4 w-4" />,
  trending: <TrendingUp className="h-4 w-4" />,
};

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    type: 'like',
    title: 'Sarah Martinez liked your post',
    description: '“Sunset sessions on the rooftop”',
    time: '2m ago',
    unread: true,
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200',
  },
  {
    id: '2',
    type: 'comment',
    title: 'Mike Chen left a comment',
    description: '“See you at the entrance around 6:30!”',
    time: '1h ago',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200',
  },
  {
    id: '3',
    type: 'ticket',
    title: 'Your VIP pass is ready',
    description: 'Download your QR code for Summer Music Festival',
    time: 'Yesterday',
    action: 'View Ticket',
  },
  {
    id: '4',
    type: 'event',
    title: 'New event near you',
    description: 'Tech Innovation Summit • San Francisco',
    time: '2d ago',
    action: 'View Event',
  },
  {
    id: '5',
    type: 'trending',
    title: 'Your post is trending',
    description: '“Pop-up dining in Brooklyn” is gaining momentum',
    time: '3d ago',
  },
  {
    id: '6',
    type: 'follow',
    title: 'Emily Johnson started following you',
    description: 'Check out her latest events',
    time: '1w ago',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200',
  },
];

export default function NotificationsPage() {
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');

  const filteredNotifications = NOTIFICATIONS.filter((notification) =>
    activeFilter === 'all' ? true : Boolean(notification.unread),
  );

  return (
    <div className="min-h-screen bg-black pb-20 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1171c0]/20">
              <Bell className="h-5 w-5 text-[#1171c0]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Notifications</h1>
              <p className="text-xs text-white/60">Stay up to date with what’s happening</p>
            </div>
          </div>

          <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white transition hover:bg-white/10">
            Mark all as read
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-4xl gap-2 px-4 pb-4">
          <button
            onClick={() => setActiveFilter('all')}
            className={`flex-1 rounded-full px-4 py-2 text-sm transition ${
              activeFilter === 'all' ? 'bg-[#1171c0] text-white shadow-lg' : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveFilter('unread')}
            className={`flex-1 rounded-full px-4 py-2 text-sm transition ${
              activeFilter === 'unread' ? 'bg-[#1171c0] text-white shadow-lg' : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            Unread
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 pt-4">
        {filteredNotifications.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-dashed border-white/20 bg-white/5 p-8 text-center text-white/60">
            <p>No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-3 pb-24">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-3 rounded-3xl border bg-white/5 p-4 backdrop-blur-xl transition hover:border-white/20 hover:shadow-xl ${
                  notification.unread ? 'border-white/20' : 'border-white/10'
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${getBadgeClass(notification.type)}`}>
                  {ICON_MAP[notification.type]}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-white">{notification.title}</p>
                      <p className="text-xs text-white/60">{notification.description}</p>
                    </div>
                    <span className="text-xs text-white/50">{notification.time}</span>
                  </div>

                  {notification.action && (
                    <button className="mt-3 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs text-white transition hover:bg-white/10">
                      {notification.action}
                    </button>
                  )}
                </div>

                {notification.image && (
                  <ImageWithFallback
                    src={notification.image}
                    alt="Notification"
                    className="h-12 w-12 rounded-full object-cover"
                  />
                )}

                {notification.unread && <span className="mt-1 h-3 w-3 rounded-full bg-[#1171c0]" />}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function getBadgeClass(type: NotificationItem['type']) {
  switch (type) {
    case 'like':
      return 'bg-red-500/20 text-red-400';
    case 'comment':
      return 'bg-blue-500/20 text-blue-400';
    case 'follow':
      return 'bg-purple-500/20 text-purple-300';
    case 'ticket':
      return 'bg-brand-500/20 text-brand-300';
    case 'event':
      return 'bg-green-500/20 text-green-300';
    case 'trending':
      return 'bg-yellow-500/20 text-yellow-300';
    default:
      return 'bg-white/10 text-white';
  }
}
