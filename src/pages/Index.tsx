// src/pages/Index.tsx
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { updateMetaTags, defaultMeta } from '@/utils/meta';
import { EventTicketModal } from '@/components/EventTicketModal';
import { AttendeeListModal } from '@/components/AttendeeListModal';
import { Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { ShareModal } from '@/components/ShareModal';
import { PostCreatorModal } from '@/components/PostCreatorModal';
import CommentModal from '@/components/CommentModal';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { useUnifiedFeed } from '@/hooks/useUnifiedFeed';
import { EventCard } from '@/components/EventCard';
import { UserPostCard } from '@/components/UserPostCard';
import { ReportButton } from '@/components/ReportButton';
import { supabase } from '@/integrations/supabase/client';

interface IndexProps {
  onEventSelect: (eventId: string) => void;
  onCreatePost: () => void;
  onCategorySelect?: (category: string) => void;
  onOrganizerSelect?: (organizerId: string, organizerName: string) => void;
}


export default function Index({ onEventSelect, onCreatePost }: IndexProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | undefined>(undefined);
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);

  const { withAuth, requireAuth } = useAuthGuard();
  const navigate = useNavigate();

  // Get current user for feed
  const [userId, setUserId] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id);
    });
  }, []);

  // Unified feed
  const { items, loading, error, prependItem } = useUnifiedFeed(userId);

  useEffect(() => {
    if (error) {
      console.error('Feed error:', error);
      toast({ title: 'Failed to load feed', description: 'Please try refreshing the page.', variant: 'destructive' });
    }
  }, [error]);


  // Realtime listener for new posts
  useEffect(() => {
    if (!items.length) return;

    const eventIds = [...new Set(items.map(item => item.event_id))];
    
    const channel = supabase
      .channel('unified-feed-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_posts',
          filter: `event_id=in.(${eventIds.join(',')})`,
        },
        async (payload) => {
          const newPost = payload.new as any;
          
          // Fetch complete post data with author info
          const { data: postData } = await supabase.rpc('get_home_feed_v2', {
            p_user: userId || null,
            p_limit: 1,
            p_cursor_ts: null,
            p_cursor_id: null,
          });

          const matchingPost = postData?.find((item: any) => 
            item.item_type === 'post' && item.item_id === newPost.id
          );

          if (matchingPost) {
            prependItem(matchingPost);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [items, userId, prependItem]);


  // Meta
  useEffect(() => { updateMetaTags(defaultMeta); }, []);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'PageUp') setCurrentIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowDown' || e.key === 'PageDown') setCurrentIndex((i) => Math.min(items.length - 1, i + 1));
      if (e.key === 'Home') setCurrentIndex(0);
      if (e.key === 'End') setCurrentIndex(Math.max(0, items.length - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items.length]);

  // Actions
  const handleLike = useCallback(
    withAuth(async (postId: string) => {
      try {
        // Toggle reaction
        const { error } = await supabase.functions.invoke('reactions-toggle', {
          body: { post_id: postId, kind: 'like' }
        });
        if (error) throw error;
        toast({ title: 'Liked!', description: 'Your reaction has been added.' });
      } catch (error) {
        console.error('Like error:', error);
        toast({ title: 'Error', description: 'Failed to like post', variant: 'destructive' });
      }
    }, 'Please sign in to like posts'),
    [withAuth]
  );

  const handleComment = useCallback(
    withAuth((postId: string) => {
      setCommentPostId(postId);
      setShowCommentModal(true);
    }, 'Please sign in to comment'),
    [withAuth]
  );

  const handleShare = useCallback((postId: string) => {
    setShowShareModal(true);
  }, []);

  const handleEventClick = useCallback((eventId: string) => {
    onEventSelect(eventId);
  }, [onEventSelect]);

  const handleOpenTickets = useCallback(
    requireAuth((eventId: string) => {
      setShowTicketModal(true);
    }, 'Please sign in to purchase tickets'),
    [requireAuth]
  );

  const goTo = useCallback((i: number) => setCurrentIndex(Math.max(0, Math.min(items.length - 1, i))), [items.length]);
  const currentItem = items[Math.max(0, Math.min(currentIndex, items.length - 1))];

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

  if (!currentItem) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">No Content Found</h1>
        <p className="text-muted-foreground mb-4">There are currently no posts or events to display.</p>
        <Button onClick={() => window.location.reload()} className="mt-4">Try Again</Button>
      </div>
    );
  }

  return (
    <div className="h-screen relative overflow-hidden bg-black" style={{ touchAction: 'pan-y' }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/70 to-transparent pointer-events-auto">
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-2">
            <img src="/lovable-uploads/247f3ae4-8789-4a73-af97-f0e41767873a.png" alt="YardPass" className="w-7 h-7" />
            <span className="font-bold text-base text-white">YardPass</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/80">
              {currentIndex + 1} of {items.length}
            </span>
          </div>
        </div>
      </div>

      {/* Feed Items */}
      <div 
        className="h-full w-full relative transition-transform duration-300 ease-out"
        style={{ transform: `translateY(-${currentIndex * 100}%)` }}
      >
        {items.map((item, i) => (
          <div key={`${item.item_type}:${item.item_id}`} className="h-full w-full absolute" style={{ top: `${i * 100}%` }}>
            {item.item_type === 'event' ? (
              <EventCard
                item={item}
                onOpenTickets={handleOpenTickets}
                onEventClick={handleEventClick}
              />
            ) : (
              <UserPostCard
                item={item}
                onLike={handleLike}
                onComment={handleComment}
                onShare={handleShare}
                onEventClick={handleEventClick}
              />
            )}
          </div>
        ))}
      </div>

      {/* Right action rail */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 pointer-events-auto">
        <div className="flex flex-col items-center gap-3 text-white select-none">
          <button
            onClick={() => requireAuth(() => onCreatePost(), 'Please sign in to create posts')}
            className="p-3 rounded-full bg-primary/90 backdrop-blur-sm border border-primary/60 hover:bg-primary transition-all duration-200 shadow-lg min-h-[48px] min-w-[48px] touch-manipulation"
            aria-label="Create post"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
          <div className="pointer-events-auto">
            <ReportButton 
              targetType={currentItem.item_type === 'event' ? 'event' : 'post'} 
              targetId={currentItem.item_type === 'event' ? currentItem.event_id : currentItem.item_id} 
            />
          </div>
        </div>
      </div>

      {/* Navigation controls */}
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-20">
        {events.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to event ${i + 1}`}
            onClick={() => goTo(i)}
            className={`w-1 h-6 rounded-full transition-all duration-200 touch-manipulation ${
              i === currentIndex 
                ? 'bg-white shadow-sm' 
                : 'bg-white/40 hover:bg-white/60 active:bg-white/70'
            }`}
          />
        ))}
      </div>

      {/* Swipe zone for vertical navigation */}
      <div
        className="absolute z-10"
        style={{ pointerEvents: 'auto', touchAction: 'pan-y', top: '12%', bottom: '32%', left: 0, right: '20%' }}
        onTouchStart={(e) => { (e.currentTarget as any).__startY = e.touches[0].clientY; }}
        onTouchEnd={(e) => {
          const startY = (e.currentTarget as any).__startY as number | undefined;
          if (startY == null) return;
          const diff = startY - e.changedTouches[0].clientY;
          if (Math.abs(diff) > 50) setCurrentIndex((i) => (diff > 0 ? Math.min(events.length - 1, i + 1) : Math.max(0, i - 1)));
          (e.currentTarget as any).__startY = undefined;
        }}
      />

      {/* Modals */}
      <AttendeeListModal
        isOpen={showAttendeeModal}
        onClose={() => setShowAttendeeModal(false)}
        eventTitle={currentEvent?.title || ''}
        attendeeCount={currentEvent?.attendeeCount || 0}
        attendees={[]}
      />

      <EventTicketModal
        event={{
          id: currentEvent?.id || '',
          title: currentEvent?.title || '',
          start_at: currentEvent?.startAtISO || '',
          venue: currentEvent?.location || '',
          address: currentEvent?.location || '',
          description: currentEvent?.description || '',
        }}
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        onSuccess={() => {
          setShowTicketModal(false);
          toast({ title: 'Redirecting to Checkout', description: 'Opening Stripe checkout in a new tab…' });
        }}
      />

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        payload={
          showShareModal && currentEvent
            ? { title: currentEvent.title, text: `Check out ${currentEvent.title} - ${currentEvent.description}`, url: typeof window !== 'undefined' ? window.location.href : '' }
            : null
        }
      />

        <PostCreatorModal
          isOpen={postCreatorOpen}
          onClose={() => setPostCreatorOpen(false)}
          onSuccess={() => {
            setPostCreatorOpen(false);
          toast({ title: 'Success', description: 'Your post has been created!' });
        }}
        preselectedEventId={currentEvent?.id}
      />

      <CommentModal
        isOpen={showCommentModal}
        onClose={() => { setShowCommentModal(false); setCommentPostId(undefined); setCommentMediaId(undefined); }}
        eventId={currentEvent?.id || ''}
        eventTitle={currentEvent?.title || ''}
        postId={commentPostId}
        mediaPlaybackId={commentMediaId}
        />
    </div>
  );
}