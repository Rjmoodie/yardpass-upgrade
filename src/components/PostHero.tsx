import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle } from 'lucide-react';

import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { OrganizerChip } from '@/components/OrganizerChip';
import { EventCTA } from '@/components/EventCTA';
import { AddToCalendar } from '@/components/AddToCalendar';
import { FollowButton } from '@/components/follow/FollowButton';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { routes } from '@/lib/routes';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';

import type { Event, EventPost } from '@/types/events';

type PostHeroProps = {
  post?: EventPost;
  event: Event;
  isActive: boolean;
  onOpenTickets: () => void;
  onPostClick: (postId: string) => void;
};

function toMuxOrDirect(url?: string) {
  if (!url) return undefined;
  if (url.startsWith('mux:')) {
    const playbackId = url.replace('mux:', '');
    return `https://stream.mux.com/${playbackId}.m3u8`;
  }
  return url;
}

export function PostHero({
  post,
  event,
  isActive,
  onOpenTickets,
}: PostHeroProps) {
  const navigate = useNavigate();
  const { requireAuth } = useAuthGuard();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);

  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);

  const isVideo = post?.mediaType === 'video';
  const mediaSrc = useMemo(() => toMuxOrDirect(post?.mediaUrl), [post?.mediaUrl]);

  // Init / teardown HLS
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo || !mediaSrc) return;

    setReady(false);
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    video.src = '';
    video.load();

    const isHls = mediaSrc.endsWith('.m3u8');
    const canPlayNative = video.canPlayType('application/vnd.apple.mpegurl') !== '';

    const boot = async () => {
      try {
        const Hls = (await import('hls.js')).default;
        if (isHls && !canPlayNative && Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hlsRef.current = hls;
          hls.loadSource(mediaSrc);
          hls.attachMedia(video);
          console.log('🎥 HLS setup for Mux video:', mediaSrc);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('✅ HLS manifest parsed successfully');
            setReady(true);
          });
          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('❌ HLS error:', event, data);
            setReady(true);
          });
        } else {
          console.log('🎥 Setting up native video playback:', mediaSrc);
          video.src = mediaSrc;
          video.onloadedmetadata = () => {
            console.log('✅ Native video metadata loaded');
            setReady(true);
          };
        }
      } catch (err) {
        console.error('❌ Video setup error:', err);
        video.src = mediaSrc;
        video.onloadedmetadata = () => setReady(true);
      }
    };

    boot();
    video.muted = true;
    video.playsInline = true;

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.pause();
    };
  }, [isVideo, mediaSrc]);

  // Autoplay only when active & ready
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo) return;

    if (isActive && ready) {
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isActive, ready, isVideo]);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    setMuted(next);
    v.muted = next;
    if (!next) v.play().catch(() => {});
  };

  const goToEvent = () => navigate(routes.event(event.id));
  const goToAuthor = () => {
    navigate(`${routes.event(event.id)}?tab=posts`);
  };

  // ---------- RENDER ----------
  // No post: clean fallback with the cover + CTA.
  if (!post) {
    return (
      <div className="absolute inset-0">
        <ImageWithFallback
          src={event.coverImage || DEFAULT_EVENT_COVER}
          alt={event.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <BottomPanel event={event} onOpenTickets={onOpenTickets} goToEvent={goToEvent} />
      </div>
    );
  }

  // VIDEO
  if (isVideo && mediaSrc) {
    return (
      <div className="absolute inset-0">
        {/* Click-through goes to event details */}
        <button
          onClick={goToEvent}
          aria-label={`Open ${event.title}`}
          className="absolute inset-0"
          style={{ cursor: 'pointer' }}
        />

        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          loop
          muted={muted}
          playsInline
          preload="metadata"
          disablePictureInPicture
          controls={false}
          controlsList="nodownload noplaybackrate nofullscreen"
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
        />

        {/* subtle gradients for readability */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/80 to-transparent" />

        {/* Header (engagement stats only for videos) - Mobile optimized */}
        <div className="absolute left-0 right-0 top-0 p-4 flex items-start justify-end text-white">
          <div className="flex items-center gap-2 text-xs opacity-90 bg-black/40 backdrop-blur-sm rounded-full px-2 py-1">
            <div className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              <span className="font-medium">{post.likes ?? 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              <span className="font-medium">{post.commentCount ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Bottom panel with CTAs */}
        <BottomPanel event={event} onOpenTickets={onOpenTickets} goToEvent={goToEvent} post={post} />

        {/* Unmute hint - Mobile optimized */}
        {muted && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className="absolute top-16 right-4 bg-black/70 text-white rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-sm border border-white/20 touch-manipulation"
          >
            🔊 Tap for sound
          </button>
        )}
      </div>
    );
  }

  // IMAGE
  return (
    <div className="absolute inset-0">
      <button
        onClick={goToEvent}
        aria-label={`Open ${event.title}`}
        className="absolute inset-0"
        style={{ cursor: 'pointer' }}
      />
      <ImageWithFallback
        src={post.thumbnailUrl || post.mediaUrl || event.coverImage || DEFAULT_EVENT_COVER}
        alt=""
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Minimal header for images - author info moved to bottom panel */}
      <div className="absolute left-0 right-0 top-0 p-4 text-white">
        <div className="flex justify-end">
          <div className="flex items-center gap-2 text-xs opacity-90 bg-black/40 backdrop-blur-sm rounded-full px-2 py-1">
            <div className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              <span className="font-medium">{post.likes ?? 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              <span className="font-medium">{post.commentCount ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      <BottomPanel event={event} onOpenTickets={onOpenTickets} goToEvent={goToEvent} post={post} />
    </div>
  );
}

/** Shared bottom panel – compact & consistent */
function BottomPanel({
  event,
  onOpenTickets,
  goToEvent,
  post,
}: {
  event: Event;
  onOpenTickets: () => void;
  goToEvent: () => void;
  post?: EventPost;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 p-2 text-white pointer-events-none">
      <div className="mx-auto max-w-sm rounded-xl bg-black/65 backdrop-blur-md border border-white/15 p-2.5 space-y-2 pointer-events-auto">
        {/* Post author and caption - More compact */}
        {post && (
          <div className="border-b border-white/15 pb-2 mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-xs">{post.authorName}</span>
              {post.authorBadge && post.authorBadge !== 'ATTENDEE' && (
                <span className="text-[9px] bg-primary px-1.5 py-0.5 rounded-full font-bold text-white shadow-sm">
                  {post.authorBadge}
                </span>
              )}
            </div>
            {post.content && (
              <p className="text-xs opacity-90 leading-snug line-clamp-2">
                {post.content}
              </p>
            )}
          </div>
        )}

        {/* Compact Event CTA */}
        <div className="space-y-1.5">
          <EventCTA
            eventTitle={event.title}
            startAtISO={event.startAtISO}
            attendeeCount={event.attendeeCount}
            minPrice={event.minPrice}
            remaining={event.remaining}
            onDetails={goToEvent}
            onGetTickets={onOpenTickets}
          />

          {/* Compact organizer and follow row */}
          <div className="flex items-center justify-between gap-2">
            {event.organizerId && event.organizer && (
              <OrganizerChip
                organizerId={event.organizerId}
                name={event.organizer}
                verified={!!event.organizerVerified}
              />
            )}
            {event.organizerId && (
              <FollowButton 
                targetType="organizer" 
                targetId={event.organizerId} 
              />
            )}
          </div>

          {/* Compact calendar button */}
          <AddToCalendar
            title={event.title}
            description={event.description}
            location={event.location}
            startISO={event.startAtISO}
            endISO={event.endAtISO}
          />
        </div>
      </div>
    </div>
  );
}