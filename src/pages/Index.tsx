import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { updateMetaTags, defaultMeta } from '@/utils/meta';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { EventTicketModal } from '@/components/EventTicketModal';
import { AttendeeListModal } from '@/components/AttendeeListModal';
import { Heart, MessageCircle, Share, MoreVertical, MapPin, Calendar, Crown, Users, Plus } from 'lucide-react';
import { ShareModal } from '@/components/ShareModal';
import { PostCreatorModal } from '@/components/PostCreatorModal';
import { CommentModal } from '@/components/CommentModal';
import { PaymentSuccessHelper } from '@/components/PaymentSuccessHelper';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { capture } from '@/lib/analytics';
import { useShare } from '@/hooks/useShare';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';

interface DatabaseTicketTier { id: string; name: string; price_cents: number; badge_label?: string; quantity: number; }
interface DatabaseEvent {
  id: string; title: string; description: string; organizer_id: string; category: string; start_at: string; city?: string; venue?: string; cover_image_url?: string;
  ticket_tiers?: DatabaseTicketTier[];
}

interface EventPost { id: string; authorName: string; authorBadge: string; isOrganizer?: boolean; content: string; timestamp: string; likes: number; }
interface TicketTier { id: string; name: string; price: number; badge: string; available: number; total: number; }
interface Event {
  id: string; title: string; description: string; organizer: string; organizerId: string; category: string; date: string; location: string; coverImage: string; ticketTiers: TicketTier[]; attendeeCount: number; likes: number; shares: number; isLiked?: boolean; posts?: EventPost[];
}

interface IndexProps {
  onEventSelect: (event: Event) => void;
  onCreatePost: () => void;
  onCategorySelect?: (category: string) => void;
  onOrganizerSelect?: (organizerId: string, organizerName: string) => void;
}

// ————————————————————————————————————————
// Mock fallback
// ————————————————————————————————————————
const mockEvents: Event[] = [
  {
    id: '1',
    title: 'Summer Music Festival 2024',
    description: 'Three days of incredible music with top artists from around the world. Food trucks, art installations, and unforgettable experiences await!',
    organizer: 'LiveNation Events',
    organizerId: '101',
    category: 'Music',
    date: 'July 15-17, 2024',
    location: 'Central Park, NYC',
    coverImage: DEFAULT_EVENT_COVER,
    ticketTiers: [
      { id: '1', name: 'General Admission', price: 30, badge: 'GA', available: 45, total: 1000 },
      { id: '2', name: 'VIP', price: 90, badge: 'VIP', available: 12, total: 100 }
    ],
    attendeeCount: 1243, likes: 892, shares: 156, isLiked: false, posts: []
  },
  {
    id: '2', title: 'Street Food Fiesta', description: 'Taste authentic flavors from around the world. Over 50 food vendors, live cooking demos, and family-friendly activities.', organizer: 'Foodie Adventures', organizerId: '102', category: 'Food & Drink', date: 'August 8, 2024', location: 'Brooklyn Bridge Park', coverImage: DEFAULT_EVENT_COVER,
    ticketTiers: [ { id: '3', name: 'Entry Pass', price: 25, badge: 'ENTRY', available: 234, total: 500 }, { id: '4', name: 'Foodie Pass', price: 75, badge: 'FOODIE', available: 18, total: 50 } ],
    attendeeCount: 567, likes: 445, shares: 89, isLiked: true, posts: []
  },
  {
    id: '3', title: 'Contemporary Art Showcase', description: 'Discover emerging artists and groundbreaking installations. Interactive exhibits, artist talks, and exclusive previews.', organizer: 'Modern Gallery NYC', organizerId: '103', category: 'Art & Culture', date: 'September 2, 2024', location: 'SoHo Art District', coverImage: DEFAULT_EVENT_COVER,
    ticketTiers: [ { id: '5', name: 'Standard', price: 35, badge: 'STD', available: 156, total: 200 }, { id: '6', name: 'Premium', price: 85, badge: 'PREM', available: 23, total: 50 } ],
    attendeeCount: 298, likes: 234, shares: 67, isLiked: false, posts: []
  }
];

export default function Index({ onEventSelect, onCreatePost }: IndexProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);
  const { withAuth, requireAuth } = useAuthGuard();
  const navigate = useNavigate();
  const { shareEvent } = useShare();

  // Fetch events
  useEffect(() => {
    const load = async () => {
      try {
        console.log('Fetching events...');
        const { data, error } = await supabase
          .from('events')
          .select(`
            id, title, description, start_at, end_at, venue, city, category, cover_image_url, visibility,
            user_profiles!events_created_by_fkey ( display_name ),
            ticket_tiers!ticket_tiers_event_id_fkey ( id, name, price_cents, badge_label, quantity )
          `)
          .eq('visibility', 'public')
          .order('start_at', { ascending: true })
          .limit(20);
        
        console.log('Events query result:', { data, error, dataLength: data?.length });
        
        if (error) {
          console.error('Events query error:', error);
          throw error;
        }
        
        if (!data || !data.length) { 
          console.log('No events found, using mock data');
          setEvents(mockEvents); 
          return; 
        }
        const transformed: Event[] = data.map((e: any) => ({
          id: e.id,
          title: e.title,
          description: e.description || '',
          organizer: e.user_profiles?.display_name || 'Organizer',
          organizerId: e.id,
          category: e.category || 'Event',
          date: new Date(e.start_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          location: e.city || e.venue || 'TBA',
          coverImage: e.cover_image_url || DEFAULT_EVENT_COVER,
          ticketTiers: (e.ticket_tiers || []).map((t: any) => ({ id: t.id, name: t.name, price: (t.price_cents||0)/100, badge: t.badge_label, available: t.quantity||0, total: t.quantity||0 })),
          attendeeCount: Math.floor(Math.random()*1000)+50,
          likes: Math.floor(Math.random()*500)+10,
          shares: Math.floor(Math.random()*100)+5,
          isLiked: false,
          posts: []
        }));
        setEvents(transformed);
      } catch (e) {
        console.error('load events error', e);
        setEvents(mockEvents);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const currentEvent = events[currentIndex];

  // Meta tags
  useEffect(() => { updateMetaTags(defaultMeta); }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'PageUp') setCurrentIndex(i => Math.max(0, i-1));
      if (e.key === 'ArrowDown' || e.key === 'PageDown') setCurrentIndex(i => Math.min(events.length-1, i+1));
      if (e.key === 'Home') setCurrentIndex(0);
      if (e.key === 'End') setCurrentIndex(Math.max(0, events.length-1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [events.length]);

  // Touch swipe
  const startY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0].clientY; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const diff = startY.current - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 50) setCurrentIndex(i => diff > 0 ? Math.min(events.length-1, i+1) : Math.max(0, i-1));
    startY.current = null;
  };

  // Preload neighboring images for a smoother swipe
  useEffect(() => {
    const next = events[currentIndex+1]?.coverImage; const prev = events[currentIndex-1]?.coverImage;
    [next, prev].filter(Boolean).forEach((src) => { const img = new Image(); img.src = src as string; });
  }, [currentIndex, events]);

  const handleLike = withAuth((eventId: string) => {
    setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, isLiked: !ev.isLiked, likes: ev.isLiked ? ev.likes-1 : ev.likes+1 } : ev));
  }, 'Please sign in to like events');

  const handleShare = (ev: Event) => { capture('share_click', { event_id: ev.id }); setShowShareModal(true); };
  const handleComment = withAuth(() => setShowCommentModal(true), 'Please sign in to comment on events');
  const handleMore = withAuth(() => toast({ title: 'More Options', description: 'Additional options coming soon…' }), 'Please sign in to access more options');

  const goTo = (i: number) => setCurrentIndex(Math.max(0, Math.min(events.length-1, i)));

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
            <img src="/lovable-uploads/247f3ae4-8789-4a73-af97-f0e41767873a.png" alt="YardPass" className="w-10 h-10" />
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </div>
      </div>
    );
  }

  if (!currentEvent) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">No Events Found</h1>
        <p className="text-muted-foreground mb-4">There are currently no events to display.</p>
        <PaymentSuccessHelper />
        <Button onClick={() => window.location.reload()} className="mt-4">Try Again</Button>
      </div>
    );
  }

  return (
    <div className="h-screen relative overflow-hidden bg-black" style={{ touchAction: 'pan-y' }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/60 to-transparent p-4">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <img src="/lovable-uploads/247f3ae4-8789-4a73-af97-f0e41767873a.png" alt="YardPass" className="w-8 h-8" />
            <span className="font-bold text-lg">YardPass</span>
          </div>
          <Button size="sm" variant="glass" onClick={() => requireAuth(() => onCreatePost(), 'Please sign in to create content')} className="bg-white/20 text-white border-white/30 hover:bg-white/30 min-h-[40px] px-3 font-semibold backdrop-blur-md shadow-lg">+ Create Event</Button>
        </div>
      </div>

      {/* Slides track */}
      <div ref={trackRef} className="h-full w-full relative transition-transform duration-300 ease-out" style={{ transform: `translateY(-${currentIndex * 100}%)` }}>
        {events.map((ev, i) => (
          <div key={ev.id} className="h-full w-full absolute" style={{ top: `${i * 100}%` }}>
            <ImageWithFallback src={ev.coverImage} alt={ev.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />
          </div>
        ))}
      </div>

      {/* Information panel */}
      <div className="absolute bottom-20 left-0 right-0 p-4 text-white z-20">
        <div className="flex justify-between items-end gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="secondary"
                className="bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90"
                onClick={() => navigate(routes.category(currentEvent.category))}
              >
                {currentEvent.category}
              </Badge>
              <Badge variant="outline" className="border-white/30 text-white cursor-pointer hover:bg-white/10" onClick={() => setShowAttendeeModal(true)}>
                {currentEvent.attendeeCount} attending
              </Badge>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-2 max-w-xl cursor-pointer hover:text-primary/90" onClick={() => navigate(routes.event(currentEvent.id))}>{currentEvent.title}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                <Avatar className="w-6 h-6"><AvatarFallback className="text-xs bg-white/20 text-white">{currentEvent.organizer.charAt(0)}</AvatarFallback></Avatar>
                <span className="cursor-pointer hover:text-white" onClick={() => navigate(routes.org(currentEvent.organizerId))}>@{currentEvent.organizer.replace(/\s+/g, '').toLowerCase()}</span>
                <Badge variant="secondary" className="text-[10px] tracking-wide"><Crown className="w-3 h-3 mr-1"/>ORGANIZER</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300 mb-3">
                <span className="inline-flex items-center gap-1"><Calendar className="w-4 h-4" /> {currentEvent.date}</span>
                <button className="inline-flex items-center gap-1 hover:text-white" onClick={() => toast({ title: 'Location', description: `Finding events near ${currentEvent.location}…` })}>
                  <MapPin className="w-4 h-4" /> {currentEvent.location}
                </button>
                <span className="inline-flex items-center gap-1"><Users className="w-4 h-4" /> {currentEvent.attendeeCount}</span>
              </div>
              <p className="text-sm text-gray-200/90 line-clamp-3 max-w-xl">{currentEvent.description}</p>
            </div>

            {currentEvent.ticketTiers?.length > 0 && (
              <div className="flex gap-2 pt-1 flex-wrap">
                {currentEvent.ticketTiers.map(t => (
                  <Button key={t.id} size="sm" variant="secondary" className="rounded-full bg-white/15 hover:bg-white/25 backdrop-blur border-white/30"
                    onClick={() => requireAuth(() => { onEventSelect(currentEvent); toast({ title: 'Ticket Details', description: `Viewing ${t.name} ticket…` }); }, 'Please sign in to view ticket details')}>
                    {t.badge ? <span className="mr-2 px-1.5 py-0.5 text-[10px] rounded bg-black/40">{t.badge}</span> : null}
                    {t.name} · ${t.price.toFixed(0)}
                  </Button>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button size="lg" variant="premium" onClick={() => requireAuth(() => setShowTicketModal(true), 'Please sign in to purchase tickets')} className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-[48px] px-6 font-bold shadow-lg">Get Tickets</Button>
              <Button size="lg" variant="glass" onClick={() => navigate(`/events/${currentEvent.id}`)} className="border-white/30 text-white bg-white/10 hover:bg-white/20 min-h-[48px] px-6 font-semibold backdrop-blur-md">Details</Button>
            </div>
          </div>

          {/* Action rail */}
          <div className="flex flex-col items-center gap-4 text-white select-none">
            <IconButton ariaLabel="Like" active={currentEvent.isLiked} count={currentEvent.likes} onClick={() => handleLike(currentEvent.id)}>
              <Heart className={`w-6 h-6 ${currentEvent.isLiked ? 'fill-white text-white' : 'text-white'}`} />
            </IconButton>
            <IconButton ariaLabel="Comments" count={currentEvent.posts?.length || 0} onClick={() => handleComment()}>
              <MessageCircle className="w-6 h-6 text-white" />
            </IconButton>
            <IconButton ariaLabel="Create post" onClick={() => requireAuth(() => setPostCreatorOpen(true), 'Please sign in to create posts')}>
              <div className="p-3 rounded-full bg-primary/80 backdrop-blur-sm border border-primary/50 hover:bg-primary transition-all duration-200 shadow-lg"><Plus className="w-6 h-6 text-white" /></div>
              <span className="text-xs font-medium text-white drop-shadow-lg">Post</span>
            </IconButton>
            <IconButton ariaLabel="Share" count={currentEvent.shares} onClick={() => handleShare(currentEvent)}>
              <Share className="w-6 h-6 text-white" />
            </IconButton>
            <IconButton ariaLabel="More" onClick={() => handleMore()}>
              <MoreVertical className="w-6 h-6 text-white" />
            </IconButton>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-20">
        {events.map((_, i) => (
          <button key={i} aria-label={`Go to event ${i+1}`} onClick={() => goTo(i)} className={`w-1.5 h-8 rounded-full transition-colors ${i===currentIndex ? 'bg-white' : 'bg-white/30 hover:bg-white/50'}`} />
        ))}
      </div>

      {/* Swipe layer (excludes action rail & header) */}
      <div className="absolute inset-0 z-10" style={{ pointerEvents: 'auto', touchAction: 'pan-y', clipPath: 'polygon(0% 15%, 80% 15%, 80% 100%, 0% 100%)' }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} />

      {/* Modals */}
      <AttendeeListModal isOpen={showAttendeeModal} onClose={() => setShowAttendeeModal(false)} eventTitle={currentEvent.title} attendeeCount={currentEvent.attendeeCount} attendees={[]} />

      <EventTicketModal
        event={{ id: currentEvent.id, title: currentEvent.title, start_at: (() => { const d = new Date(currentEvent.date); return isNaN(d.getTime()) ? new Date(Date.now()+30*24*60*60*1000).toISOString() : d.toISOString(); })(), venue: currentEvent.location, address: currentEvent.location, description: currentEvent.description }}
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        onSuccess={() => { setShowTicketModal(false); toast({ title: 'Redirecting to Checkout', description: 'Opening Stripe checkout in a new tab…' }); }}
      />

      <ShareModal 
        isOpen={showShareModal} 
        onClose={() => setShowShareModal(false)} 
        payload={showShareModal ? {
          title: currentEvent.title,
          text: `Check out ${currentEvent.title} - ${currentEvent.description}`,
          url: typeof window !== 'undefined' ? window.location.href : ''
        } : null} 
      />

      <PostCreatorModal
        isOpen={postCreatorOpen}
        onClose={() => setPostCreatorOpen(false)}
        onSuccess={() => {
          setPostCreatorOpen(false);
          toast({ title: 'Success', description: 'Your post has been created!' });
        }}
        preselectedEventId={currentEvent.id}
      />

      <CommentModal
        isOpen={showCommentModal}
        onClose={() => setShowCommentModal(false)}
        eventId={currentEvent.id}
        eventTitle={currentEvent.title}
      />
    </div>
  );
}

function IconButton({ children, onClick, count, active, ariaLabel }: { children: React.ReactNode; onClick: () => void; count?: number; active?: boolean; ariaLabel: string; }) {
  return (
    <button aria-label={ariaLabel} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }} className="flex flex-col items-center gap-1 transition-transform active:scale-95 min-h-[56px] min-w-[56px] p-2 touch-manipulation" style={{ backgroundColor: 'transparent' }}>
      <div className={`p-3 rounded-full transition-all duration-200 ${active ? 'bg-red-500 shadow-lg shadow-red-500/30 scale-110' : 'bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-white/20'}`}>{children}</div>
      {typeof count !== 'undefined' && <span className="text-xs font-medium text-white drop-shadow-lg">{count}</span>}
    </button>
  );
}
