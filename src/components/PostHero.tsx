// src/components/PostHero.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Event, EventPost } from '@/types/events';
import { useNavigate } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { OrganizerChip } from '@/components/OrganizerChip';
import { AddToCalendar } from '@/components/AddToCalendar';
import { EventCTA } from '@/components/EventCTA';
import { FollowButton } from '@/components/follow/FollowButton';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import { Heart, MessageCircle, Play, Image as ImageIcon } from 'lucide-react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { muxToHls, isLikelyVideo } from '@/utils/media';
import { useHlsVideo } from '@/hooks/useHlsVideo';
import { extractMuxPlaybackId } from '@/utils/mux';

export function PostHero({
  post,
  event,
  onOpenTickets,
  isActive,
  onPostClick,
}: {
  post?: EventPost;
  event: Event;
  onOpenTickets: () => void;
  isActive: boolean;
  onPostClick: (postId: string, post?: EventPost) => void;
}) {
  const navigate = useNavigate();
  const { requireAuth } = useAuthGuard();
  const [muted, setMuted] = useState(true);

  const src = useMemo(() => (post?.mediaUrl ? muxToHls(post.mediaUrl) : undefined), [post?.mediaUrl]);

  // video only
  const { videoRef, ready } = useHlsVideo(post?.mediaType === 'video' ? src : undefined);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || post?.mediaType !== 'video') return;
    v.muted = true;
    v.playsInline = true;

    if (isActive && ready) {
      v.play().catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [isActive, ready, post?.mediaType, videoRef]);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    setMuted(next);
    v.muted = next;
    if (!next) v.play().catch(() => {});
  };

  const goToAuthorOrPosts = () => {
    if (post?.authorId) navigate(routes.user(post.authorId));
    else navigate(`${routes.event(event.id)}?tab=posts`);
  };

  const goToOrganizer = () => {
    if (event.organizerId) navigate(routes.org(event.organizerId));
    else navigate(`${routes.event(event.id)}?tab=details`);
  };

  if (!post) return null;

  // --- VIDEO ---
  if (post.mediaType === 'video' && src) {
    return (
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          loop
          muted={muted}
          playsInline
          preload="metadata"
          controls={false}
          disablePictureInPicture
          controlsList="nodownload noplaybackrate nofullscreen"
          onClick={toggleMute}
          aria-label="Event post video"
        />

        {/* Footer overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent">
          <div className="p-4 text-white">
            <div className="pointer-events-auto">
              <div className="text-sm font-semibold">
                <button
                  onClick={(e) => { e.stopPropagation(); goToAuthorOrPosts(); }}
                  className="hover:text-primary transition-colors cursor-pointer underline"
                  title="View profile"
                >
                  {post.authorName}
                </button>
                {post.isOrganizer && (
                  <span className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded align-middle">
                    ORGANIZER
                  </span>
                )}
              </div>
              {post.content && <div className="text-sm opacity-90 line-clamp-2">{post.content}</div>}
            </div>

            {/* CTA + organizer + calendar */}
            <div className="pointer-events-auto mt-3 space-y-2">
              <EventCTA
                eventTitle={event.title}
                startAtISO={event.startAtISO}
                attendeeCount={event.attendeeCount}
                minPrice={event.minPrice}
                remaining={event.remaining}
                onDetails={() => navigate(routes.event(event.id))}
                onGetTickets={() => requireAuth(onOpenTickets, 'Please sign in to purchase tickets')}
              />

              <div className="flex items-center justify-between">
                {!!event.organizerId && !!event.organizer && (
                  <OrganizerChip
                    organizerId={event.organizerId}
                    name={event.organizer}
                    verified={!!event.organizerVerified}
                  />
                )}
                {!!event.organizerId && <FollowButton targetType="organizer" targetId={event.organizerId} />}
              </div>

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

        {muted && (
          <button
            onClick={toggleMute}
            className="absolute top-16 right-4 bg-black/60 text-white rounded-full px-3 py-1 text-xs"
            aria-label="Unmute video"
          >
            Tap for sound
          </button>
        )}
      </div>
    );
  }

  // --- IMAGE ---
  return (
    <div className="absolute inset-0">
      <ImageWithFallback
        src={post.mediaUrl || post.thumbnailUrl || DEFAULT_EVENT_COVER}
        alt=""
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />

      <div className="absolute inset-x-0 bottom-0 p-4 text-white pointer-events-auto">
        <div className="text-sm font-semibold">
          <button
            onClick={(e) => { e.stopPropagation(); goToAuthorOrPosts(); }}
            className="hover:text-primary transition-colors cursor-pointer underline"
            title="View profile"
          >
            {post.authorName}
          </button>
          {post.isOrganizer && (
            <span className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded align-middle">
              ORGANIZER
            </span>
          )}
        </div>
        {post.content && <div className="text-sm opacity-90 line-clamp-2">{post.content}</div>}

        {event.organizer && event.organizerId && (
          <button
            onClick={(e) => { e.stopPropagation(); goToOrganizer(); }}
            className="mt-2 text-[11px] text-gray-200 underline hover:text-white"
            title="View organizer"
          >
            by {event.organizer}
          </button>
        )}
      </div>
    </div>
  );
}