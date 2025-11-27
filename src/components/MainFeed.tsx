import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { updateMetaTags, defaultMeta } from '@/utils/meta';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import EventCheckoutSheet from '@/components/EventCheckoutSheet';
import { AttendeeListModal } from '@/components/AttendeeListModal';
import { Heart, MessageCircle, Share, MoreVertical, MapPin, Calendar, Crown, Users, Plus } from 'lucide-react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { toast } from '@/hooks/use-toast';
import { PostCreatorModal } from '@/features/posts';
import { useNavigate } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { capture } from '@/lib/analytics';
import { useShare } from '@/hooks/useShare';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import { Event } from '@/types/events';
import { format } from 'date-fns';
import { FullScreenLoading } from '@/components/layout/FullScreenLoading';
import { FullScreenSafeArea } from '@/components/layout/FullScreenSafeArea';

interface IndexProps {
  onEventSelect: (event: Event) => void;
  onCreatePost: () => void;
}


const Index = ({ onEventSelect, onCreatePost }: IndexProps) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { withAuth, requireAuth } = useAuthGuard();
  const navigate = useNavigate();
  const { shareEvent } = useShare();

  // Load events
  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select(`id,title,description,start_at,end_at,venue,city,category,cover_image_url,visibility,
                   user_profiles!events_created_by_fkey ( display_name )`)
          .eq('visibility', 'public')
          .order('start_at', { ascending: true })
          .limit(20);
        if (error) throw error;
        if (data && data.length) {
          setEvents(
            data.map((e) => ({
              id: e.id,
              title: e.title,
              description: e.description || '',
              organizer: (e as any).user_profiles?.display_name || 'Organizer',
              organizerId: e.id,
              category: e.category || 'Event',
              startAtISO: e.start_at,
              dateLabel: format(new Date(e.start_at), 'MMM dd, yyyy'),
              venue: e.venue || '',
              location: `${e.venue || ''}, ${e.city || ''}`.replace(/^,\s*/, ''),
              coverImage: e.cover_image_url || DEFAULT_EVENT_COVER,
              ticketTiers: [],
              attendeeCount: Math.floor(Math.random() * 1000) + 50,
              likes: Math.floor(Math.random() * 500) + 10,
              shares: Math.floor(Math.random() * 100) + 5,
              isLiked: false,
              posts: [],
            }))
          );
        } else {
          setEvents([]);
        }
      } catch (e) {
        console.error('load error', e);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const current = events[currentIndex];

  const handleLike = withAuth(
    (id: string) => {
      capture('feed_click', { target: 'like', event_id: id });
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === id ? { ...ev, isLiked: !ev.isLiked, likes: ev.isLiked ? ev.likes - 1 : ev.likes + 1 } : ev
        )
      );
    },
    'Sign in to like'
  );

  const handleShare = (e: Event) => {
    capture('share_click', { event_id: e.id });
    shareEvent(e.id, e.title);
  };

  const handleScroll = (dir: 'up' | 'down') => {
    if (dir === 'down' && currentIndex < events.length - 1) setCurrentIndex((i) => i + 1);
    if (dir === 'up' && currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  // meta
  useEffect(() => {
    updateMetaTags(defaultMeta);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') handleScroll('up');
      if (e.key === 'ArrowDown') handleScroll('down');
      if (e.key === 'PageUp') handleScroll('up');
      if (e.key === 'PageDown') handleScroll('down');
      if (e.key === 'Home') setCurrentIndex(0);
      if (e.key === 'End') setCurrentIndex(events.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, events.length]);

  if (loading) return <LoadingState />;
  if (!current) return <EmptyState />;

  return (
    <div 
      className="relative overflow-hidden bg-black"
      style={{ 
        height: '100dvh',
        minHeight: '-webkit-fill-available', // iOS Safari fallback
        scrollSnapType: 'y mandatory',
        overscrollBehavior: 'none',
        WebkitOverflowScrolling: 'touch',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <Header onCreatePost={() => setPostCreatorOpen(true)} />
      <MediaContainer events={events} currentIndex={currentIndex} scrollRef={scrollRef} />
      <EventOverlay
        event={current}
        onEventSelect={onEventSelect}
        onLike={handleLike}
        onShare={handleShare}
        onScroll={handleScroll}
        setShowTicketModal={setShowTicketModal}
        setShowAttendeeModal={setShowAttendeeModal}
        setPostCreatorOpen={setPostCreatorOpen}
      />
      <ScrollDots events={events} currentIndex={currentIndex} setCurrentIndex={setCurrentIndex} />
      <SwipeArea handleScroll={handleScroll} />
      <AttendeeListModal
        isOpen={showAttendeeModal}
        onClose={() => setShowAttendeeModal(false)}
        eventTitle={current.title}
        attendeeCount={current.attendeeCount}
        attendees={[]}
      />
      <EventCheckoutSheet
        event={
          current
            ? (() => {
                const eventData = {
                  id: current.id,
                  title: current.title,
                  start_at: current.startAtISO || current.start_at,
                  startAtISO: current.startAtISO,
                  venue: current.venue,
                  address: current.location,
                  description: current.description,
                };
                console.log('🎫 [MainFeed] Passing event to modal:', {
                  currentEvent: current,
                  eventData,
                  start_at: current.start_at,
                  startAtISO: current.startAtISO,
                });
                return eventData;
              })()
            : null
        }
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        onSuccess={() => {
          setShowTicketModal(false);
          toast({ title: 'Success!', description: 'Redirecting to checkout...' });
        }}
      />
      <PostCreatorModal
        isOpen={postCreatorOpen}
        onClose={() => setPostCreatorOpen(false)}
        preselectedEventId={current?.id}
        onSuccess={() => toast({ title: 'Posted', description: 'Your post has been created!' })}
      />
          </div>
  );
};

export default Index;

// ————————————————————————————————
// Components
// ————————————————————————————————

function Header({ onCreatePost }: { onCreatePost: () => void }) {
  const { requireAuth } = useAuthGuard();
  return (
    <div 
      className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/50 to-transparent"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px) + 1rem)',
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px) + 1rem)',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px) + 1rem)',
        paddingBottom: '1rem'
      }}
    >
      <div className="flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎪</span>
          <span>Liventix</span>
        </div>
          <Button
          size="lg"
          variant="glass"
          onClick={() => requireAuth(onCreatePost, 'Sign in to create')}
          className="bg-white/20 text-white border-white/30 hover:bg-white/30 min-h-[40px] sm:min-h-[44px] px-3 sm:px-4 text-xs sm:text-sm font-semibold backdrop-blur-md shadow-lg"
        >
          + Create Event
          </Button>
        </div>
      </div>
  );
}

function MediaContainer({ events, currentIndex, scrollRef }: any) {
  return (
      <div 
        ref={scrollRef}
        className="h-full w-full relative will-change-transform"
        style={{ 
          transform: `translateY(-${currentIndex * 100}%)`,
          transition: `transform 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
          scrollSnapAlign: 'start'
        }}
      >
      {events.map((e: Event, i: number) => (
        <div 
          key={e.id} 
          className="h-full w-full absolute" 
          style={{ 
            top: `${i * 100}%`,
            scrollSnapAlign: 'start'
          }}
        >
          <ImageWithFallback src={e.coverImage} alt={e.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
          </div>
        ))}
      </div>
  );
}

import { FeedCaption } from "@/components/feed/FeedCaption";
import { FeedActionRail } from "@/components/feed/FeedActionRail";

function EventOverlay(props: any) {
  const { event, onLike, onShare, setShowTicketModal, setShowAttendeeModal, setPostCreatorOpen } = props;
  const { requireAuth } = useAuthGuard();
  const navigate = useNavigate();

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="pointer-events-auto">
        <FeedActionRail
        items={[
          { icon: <Heart className={event.isLiked ? "fill-white text-white" : "text-white"} />, label: event.likes, active: event.isLiked, onClick: () => onLike(event.id) },
          { icon: <MessageCircle className="text-white" />, label: event.posts?.length || 0, onClick: () => {
              capture('feed_click', { target: 'comment', event_id: event.id });
              navigate(routes.event(event.id));
          }},
          { icon: <Plus className="text-white" />, label: "Post", onClick: () => requireAuth(() => {
                capture('feed_click', { target: 'post', event_id: event.id });
                setPostCreatorOpen(true);
          }, "Sign in to post") },
          { icon: <Share className="text-white" />, label: event.shares, onClick: () => onShare(event) },
          { icon: <MoreVertical className="text-white" />, onClick: () => toast({ title: 'More options', description: 'Coming soon...' }) },
        ]}
          />
        </div>

      <FeedCaption
        event={event}
        onOpenTickets={() => setShowTicketModal(true)}
        onOpenAttendees={() => setShowAttendeeModal(true)}
        isExpandable={Boolean(event.ticketTiers?.length && event.ticketTiers.length > 0)}
      />
    </div>
  );
}

function ActionButton({ icon, label, onClick, active }: any) {
  return (
          <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 transition-transform active:scale-95 min-h-[48px] min-w-[48px] p-2 touch-manipulation"
    >
      <div
        className={`p-3 rounded-full transition-all ${
          active ? 'bg-red-500 shadow-lg shadow-red-500/30 scale-110' : 'bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-white/20'
        }`}
      >
        {icon}
      </div>
      {label !== undefined && <span className="text-xs font-medium text-white drop-shadow-lg">{label}</span>}
    </button>
  );
}

function ScrollDots({ events, currentIndex, setCurrentIndex }: any) {
  return (
    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
      {events.map((_: any, i: number) => (
        <button
          key={i}
          onClick={() => setCurrentIndex(i)}
          className={`w-1 h-8 rounded-full transition-colors ${i === currentIndex ? 'bg-white' : 'bg-white/30'}`}
          />
        ))}
      </div>
  );
}

function SwipeArea({ handleScroll }: { handleScroll: (dir: 'up' | 'down') => void }) {
  return (
      <div 
        className="absolute inset-0 z-10"
        style={{ 
          pointerEvents: 'auto', 
          touchAction: 'pan-y',
          clipPath: 'polygon(0% 15%, 75% 15%, 75% 100%, 0% 100%)',
          overscrollBehavior: 'none'
        }}
        onTouchStart={(e) => {
          e.currentTarget.dataset.startY = e.touches[0].clientY.toString();
        }}
        onTouchEnd={(e) => {
          const startY = parseInt(e.currentTarget.dataset.startY || '0', 10);
          const endY = e.changedTouches[0].clientY;
          const diff = startY - endY;
          if (Math.abs(diff) > 60) {
            handleScroll(diff > 0 ? 'down' : 'up');
          }
        }}
      />
  );
}

function LoadingState() {
  return <FullScreenLoading text="Loading events..." className="bg-black" />;
}

function EmptyState() {
  return (
    <FullScreenSafeArea className="bg-gradient-to-br from-purple-900 to-blue-900 items-center justify-center text-white text-center p-8">
      <div>
        <div className="text-6xl mb-4">🎪</div>
        <h2 className="text-2xl font-bold mb-2">No Events Yet</h2>
        <p className="text-gray-300 mb-6">Be the first to create an amazing event!</p>
        <Button className="bg-white text-black hover:bg-gray-100">Create Event</Button>
      </div>
    </FullScreenSafeArea>
  );
}