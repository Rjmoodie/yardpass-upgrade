import { useState, useEffect, useContext } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarDays, Users, DollarSign, Eye, Heart, Share2, Plus, ArrowLeft, Settings, MessageSquare, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import AnalyticsHub from '@/components/AnalyticsHub';
import { OrganizerRolesPanel } from '@/components/organizer/OrganizerRolesPanel';
import { OrganizerCommsPanel } from '@/components/organizer/OrganizerCommsPanel';
import EventManagement from './EventManagement';

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

const mockEvents: Event[] = [
  {
    id: '1',
    title: 'Summer Music Festival',
    status: 'published',
    date: '2024-07-15',
    attendees: 1250,
    revenue: 125000,
    views: 45000,
    likes: 2300,
    shares: 450,
    tickets_sold: 1250,
    capacity: 1500,
    conversion_rate: 83.3,
    engagement_rate: 5.1,
    created_at: '2024-01-15T10:00:00Z',
    start_at: '2024-07-15T18:00:00Z',
    end_at: '2024-07-15T23:00:00Z',
    venue: 'Central Park',
    category: 'Music',
    cover_image_url: '',
    description: 'Annual summer music festival',
    city: 'New York',
    visibility: 'public'
  },
  {
    id: '2',
    title: 'Tech Conference 2024',
    status: 'draft',
    date: '2024-09-20',
    attendees: 350,
    revenue: 75000,
    views: 28000,
    likes: 1800,
    shares: 320,
    tickets_sold: 350,
    capacity: 500,
    conversion_rate: 70.0,
    engagement_rate: 4.8,
    created_at: '2024-02-20T14:30:00Z',
    start_at: '2024-09-20T09:00:00Z',
    end_at: '2024-09-20T17:00:00Z',
    venue: 'Convention Center',
    category: 'Technology',
    cover_image_url: '',
    description: 'Leading tech conference',
    city: 'San Francisco',
    visibility: 'public'
  },
  {
    id: '3',
    title: 'Art Exhibition',
    status: 'published',
    date: '2024-08-05',
    attendees: 800,
    revenue: 40000,
    views: 15000,
    likes: 950,
    shares: 180,
    tickets_sold: 800,
    capacity: 1000,
    conversion_rate: 80.0,
    engagement_rate: 4.5,
    created_at: '2024-03-10T11:15:00Z',
    start_at: '2024-08-05T10:00:00Z',
    end_at: '2024-08-05T18:00:00Z',
    venue: 'Art Gallery',
    category: 'Art',
    cover_image_url: '',
    description: 'Showcasing local artists',
    city: 'Los Angeles',
    visibility: 'public'
  },
  {
    id: '4',
    title: 'Food Festival',
    status: 'draft',
    date: '2024-10-12',
    attendees: 1500,
    revenue: 60000,
    views: 22000,
    likes: 1200,
    shares: 250,
    tickets_sold: 1500,
    capacity: 2000,
    conversion_rate: 75.0,
    engagement_rate: 4.2,
    created_at: '2024-04-01T09:00:00Z',
    start_at: '2024-10-12T11:00:00Z',
    end_at: '2024-10-12T20:00:00Z',
    venue: 'City Park',
    category: 'Food',
    cover_image_url: '',
    description: 'Celebrating local cuisine',
    city: 'Chicago',
    visibility: 'public'
  }
];

export function OrganizerDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userEvents, setUserEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  // Fetch user's events
  useEffect(() => {
    if (user) {
      fetchUserEvents();
    }
  }, [user]);

  const fetchUserEvents = async () => {
    try {
      console.log('🔍 Fetching events for user:', user?.id);
      setLoading(true);

      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          title,
          start_at,
          end_at,
          venue,
          category,
          cover_image_url,
          created_at,
          description,
          city,
          visibility,
          ticket_tiers (
            id,
            name,
            price_cents,
            quantity,
            badge_label
          )
        `)
        .eq('created_by', user?.id)
        .order('created_at', { ascending: false });

      console.log('📊 Events query result:', { data, error, count: data?.length });

      if (error) {
        console.error('Error loading user events:', error);
        setUserEvents(mockEvents);
      } else {
        // Transform the data to match our interface
        const transformedEvents = (data || []).map(event => {
          const ticketTiers = event.ticket_tiers || [];
          const totalCapacity = ticketTiers.reduce((sum: number, tier: any) => sum + (tier.quantity || 0), 0);
          const totalSold = ticketTiers.reduce((sum: number, tier: any) => sum + (tier.sold_count || 0), 0);
          const totalRevenue = ticketTiers.reduce((sum: number, tier: any) => sum + ((tier.price_cents || 0) * (tier.sold_count || 0)), 0);
          
          return {
            id: event.id,
            title: event.title,
            status: 'published',
            date: new Date(event.start_at).toLocaleDateString(),
            attendees: totalSold,
            revenue: totalRevenue / 100, // Convert cents to dollars
            views: Math.floor(Math.random() * 10000) + 1000, // Mock for now
            likes: Math.floor(Math.random() * 500) + 50,
            shares: Math.floor(Math.random() * 100) + 10,
            tickets_sold: totalSold,
            capacity: totalCapacity,
            conversion_rate: totalSold > 0 ? (totalSold / totalCapacity) * 100 : 0,
            engagement_rate: Math.random() * 10 + 2, // Mock for now
            created_at: event.created_at || new Date().toISOString(),
            start_at: event.start_at,
            end_at: event.end_at,
            venue: event.venue || '',
            category: event.category || '',
            cover_image_url: event.cover_image_url || '',
            description: event.description || '',
            city: event.city || '',
            visibility: event.visibility || 'public'
          };
        });
        
        setUserEvents(transformedEvents.length ? transformedEvents : mockEvents);
      }
    } catch (error) {
      console.error('Error in fetchUserEvents:', error);
      setUserEvents(mockEvents);
    } finally {
      setLoading(false);
    }
  };

  const handleEventSelect = (event: Event) => {
    console.log('🎯 Event selected:', event);
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

  const calculateTotals = () => {
    return userEvents.reduce((acc, event) => ({
      totalRevenue: acc.totalRevenue + event.revenue,
      totalAttendees: acc.totalAttendees + event.attendees,
      totalViews: acc.totalViews + event.views,
      totalLikes: acc.totalLikes + event.likes
    }), { totalRevenue: 0, totalAttendees: 0, totalViews: 0, totalLikes: 0 });
  };

  const totals = calculateTotals();

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
      fetchUserEvents();
      
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
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Organizer Dashboard</h1>
          <p className="text-muted-foreground">Manage your events and track performance</p>
        </div>
        <Button className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Create Event
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-muted/50 rounded-lg">
          <TabsTrigger 
            value="dashboard" 
            className="flex flex-col items-center gap-1 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs font-medium">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger 
            value="events" 
            className="flex flex-col items-center gap-1 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all"
          >
            <CalendarDays className="h-4 w-4" />
            <span className="text-xs font-medium">Events</span>
          </TabsTrigger>
          <TabsTrigger 
            value="teams" 
            className="flex flex-col items-center gap-1 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all"
          >
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Teams</span>
          </TabsTrigger>
          <TabsTrigger 
            value="analytics" 
            className="flex flex-col items-center gap-1 py-3 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md transition-all"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs font-medium">Analytics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userEvents.length}</div>
                <p className="text-xs text-muted-foreground">+2 from last month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${totals.totalRevenue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">+15% from last month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Attendees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totals.totalAttendees.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">+8% from last month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totals.totalViews.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">+12% from last month</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Events */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userEvents.slice(0, 5).map((event) => (
                  <div key={event.id} 
                       className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                       onClick={() => handleEventSelect(event)}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{event.title}</h3>
                        <p className="text-sm text-muted-foreground">{new Date(event.start_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mt-2 sm:mt-0">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{event.attendees}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span>${event.revenue.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          <span>{event.views.toLocaleString()}</span>
                        </div>
                      </div>
                      <Badge variant={event.status === 'published' ? 'default' : 'secondary'}>
                        {event.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-semibold">My Events</h2>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create New Event
            </Button>
          </div>

          <div className="grid gap-4">
            {userEvents.map((event) => (
              <Card key={event.id} className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleEventSelect(event)}>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{event.title}</h3>
                        <Badge variant={event.status === 'published' ? 'default' : 'secondary'}>
                          {event.status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mb-4">{event.date}</p>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Attendees</p>
                          <p className="text-lg font-semibold">{event.attendees}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Revenue</p>
                          <p className="text-lg font-semibold">${event.revenue.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Views</p>
                          <p className="text-lg font-semibold">{event.views.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Conversion</p>
                          <p className="text-lg font-semibold">{event.conversion_rate.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button variant="outline" size="sm">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Button>
                      <Button variant="outline" size="sm">
                        <BarChart3 className="mr-2 h-4 w-4" />
                        Analytics
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <OrganizerRolesPanel eventId={userEvents[0]?.id || ''} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsHub />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default OrganizerDashboard;
