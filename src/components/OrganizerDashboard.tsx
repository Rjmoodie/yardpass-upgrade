import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CalendarDays, Users, DollarSign, Plus, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import AnalyticsHub from '@/components/AnalyticsHub';
import { PayoutPanel } from '@/components/PayoutPanel';
import { OrganizerCommsPanel } from '@/components/organizer/OrganizerCommsPanel';
import EventManagement from './EventManagement';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { EventsList } from '@/components/dashboard/EventsList';
import { LoadingSpinner } from '@/components/dashboard/LoadingSpinner';
import { useOrganizerData } from '@/hooks/useOrganizerData';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';

interface Event {
  id: string;
  title: string;
  status: string;
  date: string;
  attendees: number;
  revenue: number;
  views: number;
  likes: number;
  shares: number;
  tickets_sold: number;
  capacity: number;
  conversion_rate: number;
  engagement_rate: number;
  created_at: string;
  start_at: string;
  end_at: string;
  venue?: string;
  category?: string;
  cover_image_url?: string;
  description?: string;
  city?: string;
  visibility?: string;
}

export function OrganizerDashboard() {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'dashboard';
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [user, setUser] = useState<any>(null);
  const { trackEvent } = useAnalyticsIntegration();
  
  // Use the new hook for data management
  const { userEvents, loading, refetchEvents } = useOrganizerData(user);
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  // Update active tab when URL search params change
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') || 'dashboard';
    setActiveTab(tabFromUrl);
  }, [searchParams]);


  const handleEventSelect = (event: Event) => {
    console.log('🎯 Event selected:', event);
    trackEvent('dashboard_event_selected', {
      event_id: event.id,
      user_id: user?.id,
      timestamp: Date.now()
    });
    setSelectedEvent(event);
  };

  // If an event is selected, show EventManagement
  if (selectedEvent) {
    const eventWithDetails = {
      ...selectedEvent,
      created_at: selectedEvent.created_at || new Date().toISOString(),
      start_at: selectedEvent.start_at,
      end_at: selectedEvent.end_at,
      venue: selectedEvent.venue || '',
      category: selectedEvent.category || '',
      cover_image_url: selectedEvent.cover_image_url || '',
      description: selectedEvent.description || '',
      city: selectedEvent.city || '',
      visibility: selectedEvent.visibility || 'public'
    };

    return (
      <div className="container mx-auto p-6">
        <EventManagement 
          event={{
            ...eventWithDetails,
            organizer: 'User',
            organizerId: user?.id || '',
            startAtISO: eventWithDetails.start_at,
            dateLabel: new Date(eventWithDetails.start_at).toLocaleDateString(),
            location: eventWithDetails.venue || '',
            coverImage: eventWithDetails.cover_image_url || '',
            ticketTiers: [],
            attendeeCount: eventWithDetails.attendees,
            likes: eventWithDetails.likes,
            shares: eventWithDetails.shares,
            posts: []
          }} 
          onBack={() => setSelectedEvent(null)} 
        />
      </div>
    );
  }


  const createNewEvent = async (values: any) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .insert({
          title: values.title,
          description: values.description,
          start_at: values.start_at,
          end_at: values.end_at,
          venue: values.venue,
          category: values.category,
          created_by: user?.id,
          owner_context_type: 'individual',
          owner_context_id: user?.id,
          visibility: 'public'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Event created successfully."
      });

      // Refresh events list
      refetchEvents();
      
      return data;
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create event.",
        variant: "destructive"
      });
      throw error;
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Organizer Dashboard</h1>
          <p className="text-muted-foreground">Manage your events and track performance</p>
        </div>
        <Button 
          className="w-full sm:w-auto" 
          onClick={() => window.location.href = '/create-event'}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Event
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 h-auto p-1">
          <TabsTrigger value="dashboard" className="flex-col h-auto py-2 sm:py-3 px-1 sm:px-2">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mb-1" />
            <span className="text-xs">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="flex-col h-auto py-2 sm:py-3 px-1 sm:px-2">
            <CalendarDays className="h-3 w-3 sm:h-4 sm:w-4 mb-1" />
            <span className="text-xs">Events</span>
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex-col h-auto py-2 sm:py-3 px-1 sm:px-2">
            <Users className="h-3 w-3 sm:h-4 sm:w-4 mb-1" />
            <span className="text-xs">Teams</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex-col h-auto py-2 sm:py-3 px-1 sm:px-2">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mb-1" />
            <span className="text-xs">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex-col h-auto py-2 sm:py-3 px-1 sm:px-2">
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 mb-1" />
            <span className="text-xs">Payouts</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <DashboardOverview events={userEvents} onEventSelect={handleEventSelect} />
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          <EventsList events={userEvents} onEventSelect={handleEventSelect} />
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <OrganizerCommsPanel eventId={userEvents[0]?.id || ''} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsHub />
        </TabsContent>

        <TabsContent value="payouts" className="space-y-6">
          <PayoutPanel contextType="individual" contextId={user?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default OrganizerDashboard;
