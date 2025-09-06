import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Ticket } from "lucide-react";

interface ShareVideoSnippetProps {
  playbackId: string;
  poster?: string;
  event: {
    title: string;
    start_at: string;
    venue?: string;
    city?: string;
  };
  onTicketClick?: () => void;
}

export default function ShareVideoSnippet({ 
  playbackId, 
  poster, 
  event, 
  onTicketClick 
}: ShareVideoSnippetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const hlsSrc = `https://stream.mux.com/${playbackId}.m3u8`;
    
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari can play HLS natively
      video.src = hlsSrc;
    } else {
      // Other browsers need hls.js
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(hlsSrc);
          hls.attachMedia(video);
        }
      });
    }
  }, [playbackId]);

  const eventDate = new Date(event.start_at);
  const location = [event.venue, event.city].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] space-y-6">
        {/* Video Player */}
        <div className="relative rounded-2xl overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            loop
            poster={poster}
            className="w-full h-auto"
            style={{ aspectRatio: '9 / 16' }}
          />
          
          {/* Gradient overlay for content */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          
          {/* Event info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <h1 className="text-2xl font-bold mb-3 leading-tight">
              {event.title}
            </h1>
            
            <div className="space-y-2 text-sm opacity-90">
              <div className="flex items-center gap-2">
                <Calendar size={16} />
                <span>
                  {eventDate.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short', 
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              
              {location && (
                <div className="flex items-center gap-2">
                  <MapPin size={16} />
                  <span>{location}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">
            Join us for an amazing experience
          </p>
          
          <Button 
            onClick={onTicketClick}
            size="lg"
            className="w-full"
          >
            <Ticket className="mr-2" size={20} />
            Get Tickets
          </Button>
        </div>
      </div>
    </div>
  );
}
