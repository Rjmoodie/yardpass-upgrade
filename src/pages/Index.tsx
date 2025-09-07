import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { updateMetaTags, defaultMeta } from '@/utils/meta';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { EventTicketModal } from '@/components/EventTicketModal';
import { AttendeeListModal } from '@/components/AttendeeListModal';
import { Heart, MessageCircle, Share, MoreVertical, MapPin, Calendar, Crown, Users, Plus, Play, Image as ImageIcon, TrendingUp, Clock } from 'lucide-react';
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
import { Event, EventPost, TicketTier, DatabaseEvent, DatabaseTicketTier } from '@/types/events';

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
    startAtISO: '2024-07-15T18:00:00Z',
    endAtISO: '2024-07-17T23:00:00Z',
    dateLabel: 'July 15-17, 2024',
    location: 'Central Park, NYC',
    coverImage: DEFAULT_EVENT_COVER,
    ticketTiers: [
      { id: '1', name: 'General Admission', price: 30, badge: 'GA', available: 45, total: 1000 },
      { id: '2', name: 'VIP', price: 90, badge: 'VIP', available: 12, total: 100 }
    ],
    attendeeCount: 1243, likes: 892, shares: 156, isLiked: false, posts: []
  },
  {
    id: '2', title: 'Street Food Fiesta', description: 'Taste authentic flavors from around the world. Over 50 food vendors, live cooking demos, and family-friendly activities.', organizer: 'Foodie Adventures', organizerId: '102', category: 'Food & Drink', startAtISO: '2024-08-08T12:00:00Z', dateLabel: 'August 8, 2024', location: 'Brooklyn Bridge Park', coverImage: DEFAULT_EVENT_COVER,
    ticketTiers: [ { id: '3', name: 'Entry Pass', price: 25, badge: 'ENTRY', available: 234, total: 500 }, { id: '4', name: 'Foodie Pass', price: 75, badge: 'FOODIE', available: 18, total: 50 } ],
    attendeeCount: 567, likes: 445, shares: 89, isLiked: true, posts: []
  },
  {
    id: '3', title: 'Contemporary Art Showcase', description: 'Discover emerging artists and groundbreaking installations. Interactive exhibits, artist talks, and exclusive previews.', organizer: 'Modern Gallery NYC', organizerId: '103', category: 'Art & Culture', startAtISO: '2024-09-02T19:00:00Z', dateLabel: 'September 2, 2024', location: 'SoHo Art District', coverImage: DEFAULT_EVENT_COVER,
    ticketTiers: [ { id: '5', name: 'Standard', price: 35, badge: 'STD', available: 156, total: 200 }, { id: '6', name: 'Premium', price: 85, badge: 'PREM', available: 23, total: 50 } ],
    attendeeCount: 298, likes: 234, shares: 67, isLiked: false, posts: []
  }
];

// RecentPostsRail component for displaying post tiles within event cards
function RecentPostsRail({ 
  posts, 
  eventId, 
  onPostClick, 
  onViewAllClick 
}: { 
  posts: EventPost[]; 
  eventId: string; 
  onPostClick: (postId: string) => void;
  onViewAllClick: () => void;
}) {
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});
  const [isVisible, setIsVisible] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Only load once
        }
      },
      { 
        rootMargin: '50px', // Start loading 50px before it comes into view
        threshold: 0.1 
      }
    );

    if (railRef.current) {
      observer.observe(railRef.current);
    }

    return () => observer.disconnect();
  }, []);

  if (!posts || posts.length === 0) {
    return (
      <div ref={railRef} className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
        <p className="text-sm text-gray-300 text-center">Be the first to post about this event!</p>
      </div>
    );
  }

  // Show loading state until visible
  if (!isVisible) {
    return (
      <div ref={railRef} className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
        <div className="flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="ml-2 text-sm text-gray-300">Loading posts...</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={railRef} className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Recent Posts</h4>
        <button 
          onClick={onViewAllClick}
          className="text-xs text-primary hover:text-primary/80 font-medium"
        >
          View All
        </button>
      </div>
      
      <div className="flex gap-2 overflow-x-auto pb-2">
        {posts.map((post) => (
          <div 
            key={post.id}
            onClick={() => onPostClick(post.id)}
            className="flex-shrink-0 w-24 h-24 bg-white/10 rounded-lg border border-white/20 cursor-pointer hover:bg-white/15 transition-all duration-200 relative group"
          >
            {/* Media thumbnail */}
            {post.thumbnailUrl ? (
              <div className="relative w-full h-full">
                <ImageWithFallback 
                  src={post.thumbnailUrl} 
                  alt="Post thumbnail"
                  className="w-full h-full object-cover rounded-lg"
                  onLoad={() => setImageLoading(prev => ({ ...prev, [post.id]: false }))}
                  onError={() => setImageLoading(prev => ({ ...prev, [post.id]: false }))}
                />
                {imageLoading[post.id] !== false && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/5">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center rounded-lg bg-white/5">
                {post.mediaType === 'video' ? (
                  <Play className="w-6 h-6 text-white/60" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-white/60" />
                )}
              </div>
            )}
            
            {/* Play overlay for videos */}
            {post.mediaType === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center">
                  <Play className="w-4 h-4 text-white ml-0.5" />
                </div>
              </div>
            )}
            
            {/* Author info overlay */}
            <div className="absolute bottom-1 left-1 right-1">
              <div className="bg-black/70 rounded px-1 py-0.5">
                <p className="text-xs text-white truncate">{post.authorName}</p>
                <div className="flex items-center gap-1 text-xs text-gray-300">
                  <Heart className="w-3 h-3" />
                  <span>{post.likes}</span>
                  {post.commentCount && post.commentCount > 0 && (
                    <>
                      <MessageCircle className="w-3 h-3 ml-1" />
                      <span>{post.commentCount}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Index({ onEventSelect, onCreatePost }: IndexProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortByActivity, setSortByActivity] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const { withAuth, requireAuth } = useAuthGuard();
  const navigate = useNavigate();
  const { shareEvent } = useShare();

  // Fetch events with recent posts using optimized RPC
  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    const load = async (retryCount = 0) => {
      const maxRetries = 3;
      try {
        console.log(`Fetching home feed... (attempt ${retryCount + 1})`);
        
        // Get current user session
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('Auth error:', userError);
          throw userError;
        }
        
        if (!user) {
          console.log('No user session, using mock data');
          if (!cancelled) setEvents(mockEvents);
          return;
        }

        // Use the optimized RPC function
        const { data, error } = await supabase.functions.invoke('get-home-feed', {
          body: { 
            posts_per_event: 3,
            sort_by_activity: sortByActivity
          }
        });

        if (error) throw error;
        if (cancelled) return;
        
        if (!data?.events || !data.events.length) { 
          console.log('No events found, using mock data');
          if (!cancelled) setEvents(mockEvents);
          return; 
        }

        console.log(`Loaded ${data.events.length} events with real attendee counts`);
        if (!cancelled) setEvents(data.events);
      } catch (e: any) {
        if (cancelled) return;
        console.error('load home feed error', e);
        
        // Retry logic for network errors with exponential backoff + jitter
        const isAbort = e?.name === 'AbortError';
        if (!isAbort) {
          const maxRetries = 3;
          const retryCount = (Number(e?.__retryCount) || 0);
          if (retryCount < maxRetries && e?.code !== 'PGRST116') {
            const delay = Math.min(8000, 500 * 2 ** retryCount) + Math.random() * 250;
            console.log(`Retrying in ${Math.round(delay)}ms...`);
            const retryError: any = new Error('retry');
            (retryError as any).__retryCount = retryCount + 1;
            setTimeout(() => load(retryCount + 1), delay);
            return;
          }
        }
        
        // Fallback to mock data on final failure
        console.log('Using mock data as fallback');
        if (!cancelled) {
          setEvents(mockEvents);
          toast({
            title: 'Unable to load events',
            description: 'Showing sample events. Please check your connection.',
            variant: 'destructive'
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [sortByActivity]);

  // Clamp currentIndex to prevent out-of-bounds access
  const safeIndex = Math.max(0, Math.min(currentIndex, events.length - 1));
  const currentEvent = events[safeIndex];

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

  // Listen for new posts and update events optimistically
  useEffect(() => {
    const handlePostCreated = (event: CustomEvent) => {
      try {
        const { eventId, postData } = event.detail;
        console.log('Post created event received:', { eventId, postData });
        
        if (!eventId || !postData) {
          console.warn('Invalid post created event data:', event.detail);
          return;
        }
        
        // Update the events state to include the new post
        setEvents(prevEvents => 
          prevEvents.map(event => {
            if (event.id === eventId) {
              const newPost: EventPost = {
                id: postData.id || `temp-${Date.now()}`,
                authorName: postData.authorName || 'You',
                authorBadge: postData.isOrganizer ? 'ORGANIZER' : 'ATTENDEE',
                isOrganizer: postData.isOrganizer || false,
                content: postData.content || '',
                timestamp: new Date().toLocaleDateString(),
                likes: 0,
                mediaType: postData.mediaType,
                mediaUrl: postData.mediaUrl,
                thumbnailUrl: postData.thumbnailUrl,
                commentCount: 0
              };
              
              // Add new post to the beginning of the posts array, maintaining 3-post limit
              const updatedPosts = [newPost, ...(event.posts || [])].slice(0, 3);
              
              return {
                ...event,
                posts: updatedPosts
              };
            }
            return event;
          })
        );
        
        // Show success toast
      toast({
          title: 'Post created!',
          description: 'Your post has been added to the event feed.',
        });
      } catch (error) {
        console.error('Error handling post created event:', error);
      }
    };

    // Add event listener for post creation
    window.addEventListener('postCreated', handlePostCreated as EventListener);
    
    return () => {
      window.removeEventListener('postCreated', handlePostCreated as EventListener);
    };
  }, []);

  // Memoized handlers for performance
  const handleLike = useCallback(withAuth((eventId: string) => {
    setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, isLiked: !ev.isLiked, likes: ev.isLiked ? ev.likes-1 : ev.likes+1 } : ev));
  }, 'Please sign in to like events'), []);

  const handleShare = useCallback((ev: Event) => { 
    capture('share_click', { event_id: ev.id }); 
    setShowShareModal(true); 
  }, []);

  const handleComment = useCallback(withAuth(() => setShowCommentModal(true), 'Please sign in to comment on events'), []);
  const handleMore = useCallback(withAuth(() => toast({ title: 'More Options', description: 'Additional options coming soon…' }), 'Please sign in to access more options'), []);

  const goTo = useCallback((i: number) => setCurrentIndex(Math.max(0, Math.min(events.length-1, i))), [events.length]);

  // Memoized post click handlers
  const handlePostClick = useCallback((postId: string) => {
    navigate(routes.eventDetails(currentEvent.id) + '?tab=posts&post=' + postId);
  }, [navigate, currentEvent.id]);

  const handleViewAllPosts = useCallback(() => {
    navigate(routes.eventDetails(currentEvent.id) + '?tab=posts');
  }, [navigate, currentEvent.id]);

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
          <div className="flex items-center gap-2">
            {/* Sort Toggle */}
            <button
              onClick={() => setSortByActivity(!sortByActivity)}
              className="flex items-center gap-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 transition-all duration-200 backdrop-blur-sm"
              title={sortByActivity ? "Sort by event date" : "Sort by activity"}
            >
              {sortByActivity ? (
                <>
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-medium">Active</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-medium">Upcoming</span>
                </>
              )}
            </button>
            <Button size="sm" variant="glass" onClick={() => requireAuth(() => onCreatePost(), 'Please sign in to create content')} className="bg-white/20 text-white border-white/30 hover:bg-white/30 min-h-[40px] px-3 font-semibold backdrop-blur-md shadow-lg">+ Create Post</Button>
          </div>
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
                <span className="inline-flex items-center gap-1"><Calendar className="w-4 h-4" /> {currentEvent.dateLabel}</span>
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

            {/* Recent Posts Rail */}
            <RecentPostsRail 
              posts={currentEvent.posts || []}
              eventId={currentEvent.id}
              onPostClick={handlePostClick}
              onViewAllClick={handleViewAllPosts}
            />

            <div className="flex gap-3 pt-1">
              <Button size="lg" variant="premium" onClick={() => requireAuth(() => setShowTicketModal(true), 'Please sign in to purchase tickets')} className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-[48px] px-6 font-bold shadow-lg">Get Tickets</Button>
              <Button size="lg" variant="glass" onClick={() => navigate(routes.eventDetails(currentEvent.id))} className="border-white/30 text-white bg-white/10 hover:bg-white/20 min-h-[48px] px-6 font-semibold backdrop-blur-md">Details</Button>
              </div>
              </div>

          {/* Action rail */}
          <div className="flex flex-col items-center gap-4 text-white select-none">
            <IconButton ariaLabel="Like" active={currentEvent.isLiked} count={currentEvent.likes} onClick={() => handleLike(currentEvent.id)}>
              <Heart className={`w-6 h-6 ${currentEvent.isLiked ? 'fill-white text-white' : 'text-white'}`} />
            </IconButton>
            <IconButton ariaLabel="Comments" count={currentEvent.posts?.reduce((sum, post) => sum + (post.commentCount || 0), 0) || 0} onClick={() => handleComment()}>
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
        event={{ 
          id: currentEvent.id,
          title: currentEvent.title,
          start_at: currentEvent.startAtISO, 
          venue: currentEvent.location,
          address: currentEvent.location,
          description: currentEvent.description
        }}
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
