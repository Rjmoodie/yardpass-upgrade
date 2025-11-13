import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, Calendar, MapPin, Users, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { useToast } from '@/hooks/use-toast';

interface EventForScanning {
  id: string;
  title: string;
  cover_image_url: string | null;
  start_at: string;
  venue: string | null;
  address: string | null;
  attendee_count: number;
}

export default function ScannerSelectEventPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [events, setEvents] = useState<EventForScanning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrganizerEvents = async () => {
      if (!user?.id) {
        navigate('/auth');
        return;
      }

      try {
        setLoading(true);

        // Get events where user is the creator or has organizer role
        const { data, error } = await supabase
          .from('events')
          .select(`
            id,
            title,
            cover_image_url,
            start_at,
            venue,
            address
          `)
          .eq('created_by', user.id)
          .order('start_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        // For each event, get ticket count
        const eventsWithCounts = await Promise.all(
          (data || []).map(async (event) => {
            const { count } = await supabase
              .from('tickets')
              .select('*', { count: 'exact', head: true })
              .eq('event_id', event.id);

            return {
              ...event,
              attendee_count: count || 0,
            };
          })
        );

        setEvents(eventsWithCounts);
      } catch (error) {
        console.error('Error loading events:', error);
        toast({
          title: 'Error',
          description: 'Failed to load your events',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadOrganizerEvents();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-border/10 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav pt-4 sm:pt-6">
      {/* Header */}
      <div className="mb-6 px-3 sm:px-4 md:px-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ScanLine className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Scanner</h1>
            <p className="text-sm text-foreground/60 sm:text-base">
              Select an event to scan tickets
            </p>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="px-3 sm:px-4 md:px-6">
        {events.length === 0 ? (
          <div className="rounded-2xl border border-border/10 bg-white/5 p-12 text-center backdrop-blur-xl sm:rounded-3xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
              <ScanLine className="h-8 w-8 text-foreground/30" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-foreground">No events yet</h3>
            <p className="text-sm text-foreground/60">
              Create an event first to start scanning tickets
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {events.map((event) => {
              const eventDate = new Date(event.start_at);
              const isUpcoming = eventDate > new Date();
              const isPast = !isUpcoming;

              return (
                <button
                  key={event.id}
                  onClick={() => navigate(`/scanner/${event.id}`)}
                  className="group w-full overflow-hidden rounded-2xl border border-border/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl transition-all hover:border-border/20 hover:shadow-xl sm:rounded-3xl text-left"
                >
                  <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
                    {/* Event Image */}
                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-24">
                      <ImageWithFallback
                        src={event.cover_image_url || ''}
                        alt={event.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      {isPast && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-xs font-semibold text-white">Past</span>
                        </div>
                      )}
                    </div>

                    {/* Event Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="mb-1 text-base font-bold text-foreground line-clamp-1 sm:text-lg">
                        {event.title}
                      </h3>

                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-foreground/70 sm:text-sm">
                          <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span>
                            {eventDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>

                        {event.venue && (
                          <div className="flex items-center gap-1.5 text-xs text-foreground/70 sm:text-sm">
                            <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span className="line-clamp-1">{event.venue}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-xs text-foreground/70 sm:text-sm">
                          <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span>{event.attendee_count} ticket{event.attendee_count !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>

                    {/* Scan Arrow */}
                    <div className="flex flex-shrink-0 items-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 transition-all group-hover:bg-primary group-hover:scale-110">
                        <ChevronRight className="h-5 w-5 text-primary group-hover:text-primary-foreground" />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


