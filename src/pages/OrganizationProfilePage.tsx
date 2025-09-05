import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Building2, Shield, Calendar, MapPin, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Organization {
  id: string;
  name: string;
  handle: string | null;
  logo_url: string | null;
  verification_status: string;
  created_at: string;
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  city: string | null;
  venue: string | null;
  cover_image_url: string | null;
  category: string | null;
}

export default function OrganizationProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchOrganizationData();
    }
  }, [id]);

  const fetchOrganizationData = async () => {
    try {
      setLoading(true);

      // Fetch organization details
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single();

      if (orgError) throw orgError;
      setOrganization(org);

      // Fetch organization's events
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, title, description, start_at, city, venue, cover_image_url, category')
        .eq('owner_context_type', 'organization')
        .eq('owner_context_id', id)
        .eq('visibility', 'public')
        .order('start_at', { ascending: true });

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (eventId: string) => {
    navigate(`/event/${eventId}`);
  };

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">Organization Not Found</h1>
        <p className="text-muted-foreground mb-4">The organization you're looking for doesn't exist.</p>
        <Button onClick={() => navigate('/')}>Return Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="rounded-full w-10 h-10 p-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={organization.logo_url || undefined} />
                  <AvatarFallback className="text-xl">
                    <Building2 className="w-8 h-8" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold">{organization.name}</h1>
                    {organization.verification_status === 'verified' && (
                      <Badge variant="secondary" className="text-xs">
                        <Shield className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  {organization.handle && (
                    <p className="text-muted-foreground">@{organization.handle}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Organization since {new Date(organization.created_at).getFullYear()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Events Section */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Events</h2>
              <Badge variant="outline">{events.length}</Badge>
            </div>

            {events.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Events Yet</h3>
                  <p className="text-muted-foreground text-center">
                    This organization hasn't created any public events yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {events.map((event) => (
                  <Card 
                    key={event.id} 
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => handleEventClick(event.id)}
                  >
                    {event.cover_image_url && (
                      <div className="aspect-video bg-muted overflow-hidden rounded-t-lg">
                        <img 
                          src={event.cover_image_url} 
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg line-clamp-2">{event.title}</CardTitle>
                        {event.category && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {event.category}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {event.description && (
                        <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(event.start_at).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        {(event.venue || event.city) && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span>{[event.venue, event.city].filter(Boolean).join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}