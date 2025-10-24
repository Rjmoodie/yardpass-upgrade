import { Heart, MessageCircle, Ticket, MapPin, Calendar } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { useState } from "react";

interface EventCardProps {
  event: {
    id: string;
    title: string;
    coverImage: string;
    date: string;
    time: string;
    location: string;
    price: string;
    likes: number;
    comments: number;
  };
}

export function EventCard({ event }: EventCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(event.likes);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
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
          src={event.coverImage}
          alt={event.title}
          className="h-full w-full object-cover"
        />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Event info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h3 className="mb-3 text-white">{event.title}</h3>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white/70">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">{event.date} • {event.time}</span>
            </div>
            
            <div className="flex items-center gap-2 text-white/70">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">{event.location}</span>
            </div>
            
            <div className="mt-3 inline-block rounded-full bg-[#FF8C00] px-4 py-1.5">
              <span className="text-sm text-white">{event.price}</span>
            </div>
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
          <span className="text-sm text-white/80">{likeCount}</span>
        </button>

        <button className="flex items-center gap-2 rounded-full px-4 py-2 transition-all hover:scale-105 hover:bg-white/10 active:scale-95">
          <MessageCircle className="h-5 w-5 text-white" />
          <span className="text-sm text-white/80">{event.comments}</span>
        </button>

        <button className="flex items-center gap-2 rounded-full bg-[#FF8C00] px-5 py-2 transition-all hover:scale-105 hover:bg-[#FF8C00]/90 active:scale-95">
          <Ticket className="h-5 w-5 text-white" />
          <span className="text-sm text-white">Tickets</span>
        </button>
      </div>
    </div>
  );
}
