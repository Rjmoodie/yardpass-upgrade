import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { updateMetaTags, defaultMeta } from '@/utils/meta';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { EventTicketModal } from '@/components/EventTicketModal';
import { AttendeeListModal } from '@/components/AttendeeListModal';
import { Heart, MessageCircle, Share, MoreVertical, MapPin, Calendar, Crown, Users, Plus } from 'lucide-react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { toast } from '@/hooks/use-toast';
import { PostCreatorModal } from '@/components/PostCreatorModal';
import { useNavigate } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { capture } from '@/lib/analytics';
import { useShare } from '@/hooks/useShare';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import { Event } from '@/types/events';
import { format } from 'date-fns';

interface IndexProps {
  onEventSelect: (event: Event) => void;
  onCreatePost: () => void;
}

// Mock fallback
const mockEvents: Event[] = [
  {
    id: '1',
    title: 'Summer Music Festival 2025',
    description: 'Three days of incredible music with top artists. Food, art, and unforgettable experiences!',
    organizer: 'LiveNation Events',
    organizerId: '101',
    category: 'Music',
    startAtISO: '2025-07-15T18:00:00Z',
    dateLabel: 'July 15-17, 2025',
    location: 'Central Park, NYC',
    coverImage: DEFAULT_EVENT_COVER,
    ticketTiers: [
      { id: '1', name: 'GA', price: 89, badge: 'GA', available: 45, total: 1000 },
      { id: '2', name: 'VIP', price: 199, badge: 'VIP', available: 12, total: 100 }
    ],
    attendeeCount: 1243,
    likes: 892,
    shares: 156,
    isLiked: false,
    posts: []
  },
  {
    id: '2',
    title: 'Street Food Fiesta',
    description: 'Taste authentic flavors from around the world. Over 50 vendors, live demos, and family fun.',
    organizer: 'Foodie Adventures',
    organizerId: '102',
    category: 'Food & Drink',
    startAtISO: '2025-08-08T18:00:00Z',
    dateLabel: 'August 8, 2025',
    location: 'Brooklyn Bridge Park',
    coverImage: DEFAULT_EVENT_COVER,
    ticketTiers: [],
    attendeeCount: 567,
    likes: 445,
    shares: 89,
    isLiked: true,
    posts: []
  }
];

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
          setEvents(mockEvents);
        }
      } catch (e) {
        console.error('load error', e);
        setEvents(mockEvents);
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
    <div className="h-screen relative overflow-hidden bg-black">
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
      <EventTicketModal
        event={
          current
            ? {
                id: current.id,
                title: current.title,
                start_at: current.startAtISO,
                venue: current.location,
                address: current.location,
                description: current.description,
              }
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
    <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/50 to-transparent p-4">
      <div className="flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎪</span>
          <span>YardPass</span>
        </div>
          <Button
          size="lg"
          variant="glass"
          onClick={() => requireAuth(onCreatePost, 'Sign in to create')}
          className="bg-white/20 text-white border-white/30 hover:bg-white/30 min-h-[44px] px-4 font-semibold backdrop-blur-md shadow-lg"
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
      className="h-full w-full relative transition-transform duration-300 ease-out"
        style={{ transform: `translateY(-${currentIndex * 100}%)` }}
      >
      {events.map((e: Event, i: number) => (
        <div key={e.id} className="h-full w-full absolute" style={{ top: `${i * 100}%` }}>
          <ImageWithFallback src={e.coverImage} alt={e.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
          </div>
        ))}
      </div>
  );
}

function EventOverlay({ event, onEventSelect, onLike, onShare, onScroll, setShowTicketModal, setShowAttendeeModal, setPostCreatorOpen }: any) {
  const { requireAuth } = useAuthGuard();
  const navigate = useNavigate();
  const [showFullDescription, setShowFullDescription] = useState(false);
  return (
    <div className="absolute bottom-20 left-0 right-0 p-4 text-white">
      <div className="flex justify-between items-end">
        <div className="flex-1 mr-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="secondary"
              className="bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
              onClick={() => capture('feed_click', { target: 'category', event_id: event.id, category: event.category })}
            >
              {event.category}
            </Badge>
            <Badge
              variant="outline"
              className="border-white/30 text-white cursor-pointer hover:bg-white/10"
                onClick={() => {
                capture('feed_click', { target: 'attending', event_id: event.id });
                setShowAttendeeModal(true);
              }}
            >
              {event.attendeeCount} attending
            </Badge>
          </div>
          
          {/* Show ticket tiers if available */}
          {event.ticketTiers?.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {event.ticketTiers.map((tier: any) => (
                <Button
                  key={tier.id}
                  size="sm"
                  variant="secondary"
                  className="rounded-full bg-white/15 hover:bg-white/25 backdrop-blur border-white/30"
                  onClick={() => requireAuth(() => {
                    capture('feed_click', { target: 'ticket_tier', event_id: event.id, tier: tier.name });
                    setShowTicketModal(true);
                  }, 'Sign in to view tickets')}
                >
                  {tier.badge && <span className="mr-2 px-1.5 py-0.5 text-[10px] rounded bg-black/40">{tier.badge}</span>}
                  {tier.name} · ${tier.price}
                </Button>
              ))}
            </div>
          )}
          
          <h2
            onClick={() => {
              capture('feed_click', { target: 'title', event_id: event.id });
              navigate(routes.event(event.id));
            }}
            className="text-2xl font-bold mb-2 max-w-xs cursor-pointer hover:text-primary-foreground/90"
          >
            {event.title}
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
            <Avatar className="w-6 h-6">
              <AvatarFallback className="text-xs bg-white/20 text-white">{event.organizer.charAt(0)}</AvatarFallback>
              </Avatar>
              <button 
              onClick={() => {
                capture('feed_click', { target: 'handle', event_id: event.id });
                navigate(routes.user(event.organizerId));
              }}
              className="cursor-pointer hover:text-white"
              >
              @{event.organizer.replaceAll(' ', '').toLowerCase()}
              </button>
            <Badge variant="secondary" className="text-xs">
              <Crown className="w-3 h-3 mr-1" />
              ORGANIZER
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-300 mb-3">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {event.dateLabel}
            </div>
            <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
              {event.location}
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {event.attendeeCount}
            </div>
          </div>
          <div className="max-w-xs">
            <p className={`text-sm text-gray-300 ${showFullDescription ? '' : 'line-clamp-2'}`}>
              {event.description}
            </p>
            {event.description && event.description.length > 100 && (
              <button
                onClick={() => setShowFullDescription(!showFullDescription)}
                className="text-xs text-primary-foreground/80 hover:text-primary-foreground mt-1 transition-colors"
              >
                {showFullDescription ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
          <div className="flex gap-3">
              <Button 
                size="lg" 
                variant="premium"
              onClick={() =>
                requireAuth(() => {
                  capture('feed_click', { target: 'tickets', event_id: event.id });
                  setShowTicketModal(true);
                }, 'Sign in to buy tickets')
              }
              className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-[48px] px-6 font-bold shadow-lg"
              >
                Get Tickets
              </Button>
              <Button 
                size="lg" 
                variant="glass"
              onClick={() => {
                capture('feed_click', { target: 'details', event_id: event.id });
                navigate(routes.event(event.id));
              }}
              className="border-white/30 text-white bg-white/10 hover:bg-white/20 min-h-[48px] px-6 font-semibold backdrop-blur-md"
              >
                Details
              </Button>
            </div>
          </div>
        <div className="flex flex-col items-center gap-4 text-white relative z-20">
          <ActionButton
            icon={<Heart className={event.isLiked ? 'fill-white text-white' : 'text-white'} />}
            label={event.likes}
            active={event.isLiked}
            onClick={() => onLike(event.id)}
          />
          <ActionButton
            icon={<MessageCircle className="text-white" />}
            label={event.posts?.length || 0}
              onClick={() => {
              capture('feed_click', { target: 'comment', event_id: event.id });
              navigate(routes.event(event.id));
            }}
          />
          <ActionButton
            icon={<Plus className="text-white" />}
            label="Post"
            onClick={() =>
              requireAuth(() => {
                capture('feed_click', { target: 'post', event_id: event.id });
                setPostCreatorOpen(true);
              }, 'Sign in to post')
            }
          />
          <ActionButton
            icon={<Share className="text-white" />}
            label={event.shares}
            onClick={() => onShare(event)}
          />
          <ActionButton
            icon={<MoreVertical className="text-white" />}
            onClick={() => toast({ title: 'More options', description: 'Coming soon...' })}
          />
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, active }: any) {
  return (
          <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 transition-transform active:scale-95 min-h-[56px] min-w-[56px] p-2"
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
      style={{ pointerEvents: 'auto', touchAction: 'pan-y', clipPath: 'polygon(0% 15%, 80% 15%, 80% 100%, 0% 100%)' }}
        onTouchStart={(e) => {
        e.currentTarget.dataset.startY = e.touches[0].clientY.toString();
        }}
        onTouchEnd={(e) => {
        const startY = parseInt(e.currentTarget.dataset.startY || '0', 10);
          const endY = e.changedTouches[0].clientY;
          const diff = startY - endY;
          if (Math.abs(diff) > 50) {
          handleScroll(diff > 0 ? 'down' : 'up');
          }
        }}
      />
  );
}

function LoadingState() {
  return (
    <div className="h-screen bg-black flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p>Loading events...</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center text-white text-center p-8">
      <div>
        <div className="text-6xl mb-4">🎪</div>
        <h2 className="text-2xl font-bold mb-2">No Events Yet</h2>
        <p className="text-gray-300 mb-6">Be the first to create an amazing event!</p>
        <Button className="bg-white text-black hover:bg-gray-100">Create Event</Button>
      </div>
    </div>
  );
}