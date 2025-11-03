import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Share2, Heart, Calendar, Clock, MapPin, Users, DollarSign, Info, Check, MessageCircle } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EventFeed } from "@/components/EventFeed";
import { EventPostsGrid } from "@/components/EventPostsGrid";
import MapboxEventMap from "@/components/MapboxEventMap";
import EventCheckoutSheet from "@/components/EventCheckoutSheet";
import CommentModal from "@/components/CommentModal";
import { SponsorBadges } from "@/components/sponsorship/SponsorBadges";
import { FlashbackBanner } from "@/components/flashbacks/FlashbackBanner";
import { FlashbackEmptyState } from "@/components/flashbacks/FlashbackEmptyState";

// Sponsor Section Component - Only renders if sponsors exist
function SponsorSection({ eventId }: { eventId: string }) {
  const [hasSponsors, setHasSponsors] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSponsors() {
      try {
        const { data, error } = await supabase
          .from("sponsorship_orders")
          .select("id", { count: 'exact', head: true })
          .eq("event_id", eventId)
          .in("status", ["accepted", "live", "completed"]);

        if (!error && data) {
          setHasSponsors(true);
        }
      } catch (err) {
        console.error("Error checking sponsors:", err);
      } finally {
        setLoading(false);
      }
    }

    checkSponsors();
  }, [eventId]);

  // Don't render anything if loading or no sponsors
  if (loading || !hasSponsors) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
          Sponsored By
        </h3>
      </div>
      <div className="elevated-card p-4">
        <SponsorBadges eventId={eventId} variant="auto" />
      </div>
    </section>
  );
}

interface EventDetails {
  id: string;
  title: string;
  coverImage: string;
  ownerContextType: 'user' | 'organization';
  ownerContextId: string;
  organizer: {
    id: string;
    name: string;
    avatar: string;
  };
  start_at: string; // Raw ISO date
  date: string;
  time: string;
  location: string;
  venue: string;
  city?: string;
  country?: string;
  description: string;
  categories: string[];
  attendees: number;
  lat?: number;
  lng?: number;
  ticketTiers: {
    id: string;
    name: string;
    price: number;
    available: number;
    total: number;
    benefits: string[];
  }[];
  isSaved: boolean;
  is_flashback?: boolean;
  flashback_end_date?: string | null;
  linked_event_id?: string | null;
  flashback_explainer?: string | null;
  organization_created_at?: string | null;
}

export function EventDetailsPageIntegrated() {
  const { identifier: eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'posts' | 'tagged'>('details');
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [postsCount, setPostsCount] = useState<number>(0);
  const [taggedCount, setTaggedCount] = useState<number>(0);
  
  // Comment modal state
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Load event details
  useEffect(() => {
    const loadEvent = async () => {
      if (!eventId) return;

      try {
        setLoading(true);

        // If identifier looks like a UUID, query by ID, otherwise by slug
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
        
        console.log('[EventDetailsPage] Searching for:', eventId, 'isUUID:', isUUID);

        let query = supabase
          .from('events')
          .select(`
            id,
            title,
            description,
            start_at,
            end_at,
            venue,
            address,
            city,
            country,
            lat,
            lng,
            cover_image_url,
            category,
            created_by,
            owner_context_type,
            owner_context_id,
            is_flashback,
            flashback_end_date,
            linked_event_id,
            flashback_explainer,
            user_profiles!events_created_by_fkey (
              user_id,
              display_name,
              photo_url
            ),
            organizations!events_owner_context_id_fkey (
              name,
              logo_url,
              created_at
            ),
            ticket_tiers!fk_ticket_tiers_event_id (
              id,
              name,
              price_cents,
              quantity
            )
          `);

        if (isUUID) {
          query = query.eq('id', eventId);
        } else {
          query = query.eq('slug', eventId);
        }

        const { data, error } = await query.single();

        if (error) throw error;

        // Get attendee count (count issued and transferred tickets)
        const { count: attendeeCount } = await supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', data.id)
          .in('status', ['issued', 'transferred', 'redeemed']);

        // Get posts count - Fetch counts by calling edge function with filters
        try {
          const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
          const { data: { session } } = await supabase.auth.getSession();
          
          // Build headers - include auth if available, but allow guest access
          const headers: Record<string, string> = {};
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
          
          // Fetch organizer posts count
          const organizerUrl = new URL(`${baseUrl}/functions/v1/posts-list`);
          organizerUrl.searchParams.append('event_id', data.id);
          organizerUrl.searchParams.append('filter_type', 'organizer_only');
          organizerUrl.searchParams.append('limit', '1000'); // Get all to count
          
          const organizerRes = await fetch(organizerUrl.toString(), {
            method: 'GET',
            headers,
            cache: 'no-store'
          });
          
          if (organizerRes.ok) {
            const organizerData = await organizerRes.json();
            setPostsCount(organizerData.data?.length || 0);
          }
          
          // Fetch attendee posts count
          const attendeeUrl = new URL(`${baseUrl}/functions/v1/posts-list`);
          attendeeUrl.searchParams.append('event_id', data.id);
          attendeeUrl.searchParams.append('filter_type', 'attendee_only');
          attendeeUrl.searchParams.append('limit', '1000'); // Get all to count
          
          const attendeeRes = await fetch(attendeeUrl.toString(), {
            method: 'GET',
            headers,
            cache: 'no-store'
          });
          
          if (attendeeRes.ok) {
            const attendeeData = await attendeeRes.json();
            setTaggedCount(attendeeData.data?.length || 0);
          }
        } catch (error) {
          console.error('[EventDetailsPage] Error fetching post counts:', error);
          setPostsCount(0);
          setTaggedCount(0);
        }

        // Check if user has saved this event
        if (user) {
          const { data: savedData } = await supabase
            .from('saved_events')
            .select('id')
            .eq('user_id', user.id)
            .eq('event_id', data.id)
            .maybeSingle();
          
          setIsSaved(!!savedData);
        } else {
          setIsSaved(false);
        }

        // Determine organizer info based on owner_context_type
        const isOrganization = data.owner_context_type === 'organization';
        const organizerName = isOrganization
          ? (data as any).organizations?.name || 'Organization'
          : data.user_profiles?.display_name || 'Organizer';
        const organizerAvatar = isOrganization
          ? (data as any).organizations?.logo_url || ''
          : data.user_profiles?.photo_url || '';
        const organizerId = isOrganization
          ? data.owner_context_id
          : data.created_by;

        const transformed: EventDetails = {
          id: data.id,
          title: data.title,
          coverImage: data.cover_image_url || '',
          ownerContextType: data.owner_context_type as 'user' | 'organization',
          ownerContextId: data.owner_context_id,
          organizer: {
            id: organizerId,
            name: organizerName,
            avatar: organizerAvatar
          },
          start_at: data.start_at, // Raw ISO date for ticket modal
          date: new Date(data.start_at).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          }),
          time: `${new Date(data.start_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${new Date(data.end_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
          location: `${data.venue}, ${data.address}`,
          venue: data.venue,
          city: data.city,
          country: data.country,
          lat: data.lat,
          lng: data.lng,
          description: data.description || '',
          categories: data.category ? [data.category] : [],
          attendees: attendeeCount || 0,
          ticketTiers: (data.ticket_tiers || []).map((tier: any) => ({
            id: tier.id,
            name: tier.name,
            price: tier.price_cents / 100,
            available: tier.quantity || 0,  // TODO: Calculate actual available from sold tickets
            total: tier.quantity || 0,
            benefits: []  // TODO: Add benefits field to ticket_tiers table if needed
          })),
          isSaved,
          is_flashback: data.is_flashback || false,
          flashback_end_date: data.flashback_end_date,
          linked_event_id: data.linked_event_id,
          flashback_explainer: data.flashback_explainer,
          organization_created_at: data.organizations?.created_at || null
        };

        setEvent(transformed);
        console.log('[EventDetailsPage] Event loaded successfully:', transformed.title);
      } catch (error) {
        console.error('[EventDetailsPage] Error loading event:', error);
        toast({
          title: 'Error',
          description: 'Failed to load event details. Please try again.',
          variant: 'destructive'
        });
        // Navigate back to search after error
        setTimeout(() => navigate('/search'), 2000);
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId, user]);

  const toggleSave = async () => {
    if (!user || !event) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to save events',
      });
      return;
    }

    try {
      if (isSaved) {
        // Remove from saved
        await supabase
          .from('saved_events')
          .delete()
          .eq('user_id', user.id)
          .eq('event_id', event.id);
        
        setIsSaved(false);
        toast({ title: 'Removed from saved events' });
      } else {
        // Add to saved
        await supabase
          .from('saved_events')
          .insert({
            user_id: user.id,
            event_id: event.id
          });
        
        setIsSaved(true);
        toast({ title: 'Event saved!' });
      }
    } catch (error) {
      console.error('Error toggling save:', error);
      toast({
        title: 'Error',
        description: 'Failed to save event',
        variant: 'destructive'
      });
    }
  };

  const handleGetTickets = () => {
    // Allow both guests and signed-in users to purchase tickets
    // Guest checkout is handled in the TicketPurchaseModal
    setTicketModalOpen(true);
  };

  // Loading state
  if (loading || !event) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-border/10 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero Image with Title Overlay - MODERNIZED */}
      <div className="relative h-64 overflow-hidden sm:h-80 md:h-96">
        <ImageWithFallback
          src={event.coverImage}
          alt={event.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
        
        {/* Enhanced dark gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />
        
        {/* Header Actions */}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-3 sm:p-4">
          <button 
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/20 bg-background/40 backdrop-blur-md transition-all hover:bg-background/60 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex gap-2">
            <button 
              onClick={toggleSave}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/20 bg-background/40 backdrop-blur-md transition-all hover:bg-background/60 sm:h-10 sm:w-10"
            >
              <Heart className={`h-5 w-5 ${isSaved ? 'fill-red-500 text-red-500' : 'text-foreground'}`} />
            </button>
            <button 
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: event.title,
                    url: window.location.href
                  });
                }
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/20 bg-background/40 backdrop-blur-md transition-all hover:bg-background/60 sm:h-10 sm:w-10"
            >
              <Share2 className="h-5 w-5 text-foreground" />
            </button>
          </div>
        </div>

        {/* Title and Organizer Overlay - MODERNIZED */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 z-10">
          {/* Category Badges */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {event.categories.map((category) => (
              <span
                key={category}
                className="inline-flex items-center rounded-full bg-black/70 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 sm:text-sm shadow-lg"
              >
                {category}
              </span>
            ))}
          </div>

          {/* Title - Direct on image with strong shadow */}
          <h1 className="text-white text-2xl font-extrabold leading-tight sm:text-3xl md:text-4xl on-image-strong mb-3">
            {event.title}
          </h1>

          {/* Organizer */}
          <button 
              onClick={() => {
                if (event.ownerContextType === 'organization') {
                  navigate(`/org/${event.ownerContextId}`);
                } else {
                  navigate(`/profile/${event.organizer.id}`);
                }
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-black/70 backdrop-blur-md ring-1 ring-white/20 transition-all hover:bg-black/80 hover:ring-white/30 w-fit shadow-lg"
            >
              <ImageWithFallback
                src={event.organizer.avatar}
                alt={event.organizer.name}
                className="h-6 w-6 rounded-full object-cover ring-1 ring-white/30"
              />
              <span className="text-white text-sm font-semibold">by {event.organizer.name}</span>
            </button>
        </div>
      </div>

      {/* Content - Add bottom padding for sticky footer + bottom nav */}
      <div className="px-3 sm:px-4 md:px-6 pb-40">
        {/* Flashback Banner - Show if this is a flashback event */}
        {event.is_flashback && (
          <div className="mt-6 mb-6">
            <FlashbackBanner
              eventId={event.id}
              eventTitle={event.title}
              flashbackExplainer={event.flashback_explainer}
              organizationCreatedAt={event.organization_created_at}
              linkedEventId={event.linked_event_id}
            />
          </div>
        )}

        {/* Tabs - MODERNIZED PILLS - Evenly Spaced & Responsive */}
        <div className="mb-6 grid grid-cols-3 gap-2">
          {(['details', 'posts', 'tagged'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2.5 rounded-full text-sm font-semibold capitalize transition-all min-h-[44px] flex items-center justify-center ${
                activeTab === tab
                  ? 'bg-muted text-foreground shadow-sm'
                  : 'text-foreground/60 hover:text-foreground hover:bg-muted/30'
              }`}
            >
              <span className="truncate">
              {tab}
              {tab === 'posts' && postsCount > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({postsCount})</span>
              )}
              {tab === 'tagged' && taggedCount > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({taggedCount})</span>
              )}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            {/* Date & Location Info Grid - MODERNIZED */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="elevated-card p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <Calendar className="h-5 w-5 text-foreground/70" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wide text-foreground/70 font-semibold mb-1">Date & Time</p>
                    <p className="text-sm font-semibold text-foreground">{event.date}</p>
                    <p className="text-xs text-foreground/70">{event.time}</p>
                  </div>
                </div>
              </div>

              <div className="elevated-card p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <MapPin className="h-5 w-5 text-foreground/70" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wide text-foreground/70 font-semibold mb-1">Location</p>
                    <p className="text-sm font-semibold text-foreground">{event.venue || 'TBA'}</p>
                    {event.city && (
                      <p className="text-xs text-foreground/70">{event.city}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sponsor Information - MODERNIZED - Only show if sponsors exist */}
            {event.id && (
              <SponsorSection eventId={event.id} />
            )}

            {/* Description - MODERNIZED */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-4 w-4 text-foreground/70" />
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                  About This Event
                </h3>
              </div>
              <div className="elevated-card p-4 sm:p-5">
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                  {event.description}
                </p>
              </div>
            </section>

            {/* Location Map - MODERNIZED */}
            {event.lat && event.lng && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-foreground/70" />
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                    Location
                  </h3>
                </div>
                <div className="elevated-card overflow-hidden">
                  <div className="p-3">
                    <div className="inline-flex items-center rounded-full bg-muted/50 px-3 py-1.5 text-sm font-medium text-foreground mb-2">{event.venue}</div>
                    <div className="rounded-lg overflow-hidden ring-1 ring-black/5">
                      <MapboxEventMap 
                        lat={event.lat}
                        lng={event.lng}
                        venue={event.venue}
                        address={event.location}
                        city={event.city as any}
                        country={event.country as any}
                        className="w-full h-56"
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="space-y-4">
            {/* Posts/Moments Grid - Organizer Posts */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Official Posts</h3>
              </div>
              <p className="text-sm text-foreground/60 mb-4">
                Updates and content from the event organizers
              </p>
            </div>
            
            {event?.id && (
              <EventPostsGrid 
                eventId={event.id}
                userId={user?.id}
                filterType="organizer_only"
                onPostClick={(post) => {
                  setSelectedPostId(post.id);
                  setShowCommentModal(true);
                }}
              />
            )}
          </div>
        )}

        {activeTab === 'tagged' && (
          <div className="space-y-4">
            {/* Tagged Posts Grid - Attendee Posts */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Attendee Moments</h3>
              </div>
              <p className="text-sm text-foreground/60 mb-4">
                See what attendees are sharing about this event
              </p>
            </div>
            
            {event?.id ? (
              <EventPostsGrid 
                eventId={event.id}
                userId={user?.id}
                filterType="attendee_only"
                onPostClick={(post) => {
                  setSelectedPostId(post.id);
                  setShowCommentModal(true);
                }}
              />
            ) : null}
          </div>
        )}
      </div>

      {/* Sticky Footer - Get Tickets CTA - Always visible above bottom nav */}
      {event.ticketTiers && event.ticketTiers.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-[110] border-t border-border shadow-lg bg-background/95 backdrop-blur-xl p-3 sm:p-4">
          <div className="flex items-center gap-3 sm:gap-4 max-w-screen-xl mx-auto">
            <div className="flex-1">
              <p className="text-xs text-foreground/70 font-medium sm:text-sm">Starting from</p>
              <p className="text-lg font-bold text-foreground sm:text-xl">
                ${Math.min(...event.ticketTiers.map(t => t.price)).toFixed(2)}
              </p>
            </div>
            <button 
              onClick={handleGetTickets}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-95 sm:px-8 sm:py-3.5 sm:text-base"
            >
              Get Tickets
            </button>
          </div>
        </div>
      )}

      {/* Ticket Purchase Modal */}
      {event && (
        <EventCheckoutSheet
          event={{
            id: event.id,
            title: event.title,
            start_at: event.start_at || event.date,
            startAtISO: event.start_at,
            venue: event.venue,
            address: event.location,
            description: event.description
          } as any}
          isOpen={ticketModalOpen}
          onClose={() => setTicketModalOpen(false)}
          onSuccess={() => {
            setTicketModalOpen(false);
            toast({
              title: 'Success!',
              description: 'Redirecting to checkout...'
            });
          }}
        />
      )}

      {/* Comment Modal */}
      {showCommentModal && selectedPostId && event && (
        <CommentModal
          key={`modal-${selectedPostId}-${event.id}`}
          isOpen={showCommentModal}
          onClose={() => {
            setShowCommentModal(false);
            setSelectedPostId(null);
          }}
          eventId={event.id}
          eventTitle={event.title}
          postId={selectedPostId}
          onCommentCountChange={(postId, newCount) => {
            console.log('💬 [EventDetails] Comment count updated:', postId, newCount);
            // Optional: refresh counts
          }}
        />
      )}
    </div>
  );
}

export default EventDetailsPageIntegrated;

