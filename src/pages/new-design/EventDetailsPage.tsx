import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Share2, Heart, Calendar, Clock, MapPin, Users, DollarSign, Info, Check, MessageCircle } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { optimizeSupabaseImage, IMAGE_PRESETS } from "@/utils/imageOptimizer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { EventFeed } from "@/components/EventFeed";
import { EventPostsGrid } from "@/components/EventPostsGrid";
import LazyMapboxEventMap from "@/components/maps/LazyMapboxEventMap";
import EventCheckoutSheet from "@/components/EventCheckoutSheet";
import CommentModal from "@/components/CommentModal";
import { SponsorBadges } from "@/components/sponsorship/SponsorBadges";
import { FlashbackBanner } from "@/components/flashbacks/FlashbackBanner";
import { FlashbackEmptyState } from "@/components/flashbacks/FlashbackEmptyState";
import { BrandedSpinner } from "@/components/BrandedSpinner";

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
  const [isGoing, setIsGoing] = useState(false);
  const [goingCount, setGoingCount] = useState<number>(0);
  
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

        const { data, error } = await query.maybeSingle();

        if (error) throw error;
        
        // ✅ Handle case where event doesn't exist or RLS blocks it
        if (!data) {
          throw new Error('Event not found or you don\'t have permission to view it');
        }

        // Get attendee count (count issued and transferred tickets)
        const { count: attendeeCount } = await supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', data.id)
          .in('status', ['issued', 'transferred', 'redeemed']);

        // Get posts count - membership-aware for accurate tab numbers
        try {
          // 1) Load organizer member user_ids
          let memberIds: string[] = [];
          if (data.owner_context_type === 'organization' && data.owner_context_id) {
            const { data: members, error: membersError } = await supabase
              .from('org_memberships')
              .select('user_id')
              .eq('org_id', data.owner_context_id as string);
            
            if (membersError) {
              console.error('[EventDetailsPage] Error fetching org members:', membersError);
            } else {
              memberIds = (members ?? []).map((m: any) => m.user_id);
            }
          } else if (data.owner_context_type === 'individual' && data.created_by) {
            // For individual events, creator is the organizer
            memberIds = [data.created_by];
          }

          // 2) Organizer posts count
          if (memberIds.length > 0) {
            const { count: organizerCount, error: organizerError } = await supabase
              .from('event_posts')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', data.id)
              .in('author_user_id', memberIds);
            
            if (organizerError) {
              console.error('[EventDetailsPage] Error fetching organizer posts:', organizerError);
              setPostsCount(0);
            } else {
              setPostsCount(organizerCount || 0);
            }
          } else {
            setPostsCount(0);
          }

          // 3) Tagged (attendee) posts count - posts NOT by organizers
          if (memberIds.length > 0) {
            // Get all posts first, then filter out organizer posts
            const { data: allPosts, error: allPostsError } = await supabase
              .from('event_posts')
              .select('author_user_id')
              .eq('event_id', data.id);
            
            if (allPostsError) {
              console.error('[EventDetailsPage] Error fetching all posts:', allPostsError);
              setTaggedCount(0);
            } else {
              // Filter out organizer posts
              const taggedPosts = (allPosts || []).filter(
                post => !memberIds.includes(post.author_user_id)
              );
              setTaggedCount(taggedPosts.length);
            }
          } else {
            // If no org members, all posts are "tagged"
            const { count: totalCount, error: totalError } = await supabase
              .from('event_posts')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', data.id);
            
            if (totalError) {
              console.error('[EventDetailsPage] Error fetching total posts:', totalError);
              setTaggedCount(0);
            } else {
              setTaggedCount(totalCount || 0);
            }
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
          
          // Check if column exists by trying to query it
          try {
            const { data: goingData } = await supabase
              .from('saved_events')
              .select('id, is_going')
              .eq('user_id', user.id)
              .eq('event_id', data.id)
              .maybeSingle();
            
            if (goingData) {
              setIsGoing(goingData.is_going || false);
            }
          } catch (e) {
            // Column doesn't exist yet, ignore
            console.log('is_going column not yet added');
          }
        } else {
          setIsSaved(false);
        }
        
        // Get count of people going (if column exists)
        try {
          const { count: goingCountData } = await supabase
            .from('saved_events')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', data.id)
            .eq('is_going', true);
          
          setGoingCount(goingCountData || 0);
        } catch (e) {
          // Column doesn't exist yet
          setGoingCount(0);
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
  
  const handleToggleGoing = async () => {
    if (!user || !event) {
      // Prompt to sign in
      toast({
        title: 'Sign in required',
        description: 'Sign in to let others know you\'re going',
      });
      navigate('/auth');
      return;
    }
    
    try {
      if (isGoing) {
        // Remove going status
        const { error } = await supabase
          .from('saved_events')
          .update({ is_going: false })
          .eq('user_id', user.id)
          .eq('event_id', event.id);
        
        if (error) throw error;
        
        setIsGoing(false);
        setGoingCount(prev => Math.max(0, prev - 1));
        
        toast({
          title: 'Removed',
          description: 'Removed from your going list',
        });
      } else {
        // Mark as going (and save event if not already)
        // First check if saved_events record exists
        const { data: existing } = await supabase
          .from('saved_events')
          .select('id')
          .eq('user_id', user.id)
          .eq('event_id', event.id)
          .maybeSingle();
        
        if (existing) {
          // Update existing record
          const { error } = await supabase
            .from('saved_events')
            .update({ is_going: true })
            .eq('id', existing.id);
          
          if (error) throw error;
        } else {
          // Insert new record
          const { error } = await supabase
            .from('saved_events')
            .insert({
              user_id: user.id,
              event_id: event.id,
              is_going: true,
              saved_at: new Date().toISOString()
            });
          
          if (error) throw error;
        }
        
        setIsGoing(true);
        setIsSaved(true);
        setGoingCount(prev => prev + 1);
        
        const newCount = goingCount + 1;
        toast({
          title: '✓ You\'re going!',
          description: newCount > 1
            ? `${newCount} ${newCount === 2 ? 'person' : 'people'} say they're going`
            : 'You\'ll be the first one there!',
        });
        
        // Upsell tickets if they don't have any
        setTimeout(() => {
          toast({
            title: '🎟️ Get your tickets',
            description: 'Reserve your spot - tickets selling fast!',
            action: (
              <ToastAction altText="Get Tickets" onClick={() => setTicketModalOpen(true)}>
                Get Tickets
              </ToastAction>
            ),
            duration: 8000
          });
        }, 2000);
      }
    } catch (error: any) {
      console.error('[EventDetailsPage] Error toggling going status:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update going status',
        variant: 'destructive'
      });
    }
  };

  // Loading state
  if (loading || !event) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <BrandedSpinner size="xl" showLogo text="Loading event..." />
      </div>
    );
  }

  // Optimize hero image for LCP
  const optimizedHeroImage = optimizeSupabaseImage(event.coverImage, IMAGE_PRESETS.hero);

  return (
    <>
      {/* Preload LCP image for faster paint */}
      <Helmet>
        <link rel="preload" as="image" href={optimizedHeroImage} fetchpriority="high" />
        <title>{event.title} | YardPass</title>
        <meta name="description" content={event.description.substring(0, 160)} />
      </Helmet>

      <div className="min-h-screen bg-background pb-nav">
        {/* Hero Image with Title Overlay - MODERNIZED */}
        <div className="relative h-64 overflow-hidden sm:h-80 md:h-96">
        <div className="absolute inset-0">
          <ImageWithFallback
            src={optimizedHeroImage}
            alt={event.title}
            className="h-full w-full object-cover"
            fetchPriority="high"
            showBlurPlaceholder={true}
          />
        </div>
        
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
                src={optimizeSupabaseImage(event.organizer.avatar, IMAGE_PRESETS.avatar)}
                alt={event.organizer.name}
                className="h-6 w-6 rounded-full object-cover ring-1 ring-white/30"
                disableResponsive={true}
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
              {tab === 'tagged' && (
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
                      <LazyMapboxEventMap 
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
                <h3 className="text-lg font-semibold text-foreground">Event Posts</h3>
              </div>
              <p className="text-sm text-foreground/60 mb-4">
                Updates and moments from organizers and attendees
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

      {/* Sticky Footer - Actions CTA - Always visible above bottom nav */}
      {event.ticketTiers && event.ticketTiers.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-[110] border-t border-border shadow-lg bg-background/95 backdrop-blur-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3 max-w-screen-xl mx-auto">
            {/* Going Counter */}
            <button 
              onClick={handleToggleGoing}
              className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 transition-all active:scale-95 min-w-[100px] ${
                isGoing
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-border bg-background/50 hover:bg-muted'
              }`}
            >
              <span className={`text-xs font-medium ${isGoing ? 'text-primary' : 'text-foreground/60'}`}>
                {isGoing ? '✓ Going' : 'Interested?'}
              </span>
              <span className="text-[10px] text-foreground/50">
                {goingCount > 0 
                  ? `${goingCount} ${goingCount === 1 ? 'person says' : 'people say'} they're going`
                  : 'Be the first'}
              </span>
            </button>
            
            {/* Price & Tickets */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground/70 font-medium truncate">Starting from</p>
              <p className="text-lg font-bold text-foreground truncate sm:text-xl">
                ${Math.min(...event.ticketTiers.map(t => t.price)).toFixed(2)}
              </p>
            </div>
            
            <button 
              onClick={handleGetTickets}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-95 sm:px-8 sm:py-3.5 sm:text-base"
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
    </>
  );
}

export default EventDetailsPageIntegrated;

