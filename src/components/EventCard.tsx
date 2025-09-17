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
      <div className="absolute inset-0 flex flex-col justify-end p-6 pb-24">
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
          <div className="flex gap-3 z-40 relative">
            <Button
              onClick={() => onOpenTickets(item.event_id)}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-semibold py-3 shadow-lg"
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
      <div className="absolute left-4 right-4 bottom-6 z-30">
        <div className="bg-black/80 backdrop-blur-md rounded-full px-4 py-3 flex items-center justify-between shadow-2xl border border-white/10">
          {/* Left side - Organizer */}
          <Link
            to={`/u/${item.event_organizer_id || 'organizer'}`}
            className="text-white font-bold hover:underline text-base flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {item.event_organizer || 'Organizer'}
          </Link>

          {/* Right side - Event */}
          <Link
            to={`/event/${item.event_id}`}
            className="text-white/90 hover:text-white font-medium text-base truncate ml-4"
            onClick={(e) => e.stopPropagation()}
          >
            {item.event_title}
          </Link>
        </div>
      </div>
    </div>
  );
}