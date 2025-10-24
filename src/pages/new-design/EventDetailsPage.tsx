import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Share2, Heart, Calendar, Clock, MapPin, Users, DollarSign, Info, Check } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EventDetails {
  id: string;
  title: string;
  coverImage: string;
  organizer: {
    id: string;
    name: string;
    avatar: string;
    verified: boolean;
  };
  date: string;
  time: string;
  location: string;
  venue: string;
  description: string;
  categories: string[];
  attendees: number;
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
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'about' | 'tickets' | 'attendees'>('about');
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  // Load event details
  useEffect(() => {
    const loadEvent = async () => {
      if (!eventId) return;

      try {
        setLoading(true);

        const { data, error } = await supabase
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
            cover_image_url,
            category,
            created_by,
            user_profiles!events_created_by_fkey (
              user_id,
              display_name,
              photo_url,
              verified
            ),
            ticket_tiers!fk_ticket_tiers_event_id (
              id,
              name,
              price_cents,
              quantity,
              sold_count,
              description,
              benefits
            )
          `)
          .eq('id', eventId)
          .single();

        if (error) throw error;

        // Get attendee count
        const { count: attendeeCount } = await supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('status', 'active');

        // Check if user has saved this event
        if (user) {
          const { data: savedData } = await supabase
            .from('saved_events')
            .select('id')
            .eq('user_id', user.id)
            .eq('event_id', eventId)
            .maybeSingle();
          
          setIsSaved(!!savedData);
        }

        const transformed: EventDetails = {
          id: data.id,
          title: data.title,
          coverImage: data.cover_image_url || '',
          organizer: {
            id: data.created_by,
            name: data.user_profiles?.display_name || 'Organizer',
            avatar: data.user_profiles?.photo_url || '',
            verified: data.user_profiles?.verified || false
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
          description: data.description || '',
          categories: data.category ? [data.category] : [],
          attendees: attendeeCount || 0,
          ticketTiers: (data.ticket_tiers || []).map((tier: any) => ({
            id: tier.id,
            name: tier.name,
            price: tier.price_cents / 100,
            available: tier.quantity - (tier.sold_count || 0),
            total: tier.quantity,
            benefits: tier.benefits || tier.description?.split('\n') || []
          })),
          isSaved
        };

        setEvent(transformed);
      } catch (error) {
        console.error('Error loading event:', error);
        toast({
          title: 'Error',
          description: 'Failed to load event details',
          variant: 'destructive'
        });
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

  const handlePurchaseTicket = async (tierId: string) => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to purchase tickets',
      });
      navigate('/auth');
      return;
    }

    // Navigate to checkout or open ticket modal
    navigate(`/checkout/${eventId}/${tierId}`);
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
      {/* Hero Image */}
      <div className="relative h-64 overflow-hidden sm:h-80 md:h-96">
        <ImageWithFallback
          src={event.coverImage}
          alt={event.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black" />
        
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
      </div>

      {/* Event Header */}
      <div className="px-3 sm:px-4 md:px-6">
        <h1 className="mb-3 text-2xl font-bold text-white sm:text-3xl md:text-4xl">{event.title}</h1>
        
        {/* Organizer */}
        <button 
          onClick={() => navigate(`/u/${event.organizer.id}`)}
          className="mb-4 flex items-center gap-3 text-left transition-opacity hover:opacity-80"
        >
          <ImageWithFallback
            src={event.organizer.avatar}
            alt={event.organizer.name}
            className="h-10 w-10 rounded-full object-cover sm:h-12 sm:w-12"
          />
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-white sm:text-base">
              {event.organizer.name}
              {event.organizer.verified && (
                <Check className="h-4 w-4 rounded-full bg-blue-500 p-0.5 text-white" />
              )}
            </p>
            <p className="text-xs text-white/60">Event Organizer</p>
          </div>
        </button>

        {/* Event Info Cards */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl sm:p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF8C00]/20">
              <Calendar className="h-5 w-5 text-[#FF8C00]" />
            </div>
            <div>
              <p className="text-xs text-white/50 sm:text-sm">Date & Time</p>
              <p className="text-sm font-medium text-white sm:text-base">{event.date} • {event.time}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl sm:p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF8C00]/20">
              <MapPin className="h-5 w-5 text-[#FF8C00]" />
            </div>
            <div>
              <p className="text-xs text-white/50 sm:text-sm">Location</p>
              <p className="text-sm font-medium text-white sm:text-base">{event.venue}</p>
              <p className="text-xs text-white/60">{event.location}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl sm:p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF8C00]/20">
              <Users className="h-5 w-5 text-[#FF8C00]" />
            </div>
            <div>
              <p className="text-xs text-white/50 sm:text-sm">Attendees</p>
              <p className="text-sm font-medium text-white sm:text-base">{event.attendees.toLocaleString()} going</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-white/10">
          {(['about', 'tickets', 'attendees'] as const).map((tab) => (
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
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'about' && (
          <div className="space-y-4">
            {/* Categories */}
            {event.categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {event.categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/80"
                  >
                    {category}
                  </span>
                ))}
              </div>
            )}

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
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="space-y-3">
            {event.ticketTiers.map((tier) => {
              const isSelected = selectedTier === tier.id;
              const isSoldOut = tier.available === 0;

              return (
                <button
                  key={tier.id}
                  onClick={() => !isSoldOut && setSelectedTier(isSelected ? null : tier.id)}
                  disabled={isSoldOut}
                  className={`w-full overflow-hidden rounded-2xl border text-left transition-all sm:rounded-3xl ${
                    isSelected
                      ? 'border-[#FF8C00] bg-white/10'
                      : isSoldOut
                      ? 'border-white/5 bg-white/5 opacity-50'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="p-4 sm:p-5">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h4 className="mb-1 text-base font-bold text-white sm:text-lg">{tier.name}</h4>
                        <p className="text-sm text-white/60">
                          {isSoldOut ? 'Sold Out' : `${tier.available} of ${tier.total} available`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-[#FF8C00] sm:text-2xl">
                          ${tier.price.toFixed(2)}
                        </p>
                        <p className="text-xs text-white/50">per ticket</p>
                      </div>
                    </div>

                    {/* Benefits */}
                    {tier.benefits.length > 0 && (
                      <div className="space-y-1.5">
                        {tier.benefits.map((benefit, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-white/70 sm:text-sm">
                            <Check className="mt-0.5 h-3.5 w-3.5 text-green-400 sm:h-4 sm:w-4" />
                            <span>{benefit}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Select Button */}
                    {isSelected && !isSoldOut && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePurchaseTicket(tier.id);
                          }}
                          className="w-full rounded-full bg-[#FF8C00] py-3 text-sm font-semibold text-white transition-all hover:bg-[#FF9D1A] active:scale-95"
                        >
                          Get Tickets
                        </button>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}

            {event.ticketTiers.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
                <p className="text-sm text-white/60">No tickets available for this event</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'attendees' && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
            <Users className="mx-auto mb-3 h-12 w-12 text-white/30" />
            <p className="text-base font-semibold text-white">{event.attendees.toLocaleString()} attendees</p>
            <p className="mt-1 text-sm text-white/60">Attendee list available soon</p>
          </div>
        )}
      </div>

      {/* Sticky Footer - Get Tickets CTA */}
      {activeTab !== 'tickets' && event.ticketTiers.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/80 p-3 backdrop-blur-xl sm:p-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex-1">
              <p className="text-xs text-white/60 sm:text-sm">Starting from</p>
              <p className="text-lg font-bold text-white sm:text-xl">
                ${Math.min(...event.ticketTiers.map(t => t.price)).toFixed(2)}
              </p>
            </div>
            <button 
              onClick={() => setActiveTab('tickets')}
              className="rounded-full bg-[#FF8C00] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#FF9D1A] active:scale-95 sm:px-8 sm:py-3.5 sm:text-base"
            >
              Get Tickets
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventDetailsPageIntegrated;

