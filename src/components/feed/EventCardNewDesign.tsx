import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Ticket, MapPin, Calendar } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import type { FeedItem } from "@/hooks/unifiedFeedTypes";
import { DEFAULT_EVENT_COVER } from "@/lib/constants";

interface EventCardNewDesignProps {
  item: Extract<FeedItem, { item_type: 'event' }>;
  onOpenTickets: (eventId: string) => void;
  onEventClick: (eventId: string) => void;
  onCreatePost?: () => void;
}

export function EventCardNewDesign({
  item,
  onOpenTickets,
  onEventClick,
  onCreatePost
}: EventCardNewDesignProps) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBA';
    const d = new Date(dateStr);
    try {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'TBA';
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return 'TBA';
    const d = new Date(dateStr);
    try {
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return 'TBA';
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[32px] border border-white/[0.12] bg-white/[0.05] shadow-[0_40px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
      {/* Inner glow */}
      <div className="absolute inset-0 -z-10 opacity-70" style={{
        background: 'radial-gradient(circle at top, rgba(255,255,255,0.16) 0%, transparent 55%)'
      }} />

      {/* Cover Image Container */}
      <div className="relative aspect-video w-full overflow-hidden rounded-t-[32px]">
        <ImageWithFallback
          src={item.event_cover_image || DEFAULT_EVENT_COVER}
          alt={item.event_title || 'Event'}
          className="h-full w-full object-cover"
        />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Event info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h3 className="mb-3 text-xl font-bold text-white sm:text-2xl">{item.event_title}</h3>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white/70">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">{formatDate(item.event_start_at)} • {formatTime(item.event_start_at)}</span>
            </div>
            
            <div className="flex items-center gap-2 text-white/70">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">{item.event_venue || 'Location TBA'}</span>
            </div>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onOpenTickets(item.event_id);
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#FF8C00] px-4 py-1.5 font-semibold transition-all hover:bg-[#FF9D1A] active:scale-95"
            >
              <Ticket className="h-4 w-4 text-white" />
              <span className="text-sm text-white">Get Tickets</span>
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-around border-t border-white/10 p-4">
        <button
          onClick={handleLike}
          className="flex items-center gap-2 rounded-full px-4 py-2 transition-all hover:scale-105 hover:bg-white/10 active:scale-95"
        >
          <Heart
            className={`h-5 w-5 transition-colors ${
              liked ? "fill-red-600 text-red-600" : "text-white"
            }`}
          />
          <span className="text-sm font-medium text-white/80">{likeCount}</span>
        </button>

        <button 
          onClick={() => onCreatePost?.()}
          className="flex items-center gap-2 rounded-full px-4 py-2 transition-all hover:scale-105 hover:bg-white/10 active:scale-95"
        >
          <MessageCircle className="h-5 w-5 text-white" />
          <span className="text-sm font-medium text-white/80">Post</span>
        </button>

        <button 
          onClick={() => onEventClick(item.event_id)}
          className="flex items-center gap-2 rounded-full bg-[#FF8C00]/20 px-5 py-2 transition-all hover:scale-105 hover:bg-[#FF8C00]/30 active:scale-95"
        >
          <span className="text-sm font-semibold text-[#FF8C00]">View Event</span>
        </button>
      </div>
    </div>
  );
}

