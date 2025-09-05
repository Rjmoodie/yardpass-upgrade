import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { updateMetaTags } from '@/utils/meta';
import { supabase } from '@/integrations/supabase/client';
import { EventDetail } from '@/components/EventDetail';
import { EventFeed } from '@/components/EventFeed';
import { toast } from '@/hooks/use-toast';
import { routes } from '@/lib/routes';
import { capture } from '@/lib/analytics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, Calendar, Users, Share, Heart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { useAuth } from '@/contexts/AuthContext';

interface Event {
  id: string;
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  venue?: string;
  address?: string;
  city?: string;
  category?: string;
  cover_image_url?: string;
  slug?: string;
  owner_context_type: string;
  owner_context_id: string;
  created_by: string;
  visibility: string;
  attendee_count?: number;
  likes?: number;
  shares?: number;
}

interface TicketTier {
  id: string;
  name: string;
  price_cents: number;
  badge_label: string;
  quantity: number;
  max_per_order: number;
  status: string;
}

export default function EventsPage() {
  const { slug } = useParams<{ slug: string }>();

  // Update meta tags for event
  useEffect(() => {
    if (slug) {
      updateMetaTags({
        title: `Event: ${slug} on YardPass`,
        description: `Join this amazing event on YardPass`,
        url: `https://yardpass.com/events/${slug}`,
        type: 'article'
      });
    }
  }, [slug]);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);

  // Get the active tab from URL hash
  const getActiveTab = () => {
    const hash = location.hash.replace('#', '');
    return ['details', 'tickets', 'posts'].includes(hash) ? hash : 'details';
  };

  const [activeTab, setActiveTab] = useState(getActiveTab());

  useEffect(() => {
    setActiveTab(getActiveTab());
  }, [location.hash]);

  useEffect(() => {
    console.log('[EventsPage] Slug parameter:', slug);
    if (slug) {
      fetchEvent();
    }
  }, [slug]);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      
      // Try to fetch by slug first, then fallback to ID
      let query = supabase
        .from('events')
        .select(`
          *,
          user_profiles!events_created_by_fkey (
            display_name,
            photo_url,
            verification_status
          ),
          organizations!events_owner_context_id_fkey (
            name,
            logo_url,
            verification_status
          )
        `);

      // If slug looks like a UUID, query by ID, otherwise by slug
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug!);
      
      console.log('[EventsPage] Searching for:', slug, 'isUUID:', isUUID);
      
      if (isUUID) {
        query = query.eq('id', slug);
      } else {
        query = query.eq('slug', slug);
      }

      const { data: eventData, error: eventError } = await query.single();

      if (eventError) {
        console.error('Error fetching event:', eventError);
        throw eventError;
      }

      setEvent(eventData);

      // Fetch ticket tiers
      const { data: tierData, error: tierError } = await supabase
        .from('ticket_tiers')
        .select('*')
        .eq('event_id', eventData.id)
        .order('sort_index');

      if (tierError) {
        console.error('Error fetching ticket tiers:', tierError);
      } else {
        setTicketTiers(tierData || []);
      }

      // Track event view
      capture('event_view', { 
        event_id: eventData.id,
        event_title: eventData.title,
        source: 'direct_link'
      });

    } catch (error) {
      console.error('Error loading event:', error);
      toast({
        title: "Event Not Found",
        description: "The event you're looking for doesn't exist or has been removed.",
        variant: "destructive",
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    navigate(`${location.pathname}#${tab}`, { replace: true });
  };

  const handleBack = () => {
    navigate('/');
  };

  const getOrganizerName = () => {
    if (event?.owner_context_type === 'organization') {
      return (event as any).organizations?.name || 'Organization';
    } else {
      return (event as any).user_profiles?.display_name || 'Organizer';
    }
  };

  const getOrganizerPhoto = () => {
    if (event?.owner_context_type === 'organization') {
      return (event as any).organizations?.logo_url;
    } else {
      return (event as any).user_profiles?.photo_url;
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">Event Not Found</h1>
        <p className="text-muted-foreground mb-4">The event you're looking for doesn't exist.</p>
        <Button onClick={handleBack}>Return Home</Button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="relative">
        <ImageWithFallback
          src={event.cover_image_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30'}
          alt={event.title}
          className="w-full h-64 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        <Button
          onClick={handleBack}
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 bg-black/50 text-white hover:bg-black/70"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="absolute top-4 right-4 flex gap-2">
          <Button
            onClick={() => setIsLiked(!isLiked)}
            variant="ghost"
            size="icon"
            className={`${isLiked ? 'bg-red-500 hover:bg-red-600' : 'bg-black/50 hover:bg-black/70'} text-white`}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-white' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="bg-black/50 text-white hover:bg-black/70"
          >
            <Share className="w-5 h-5" />
          </Button>
        </div>

        <div className="absolute bottom-4 left-4 right-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            {event.category && (
              <Badge variant="secondary" className="bg-primary text-primary-foreground">
                {event.category}
              </Badge>
            )}
            <Badge variant="outline" className="border-white/30 text-white bg-black/30">
              {event.attendee_count || 0} attending
            </Badge>
          </div>
          <h1 className="text-2xl font-bold mb-2">{event.title}</h1>
          <div className="flex items-center gap-2 text-sm">
            <Avatar className="w-6 h-6">
              <AvatarImage src={getOrganizerPhoto()} />
              <AvatarFallback className="text-xs bg-white/20 text-white">
                {getOrganizerName().charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span>by {getOrganizerName()}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3 sticky top-0 z-10 bg-background border-b">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="posts">Posts</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="details" className="p-4 space-y-4 m-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <div>
                    <div className="text-foreground font-medium">
                      {new Date(event.start_at).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    <div>
                      {new Date(event.start_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                      {event.end_at && (
                        ` - ${new Date(event.end_at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })}`
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <div>
                    <div className="text-foreground font-medium">
                      {event.venue || 'TBA'}
                    </div>
                    {event.address && (
                      <div>{event.address}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">About This Event</h3>
                  <p className="text-sm leading-relaxed">
                    {event.description || 'No description available.'}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Organizer</h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={getOrganizerPhoto()} />
                        <AvatarFallback>{getOrganizerName().charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{getOrganizerName()}</div>
                        <div className="text-xs text-muted-foreground">Event Organizer</div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">Follow</Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tickets" className="p-4 space-y-4 m-0">
              <div className="space-y-3">
                {ticketTiers.length > 0 ? (
                  ticketTiers.map((tier) => (
                    <div
                      key={tier.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{tier.name}</h3>
                            <Badge variant="outline" className="text-xs">{tier.badge_label}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {tier.quantity} available • Max {tier.max_per_order} per order
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">
                            ${(tier.price_cents / 100).toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">per ticket</div>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 mb-3">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all" 
                          style={{ width: `${Math.min(100, (tier.quantity / (tier.quantity + 100)) * 100)}%` }}
                        />
                      </div>
                      <Button 
                        className="w-full"
                        disabled={tier.status !== 'active' || tier.quantity === 0}
                      >
                        {tier.quantity === 0 ? 'Sold Out' : 'Select Tickets'}
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No tickets available for this event.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="posts" className="m-0">
              <EventFeed 
                eventId={event.id}
                onEventClick={(eventId) => navigate(routes.event(eventId))}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}