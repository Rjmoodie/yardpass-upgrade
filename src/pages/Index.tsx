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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
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
  const { items, loading, error, prependItem, hasMore, loadMore, refresh } = useUnifiedFeed(userId);

  useEffect(() => {
    if (error) {
      console.error('Feed error:', error);
      toast({ title: 'Failed to load feed', description: 'Please try refreshing the page.', variant: 'destructive' });
    }
  }, [error]);

  // Realtime listener for new posts
  useEffect(() => {
    if (!items.length) return;

    const uniqIds = Array.from(new Set(items.map(item => item.event_id)));
    const filter = uniqIds.length 
      ? `event_id=in.(${uniqIds.map(id => `"${id}"`).join(',')})` 
      : undefined;

    if (!filter) return;
    
    const channel = supabase
      .channel(`unified-feed-${uniqIds.sort().join('-').slice(0,60)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_posts',
          filter,
        },
        async (payload) => {
          const postId = (payload.new as any).id;
          
          // Fetch exact item via dedicated RPC
          const { data } = await supabase.rpc('get_feed_item_for_post', {
            p_user: userId || null,
            p_post_id: postId,
          });
          
          const item = Array.isArray(data) ? data[0] : data;
          if (item) {
            prependItem(item as any);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // Only re-sub when the *identity* of the set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, prependItem, JSON.stringify([...new Set(items.map(i => i.event_id))].sort())]);

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
        
        // Refresh the feed to show updated like count and status
        refresh();
        
        toast({ title: 'Liked!', description: 'Your reaction has been added.' });
      } catch (error) {
        console.error('Like error:', error);
        toast({ title: 'Error', description: 'Failed to like post', variant: 'destructive' });
      }
    }, 'Please sign in to like posts'),
    [withAuth, refresh]
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

  const handleAuthorClick = useCallback((authorId: string) => {
    navigate(`/profile/${authorId}`);
  }, [navigate]);

  const handleEventClick = useCallback((eventId: string) => {
    onEventSelect(eventId);
  }, [onEventSelect]);

  const handleOpenTickets = useCallback((eventId: string) => {
    // Track ticket modal open to PostHog
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('tickets_modal_opened', {
        event_id: eventId,
        user_id: userId
      });
    }

    setSelectedEventId(eventId);
    setShowTicketModal(true);
  }, [userId]);

  const goTo = useCallback((i: number) => setCurrentIndex(Math.max(0, Math.min(items.length - 1, i))), [items.length]);
  const currentItem = items[Math.max(0, Math.min(currentIndex, items.length - 1))];

  // PostHog analytics tracking function
  const trackPostHogEvent = useCallback((eventName: string, postId?: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture(eventName, {
        post_id: postId,
        event_id: currentItem?.event_id,
        event_title: currentItem?.event_title,
        user_id: userId,
        ...properties
      });
    }
  }, [currentItem, userId]);

  // Update handlers to include analytics
  const handleLikeWithAnalytics = useCallback(
    withAuth(async (postId: string) => {
      try {
        trackPostHogEvent('post_liked', postId);
        await handleLike(postId);
      } catch (error) {
        console.error('Like error:', error);
      }
    }, 'Please sign in to like posts'),
    [handleLike, trackPostHogEvent, withAuth]
  );

  const handleCommentWithAnalytics = useCallback(
    withAuth((postId: string) => {
      trackPostHogEvent('comment_opened', postId);
      handleComment(postId);
    }, 'Please sign in to comment'),
    [handleComment, trackPostHogEvent, withAuth]
  );

  const handleShareWithAnalytics = useCallback((postId: string) => {
    trackPostHogEvent('share_opened', postId);
    handleShare(postId);
  }, [handleShare, trackPostHogEvent]);

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-36 h-32 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <img src="/yardpass-logo.png" alt="YardPass" className="w-24 h-20" />
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
    <div className="feed-page h-screen relative overflow-hidden bg-black" style={{ touchAction: 'pan-y' }}>
      {/* Logo */}
      <div className="fixed left-2 top-2 z-30">
        <img
          src="/yardpass-logo.png"
          alt="YardPass"
          className="w-[8vw] h-[8vw] min-w-[32px] min-h-[32px] max-w-[80px] max-h-[80px] object-contain"
        />
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
                onCreatePost={() => requireAuth(() => onCreatePost(), 'Please sign in to create posts')}
                onReport={() => {}}
              />
            ) : (
              <UserPostCard
                item={item}
                onLike={handleLikeWithAnalytics}
                onComment={handleCommentWithAnalytics}
                onShare={handleShareWithAnalytics}
                onEventClick={handleEventClick}
                onAuthorClick={handleAuthorClick}
                onCreatePost={() => requireAuth(() => onCreatePost(), 'Please sign in to create posts')}
                onReport={() => {}}
              />
            )}
          </div>
        ))}
      </div>

      {/* Navigation controls */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-6 z-10 pointer-events-none">
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="p-2 rounded-full bg-black/40 border border-white/20 text-white hover:bg-black/60 transition disabled:opacity-50 pointer-events-auto"
            aria-label="Previous item"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          
          <div className="flex flex-col items-center gap-1 max-h-32 overflow-y-auto">
            {items.slice(Math.max(0, currentIndex - 3), currentIndex + 4).map((item, i) => {
              const actualIndex = Math.max(0, currentIndex - 3) + i;
              return (
                <button
                  key={`${item.item_type}:${item.item_id}`}
                  aria-label={`Go to ${item.item_type} ${actualIndex + 1}`}
                  onClick={() => goTo(actualIndex)}
                  className={`w-1 h-6 rounded-full transition-all duration-200 pointer-events-auto ${
                    actualIndex === currentIndex ? 'bg-white shadow-lg' : 'bg-white/40 hover:bg-white/70'
                  }`}
                />
              );
            })}
          </div>

          <button
            onClick={() => setCurrentIndex(Math.min(items.length - 1, currentIndex + 1))}
            disabled={currentIndex === items.length - 1}
            className="p-2 rounded-full bg-black/40 border border-white/20 text-white hover:bg-black/60 transition disabled:opacity-50 pointer-events-auto"
            aria-label="Next item"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modals */}
      <AttendeeListModal
        isOpen={showAttendeeModal}
        onClose={() => setShowAttendeeModal(false)}
        eventTitle={currentItem?.event_title || 'Event'}
        attendeeCount={0}
        attendees={[]}
      />
      
      <EventTicketModal
        isOpen={showTicketModal}
        onClose={() => {
          setShowTicketModal(false);
          setSelectedEventId(null);
        }}
        event={selectedEventId ? (() => {
          const feedItem = items.find(item => item.item_type === 'event' && item.item_id === selectedEventId) as Extract<typeof items[0], { item_type: 'event' }>;
          return feedItem ? {
            id: feedItem.event_id,
            title: feedItem.event_title,
            start_at: feedItem.event_starts_at,
            venue: feedItem.event_location,
            description: feedItem.event_description
          } : null;
        })() : null}
        onSuccess={() => {
          setShowTicketModal(false);
          setSelectedEventId(null);
        }}
      />
      
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        payload={currentItem ? {
          title: currentItem.event_title,
          text: `Check out this event: ${currentItem.event_title}`,
          url: `${window.location.origin}/e/${currentItem.event_id}`
        } : null}
      />
      
      <PostCreatorModal
        isOpen={postCreatorOpen}
        onClose={() => setPostCreatorOpen(false)}
        preselectedEventId={currentItem?.event_id}
      />
      
      {showCommentModal && commentPostId && currentItem && (
        <CommentModal
          isOpen={showCommentModal}
          onClose={() => {
            setShowCommentModal(false);
            setCommentPostId(undefined);
          }}
          eventId={currentItem.event_id}
          eventTitle={currentItem.event_title}
          postId={commentPostId}
          onSuccess={() => {
            // Refresh feed to show new comment count
            refresh();
          }}
        />
      )}
    </div>
  );
}