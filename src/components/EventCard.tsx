import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin } from 'lucide-react';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import ActionRail from './ActionRail';
import type { FeedItem } from '@/hooks/useUnifiedFeed';

interface EventCardProps {
  item: Extract<FeedItem, { item_type: 'event' }>;
  onOpenTickets: (eventId: string) => void;
  onEventClick: (eventId: string) => void;
  onCreatePost?: () => void;
  onReport?: () => void;
}

export function EventCard({ item, onOpenTickets, onEventClick, onCreatePost, onReport }: EventCardProps) {
  const [imageError, setImageError] = useState(false);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBA';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return 'TBA';
    }
  };

  const imageUrl = imageError ? DEFAULT_EVENT_COVER : (item.event_cover_image || DEFAULT_EVENT_COVER);

  return (
    <div className="w-full h-screen relative overflow-hidden bg-black">
      {/* Background Image */}
      <img
        src={imageUrl}
        alt={item.event_title}
        className="absolute inset-0 w-full h-full object-cover"
        onError={() => setImageError(true)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* RIGHT ACTION RAIL (TikTok style) */}
      <ActionRail
        onCreatePost={onCreatePost}
        onReport={onReport}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-6">
        <div className="space-y-4">
          {/* Event Info */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white leading-tight">
              {item.event_title}
            </h1>

            <div className="flex flex-col gap-2 text-white/90">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">{formatDate(item.event_starts_at)}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{item.event_location}</span>
              </div>
            </div>

            {item.event_description && (
              <p className="text-white/80 text-sm leading-relaxed line-clamp-3">
                {item.event_description}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => onOpenTickets(item.event_id)}
              className="flex-1 bg-primary hover:bg-primary/90 text-white font-medium py-3"
            >
              Get Tickets
            </Button>
            <Button
              onClick={() => onEventClick(item.event_id)}
              variant="outline"
              className="px-6 bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              Details
            </Button>
          </div>
        </div>
      </div>

      {/* BOTTOM META BAR */}
      <div className="absolute left-3 right-3 bottom-4 z-20">
        <div className="bg-black/45 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2">
          <Link
            to={`/u/${item.event_organizer_id || 'organizer'}`}
            className="text-white font-semibold hover:underline truncate max-w-[40%]"
            onClick={(e) => e.stopPropagation()}
          >
            {item.event_organizer || 'Organizer'}
          </Link>

          <span className="mx-2 h-3 w-px bg-white/30" />

          <Link
            to={`/event/${item.event_id}`}
            className="text-xs text-white/90 hover:text-white underline-offset-2 hover:underline truncate max-w-[45%]"
            onClick={(e) => e.stopPropagation()}
          >
            {item.event_title}
          </Link>
        </div>
      </div>
    </div>
  );
}