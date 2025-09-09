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
          hls.on(Hls.Events.MANIFEST_PARSED, () => setReady(true));
          hls.on(Hls.Events.ERROR, () => setReady(true));
        } else {
          video.src = mediaSrc;
          video.onloadedmetadata = () => setReady(true);
        }
      } catch {
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

        {/* Header (author + tiny stats) */}
        <div className="absolute left-0 right-0 top-0 p-4 flex items-center justify-between text-white">
          <div className="pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToAuthor();
              }}
              className="text-sm font-semibold underline hover:text-primary transition-colors"
              title="View posts"
            >
              {post.authorName}
            </button>
            {post.isOrganizer && (
              <span className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded align-middle">ORGANIZER</span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs opacity-90">
            <div className="flex items-center gap-1">
              <Heart className="w-3.5 h-3.5" />
              {post.likes ?? 0}
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" />
              {post.commentCount ?? 0}
            </div>
          </div>
        </div>

        {/* Bottom panel with CTAs */}
        <BottomPanel event={event} onOpenTickets={onOpenTickets} goToEvent={goToEvent} />

        {/* Unmute hint */}
        {muted && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className="absolute top-16 right-4 bg-black/60 text-white rounded-full px-3 py-1 text-xs"
          >
            Tap for sound
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

      {/* Author & text */}
      <div className="absolute left-0 right-0 top-0 p-4 text-white">
        <div className="pointer-events-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToAuthor();
            }}
            className="text-sm font-semibold underline hover:text-primary transition-colors"
            title="View posts"
          >
            {post.authorName}
          </button>
          {post.isOrganizer && (
            <span className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded align-middle">ORGANIZER</span>
          )}
        </div>

        {post.content && (
          <div className="mt-1 text-sm opacity-90 line-clamp-2 max-w-[85%]">{post.content}</div>
        )}
      </div>

      <BottomPanel event={event} onOpenTickets={onOpenTickets} goToEvent={goToEvent} />
    </div>
  );
}

/** Shared bottom panel – compact & consistent */
function BottomPanel({
  event,
  onOpenTickets,
  goToEvent,
}: {
  event: Event;
  onOpenTickets: () => void;
  goToEvent: () => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 p-4 text-white pointer-events-none">
      <div className="mx-auto max-w-md md:max-w-lg rounded-2xl bg-black/55 backdrop-blur-md border border-white/10 p-3 space-y-2 pointer-events-auto">
        <EventCTA
          eventTitle={event.title}
          startAtISO={event.startAtISO}
          attendeeCount={event.attendeeCount}
          minPrice={event.minPrice}
          remaining={event.remaining}
          onDetails={goToEvent}
          onGetTickets={onOpenTickets}
        />

        <div className="flex items-center justify-between">
          {event.organizerId && event.organizer && (
            <OrganizerChip
              organizerId={event.organizerId}
              name={event.organizer}
              verified={!!event.organizerVerified}
            />
          )}
          {event.organizerId && <FollowButton targetType="organizer" targetId={event.organizerId} />}
        </div>

        <div className="mt-1">
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