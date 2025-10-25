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
import { EventTicketModal } from "@/components/EventTicketModal";
import CommentModal from "@/components/CommentModal";

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
            user_profiles!events_created_by_fkey (
              user_id,
              display_name,
              photo_url
            ),
            organizations!events_owner_context_id_fkey (
              name,
              logo_url
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

        // Get attendee count
        const { count: attendeeCount } = await supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', data.id)
          .eq('status', 'active');

        // Get posts count
        const { count: eventPostsCount } = await supabase
          .from('event_posts')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', data.id)
          .is('deleted_at', null);
        
        setPostsCount(eventPostsCount || 0);

        // Get tagged posts count (where current user is mentioned)
        if (user) {
          const { data: taggedMentions } = await supabase
            .from('post_mentions')
            .select('post_id')
            .eq('mentioned_user_id', user.id);
          
          if (taggedMentions && taggedMentions.length > 0) {
            const taggedPostIds = taggedMentions.map(m => m.post_id);
            const { count: eventTaggedCount } = await supabase
              .from('event_posts')
              .select('id', { count: 'exact', head: true })
              .in('id', taggedPostIds)
              .eq('event_id', data.id)
              .is('deleted_at', null);
            
            setTaggedCount(eventTaggedCount || 0);
          }
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
          isSaved
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
    }
  };

  const handleGetTickets = () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to purchase tickets',
      });
      navigate('/auth');
      return;
    }
    setTicketModalOpen(true);
  };

  // Loading state
  if (loading || !event) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#FF8C00]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Hero Image with Title Overlay (Like Original) */}
      <div className="relative h-64 overflow-hidden sm:h-80 md:h-96">
        <ImageWithFallback
          src={event.coverImage}
          alt={event.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
        
        {/* Header Actions */}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-3 sm:p-4">
          <button 
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition-all hover:bg-black/60 sm:h-10 sm:w-10"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <div className="flex gap-2">
            <button 
              onClick={toggleSave}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition-all hover:bg-black/60 sm:h-10 sm:w-10"
            >
              <Heart className={`h-5 w-5 ${isSaved ? 'fill-red-500 text-red-500' : 'text-white'}`} />
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
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md transition-all hover:bg-black/60 sm:h-10 sm:w-10"
            >
              <Share2 className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* Title and Organizer Overlay (Like Original) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
          {/* Category and Attendee Badges */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {event.categories.map((category) => (
              <span
                key={category}
                className="rounded-full bg-[#FF8C00] px-3 py-1 text-xs font-semibold text-white sm:text-sm"
              >
                {category}
              </span>
            ))}
            <span className="rounded-full border border-white/30 bg-black/40 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm sm:text-sm">
              {event.attendees}
            </span>
          </div>

          {/* Event Title */}
          <h1 className="mb-2 text-2xl font-bold text-white drop-shadow-lg sm:text-3xl md:text-4xl">
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
            className="flex items-center gap-2 text-sm text-white transition-opacity hover:opacity-80"
          >
            <ImageWithFallback
              src={event.organizer.avatar}
              alt={event.organizer.name}
              className="h-6 w-6 rounded-full object-cover border border-white/30"
            />
            <span>by {event.organizer.name}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 sm:px-4 md:px-6">
        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-white/10">
          {(['details', 'posts', 'tagged'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 pb-3 text-sm font-medium capitalize transition-all sm:text-base ${
                activeTab === tab
                  ? 'border-b-2 border-[#FF8C00] text-white'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {tab}
              {tab === 'posts' && postsCount > 0 && (
                <span className="ml-1.5 text-xs text-white/60">({postsCount})</span>
              )}
              {tab === 'tagged' && taggedCount > 0 && (
                <span className="ml-1.5 text-xs text-white/60">({taggedCount})</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            {/* Date & Location Info Grid (Like Original) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-[#FF8C00] mt-0.5" />
                  <div>
                    <p className="text-xs text-white/60 mb-1">Date & Time</p>
                    <p className="text-sm font-medium text-white">{event.date}</p>
                    <p className="text-xs text-white/70 mt-0.5">{event.time}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-[#FF8C00] mt-0.5" />
                  <div>
                    <p className="text-xs text-white/60 mb-1">Location</p>
                    <p className="text-sm font-medium text-white">{event.venue || 'TBA'}</p>
                    {event.city && (
                      <p className="text-xs text-white/70 mt-0.5">{event.city}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:p-5">
              <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-white sm:text-lg">
                <Info className="h-5 w-5 text-[#FF8C00]" />
                About This Event
              </h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/80 sm:text-base">
                {event.description}
              </p>
            </div>

            {/* Location Map */}
            {event.lat && event.lng && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:p-5">
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-white sm:text-lg">
                  <MapPin className="h-5 w-5 text-[#FF8C00]" />
                  Location
                </h3>
                <div className="overflow-hidden rounded-xl">
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
            )}
          </div>
        )}

        {activeTab === 'tagged' && (
          <div className="space-y-4">
            {/* Tagged Posts Grid */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-[#FF8C00]" />
                <h3 className="text-lg font-semibold text-white">Tagged Moments</h3>
              </div>
              <p className="text-sm text-white/60 mb-4">
                Posts where you've been tagged at this event
              </p>
            </div>
            
            {event?.id && user?.id ? (
              <EventPostsGrid 
                eventId={event.id}
                userId={user.id}
                showTaggedOnly={true}
                onPostClick={(post) => {
                  setSelectedPostId(post.id);
                  setShowCommentModal(true);
                }}
              />
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-white/60">Sign in to see posts where you're tagged</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="space-y-4">
            {/* Posts/Moments Grid */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="h-5 w-5 text-[#FF8C00]" />
                <h3 className="text-lg font-semibold text-white">Event Moments</h3>
              </div>
              <p className="text-sm text-white/60 mb-4">
                See what attendees are sharing about this event
              </p>
            </div>
            
            {event?.id && (
              <EventPostsGrid 
                eventId={event.id}
                userId={user?.id}
                onPostClick={(post) => {
                  setSelectedPostId(post.id);
                  setShowCommentModal(true);
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Sticky Footer - Get Tickets CTA */}
      {event.ticketTiers.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/80 p-3 backdrop-blur-xl sm:p-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex-1">
              <p className="text-xs text-white/60 sm:text-sm">Starting from</p>
              <p className="text-lg font-bold text-white sm:text-xl">
                ${Math.min(...event.ticketTiers.map(t => t.price)).toFixed(2)}
              </p>
            </div>
            <button 
              onClick={handleGetTickets}
              className="rounded-full bg-[#FF8C00] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#FF9D1A] active:scale-95 sm:px-8 sm:py-3.5 sm:text-base"
            >
              Get Tickets
            </button>
          </div>
        </div>
      )}

      {/* Ticket Purchase Modal */}
      {event && (
        <EventTicketModal
          event={{
            id: event.id,
            title: event.title,
            start_at: event.date,
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
          isOpen={showCommentModal}
          onClose={() => {
            setShowCommentModal(false);
            setSelectedPostId(null);
          }}
          eventId={event.id}
          eventTitle={event.title}
          postId={selectedPostId}
          onCommentCountChange={() => {
            // Optional: refresh counts
          }}
        />
      )}
    </div>
  );
}

export default EventDetailsPageIntegrated;

