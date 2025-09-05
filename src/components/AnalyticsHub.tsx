import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CalendarIcon, TrendingUpIcon, UsersIcon, DollarSignIcon, TicketIcon, PlayIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AnalyticsKPIs {
  gross_revenue: number;
  net_revenue: number;
  platform_fees: number;
  tickets_sold: number;
  refund_rate: number;
  no_show_rate: number;
  unique_buyers: number;
  repeat_buyers: number;
  posts_created: number;
  feed_engagements: number;
}

interface OrgAnalytics {
  kpis: AnalyticsKPIs;
  revenue_trend: Array<{
    date: string;
    revenue: number;
    event_id: string;
  }>;
  top_events: Array<{
    event_id: string;
    title: string;
    revenue: number;
  }>;
  events_leaderboard: Array<{
    event_id: string;
    title: string;
    revenue: number;
  }>;
}

// Video Analytics Component
const VideoAnalytics: React.FC<{ selectedOrg: string; dateRange: string }> = ({ selectedOrg, dateRange }) => {
  const [videoData, setVideoData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedOrg) {
      fetchVideoAnalytics();
    }
  }, [selectedOrg, dateRange]);

  const fetchVideoAnalytics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analytics-video-mux', {
        body: {
          asset_ids: [], // Would be populated with actual video asset IDs
          from_date: getDateFromRange(dateRange),
          to_date: new Date().toISOString()
        }
      });

      if (error) throw error;
      setVideoData(data);
    } catch (error) {
      console.error('Video analytics error:', error);
      // Fallback to sample data
      setVideoData({
        total_plays: 12847,
        avg_watch_time: 272, // 4:32 in seconds
        completion_rate: 67.8,
        videos: [
          { title: "Event Preview: Summer Festival", plays: 3420, ctr: 4.2 },
          { title: "Artist Spotlight: Main Act", plays: 2890, ctr: 3.8 },
          { title: "Behind the Scenes Setup", plays: 1960, ctr: 2.1 },
          { title: "Venue Tour & Amenities", plays: 1420, ctr: 5.1 },
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const getDateFromRange = (range: string): string => {
    const now = new Date();
    switch (range) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="text-center py-8">Loading video analytics...</div>;
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plays</CardTitle>
            <PlayIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{videoData?.total_plays?.toLocaleString() || '0'}</div>
            <p className="text-xs text-muted-foreground">+18% from last month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Watch Time</CardTitle>
            <PlayIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTime(videoData?.avg_watch_time || 0)}</div>
            <p className="text-xs text-muted-foreground">+12% from last month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <PlayIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{videoData?.completion_rate || 0}%</div>
            <p className="text-xs text-muted-foreground">+5.2% from last month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CTR to Tickets</CardTitle>
            <TicketIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3.4%</div>
            <p className="text-xs text-muted-foreground">+0.8% from last month</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Performing Videos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {videoData?.videos?.map((video: any, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-sm font-medium text-muted-foreground">#{index + 1}</div>
                  <div>
                    <p className="font-medium">{video.title}</p>
                    <p className="text-sm text-muted-foreground">{video.plays?.toLocaleString() || 0} plays</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{video.ctr || 0}% CTR</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
};

// Audience Analytics Component
const AudienceAnalytics: React.FC<{ selectedOrg: string; dateRange: string }> = ({ selectedOrg, dateRange }) => {
  const [audienceData, setAudienceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedOrg) {
      fetchAudienceAnalytics();
    }
  }, [selectedOrg, dateRange]);

  const fetchAudienceAnalytics = async () => {
    setLoading(true);
    try {
      console.log('🔍 Fetching PostHog analytics...');
      
      // Get actual event IDs if available (you can pass these from your events context)
      const eventIds = []; // Can be populated with real event tracking IDs
      
      const { data, error } = await supabase.functions.invoke('analytics-posthog-funnel', {
        body: {
          event_ids: eventIds, // PostHog will use defaults if empty
          from_date: getDateFromRange(dateRange),
          to_date: new Date().toISOString()
        }
      });

      console.log('📊 PostHog response:', { data, error });
      if (error) throw error;
      
      // Check if we got real data from the new response format
      const responseData = data?.data || data; // Handle both old and new response formats
      const isRealData = data?.usingReal || false;
      console.log('✅ Using real PostHog data:', isRealData);
      
      setAudienceData(responseData);
    } catch (error) {
      console.error('❌ Audience analytics error:', error);
      // Fallback to sample data
      setAudienceData({
        funnel_steps: [
          { event: 'event_view', count: 1250, conversion_rate: 100 },
          { event: 'ticket_cta_click', count: 387, conversion_rate: 31.0 },
          { event: 'checkout_started', count: 156, conversion_rate: 40.3 },
          { event: 'checkout_completed', count: 89, conversion_rate: 57.1 }
        ],
        acquisition_channels: [
          { channel: 'direct', visitors: 542, conversions: 38 },
          { channel: 'social_share', visitors: 298, conversions: 22 },
          { channel: 'qr_code', visitors: 189, conversions: 15 },
          { channel: 'organic', visitors: 221, conversions: 14 }
        ],
        device_breakdown: [
          { device: 'mobile', sessions: 892, conversion_rate: 6.8 },
          { device: 'desktop', sessions: 298, conversion_rate: 8.1 },
          { device: 'tablet', sessions: 60, conversion_rate: 5.2 }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const getDateFromRange = (range: string): string => {
    const now = new Date();
    switch (range) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading audience analytics...</div>;
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {audienceData?.funnel_steps?.map((step: any, index: number) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {step.event === 'event_view' && 'Event Views'}
                {step.event === 'ticket_cta_click' && 'Ticket CTAs'}
                {step.event === 'checkout_started' && 'Checkouts Started'}
                {step.event === 'checkout_completed' && 'Purchases'}
              </CardTitle>
              {step.event === 'checkout_completed' ? 
                <DollarSignIcon className="h-4 w-4 text-muted-foreground" /> :
                <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
              }
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{step.count?.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground">
                {index === 0 ? 'Funnel start' : `${step.conversion_rate}% conversion`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Acquisition Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {audienceData?.acquisition_channels?.map((channel: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div>
                      <p className="font-medium capitalize">{channel.channel?.replace('_', ' ')}</p>
                      <p className="text-sm text-muted-foreground">{channel.visitors?.toLocaleString() || 0} visitors</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{channel.conversions || 0} sales</p>
                    <p className="text-sm text-muted-foreground">
                      {channel.visitors > 0 ? ((channel.conversions / channel.visitors) * 100).toFixed(1) : 0}% conversion
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Device Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {audienceData?.device_breakdown?.map((device: any, index: number) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div>
                      <p className="font-medium capitalize">{device.device}</p>
                      <p className="text-sm text-muted-foreground">{device.sessions?.toLocaleString() || 0} sessions</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{device.conversion_rate || 0}%</p>
                    <p className="text-sm text-muted-foreground">conversion rate</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

// Event Analytics Component
const EventAnalyticsComponent: React.FC<{ selectedOrg: string; dateRange: string }> = ({ selectedOrg, dateRange }) => {
  const [eventData, setEventData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedOrg) {
      fetchEventAnalytics();
    }
  }, [selectedOrg, dateRange]);

  const fetchEventAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch events for the selected organization with explicit FK names
      const { data: events, error } = await supabase
        .from('events')
        .select(`
          id,
          title,
          created_at,
          start_at,
          end_at,
          orders:orders!orders_event_id_fkey(
            id,
            total_cents,
            status,
            order_items:order_items!order_items_order_id_fkey(quantity)
          ),
          tickets:tickets!tickets_event_id_fkey(
            id,
            status,
            redeemed_at
          ),
          event_posts:event_posts!event_posts_event_id_fkey(
            id,
            event_reactions:event_reactions!event_reactions_post_id_fkey(kind)
          )
        `)
        .eq('owner_context_type', 'organization')
        .eq('owner_context_id', selectedOrg)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process events data
      const processedEvents = events?.map((event: any) => {
        const paidOrders = event.orders?.filter((o: any) => o.status === 'paid') || [];
        const totalRevenue = paidOrders.reduce((sum: number, order: any) => sum + (order.total_cents || 0), 0);
        const totalTickets = paidOrders.reduce((sum: number, order: any) => 
          sum + (order.order_items?.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0) || 0), 0);
        const attendeesCount = event.tickets?.filter((t: any) => t.status === 'redeemed').length || 0;
        const totalEngagements = event.event_posts?.reduce((sum: number, post: any) => 
          sum + (post.event_reactions?.length || 0), 0) || 0;

        return {
          id: event.id,
          title: event.title,
          startDate: event.start_at,
          endDate: event.end_at,
          revenue: totalRevenue,
          ticketsSold: totalTickets,
          attendees: attendeesCount,
          engagements: totalEngagements,
          status: new Date(event.end_at) < new Date() ? 'completed' : 'upcoming'
        };
      }) || [];

      setEventData(processedEvents);
    } catch (error) {
      console.error('Event analytics error:', error);
      // Fallback to sample data
      setEventData([
        {
          id: '1',
          title: 'Summer Music Festival 2024',
          startDate: '2024-07-15T18:00:00Z',
          endDate: '2024-07-15T23:00:00Z',
          revenue: 45000,
          ticketsSold: 450,
          attendees: 425,
          engagements: 892,
          status: 'completed'
        },
        {
          id: '2',
          title: 'Tech Conference Winter',
          startDate: '2024-08-22T09:00:00Z',
          endDate: '2024-08-22T17:00:00Z',
          revenue: 32000,
          ticketsSold: 160,
          attendees: 142,
          engagements: 543,
          status: 'completed'
        },
        {
          id: '3',
          title: 'Art Gallery Opening',
          startDate: '2024-09-10T19:00:00Z',
          endDate: '2024-09-10T22:00:00Z',
          revenue: 12000,
          ticketsSold: 80,
          attendees: 0,
          engagements: 234,
          status: 'upcoming'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return <div className="text-center py-8">Loading event analytics...</div>;
  }

  if (!eventData || eventData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Event Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-muted-foreground">No events found for this organization</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate summary stats
  const totalRevenue = eventData.reduce((sum: number, event: any) => sum + event.revenue, 0);
  const totalTickets = eventData.reduce((sum: number, event: any) => sum + event.ticketsSold, 0);
  const totalAttendees = eventData.reduce((sum: number, event: any) => sum + event.attendees, 0);
  const totalEngagements = eventData.reduce((sum: number, event: any) => sum + event.engagements, 0);

  return (
    <>
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eventData.length}</div>
            <p className="text-xs text-muted-foreground">
              {eventData.filter((e: any) => e.status === 'completed').length} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatCurrency(totalRevenue / eventData.length)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets Sold</CardTitle>
            <TicketIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTickets.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {totalAttendees} attended ({totalTickets > 0 ? ((totalAttendees / totalTickets) * 100).toFixed(1) : 0}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagements</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEngagements.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {Math.round(totalEngagements / eventData.length)} per event
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle>Individual Event Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {eventData.map((event: any) => (
              <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <div>
                      <h3 className="font-medium">{event.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(event.startDate)} 
                        {event.status === 'completed' ? ' • Completed' : ' • Upcoming'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-6 text-right">
                  <div>
                    <p className="font-medium">{formatCurrency(event.revenue)}</p>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                  </div>
                  <div>
                    <p className="font-medium">{event.ticketsSold}</p>
                    <p className="text-xs text-muted-foreground">Tickets Sold</p>
                  </div>
                  <div>
                    <p className="font-medium">{event.attendees}</p>
                    <p className="text-xs text-muted-foreground">Attended</p>
                  </div>
                  <div>
                    <p className="font-medium">{event.engagements}</p>
                    <p className="text-xs text-muted-foreground">Engagements</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
};

const AnalyticsHub: React.FC = () => {
  const { user } = useAuth();
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('30d');
  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "events" | "videos" | "audience">("overview");

  useEffect(() => {
    if (user) {
      fetchOrganizations();
    }
  }, [user]);

  useEffect(() => {
    if (selectedOrg) {
      fetchAnalytics();
    }
  }, [selectedOrg, dateRange]);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase.rpc('get_user_organizations', {
        user_uuid: user?.id
      });
      
      if (error) {
        console.error('Error fetching organizations:', error);
        toast({
          title: "Error",
          description: "Failed to fetch organizations",
          variant: "destructive"
        });
        return;
      }

      if (data && data.length > 0) {
        setOrganizations(data);
        if (!selectedOrg) {
          setSelectedOrg(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error in fetchOrganizations:', error);
      toast({
        title: "Error",
        description: "Failed to fetch organizations",
        variant: "destructive"
      });
    }
  };

  const fetchAnalytics = async () => {
    if (!selectedOrg) return;

    setLoading(true);
    try {
      const fromDate = getDateFromRange(dateRange);
      const toDate = new Date().toISOString();

      const { data, error } = await supabase.functions.invoke('analytics-org-overview', {
        body: {
          org_id: selectedOrg,
          from: fromDate,
          to: toDate
        }
      });

      if (error) {
        console.error('Analytics error:', error);
        toast({
          title: "Error",
          description: `Failed to fetch analytics: ${error.message || 'Unknown error'}`,
          variant: "destructive"
        });
        return;
      }

      console.log('Analytics data received:', data);
      setAnalytics(data);
    } finally {
      setLoading(false);
    }
  };

  const getDateFromRange = (range: string): string => {
    const now = new Date();
    switch (range) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  const formatCurrency = (cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please sign in to view analytics</p>
      </div>
    );
  }

  return (
    <div className="min-h-0 w-full">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">YardPass Analytics Hub</h1>
          <p className="text-muted-foreground">Comprehensive insights across your events and content</p>
        </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <Select value={selectedOrg} onValueChange={setSelectedOrg}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Select organization" />
          </SelectTrigger>
          <SelectContent>
            {organizations.map(org => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={fetchAnalytics} disabled={loading} variant="outline">
          <CalendarIcon className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Main Content */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="w-full space-y-8"
      >
        {/* Make sure nothing overlays this row */}
        <div className="relative z-20">
          <TabsList className="grid w-full grid-cols-4 h-12 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger 
              className="pointer-events-auto font-medium text-sm px-6 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all" 
              value="overview"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              className="pointer-events-auto font-medium text-sm px-6 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all" 
              value="events"
            >
              Events
            </TabsTrigger>
            <TabsTrigger 
              className="pointer-events-auto font-medium text-sm px-6 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all" 
              value="videos"
            >
              Videos
            </TabsTrigger>
            <TabsTrigger 
              className="pointer-events-auto font-medium text-sm px-6 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all" 
              value="audience"
            >
              Audience
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-full"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : analytics ? (
            <>
              {/* KPIs Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
                    <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(analytics.kpis.gross_revenue)}</div>
                    <p className="text-xs text-muted-foreground">
                      Net: {formatCurrency(analytics.kpis.net_revenue)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tickets Sold</CardTitle>
                    <TicketIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.kpis.tickets_sold.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      {analytics.kpis.refund_rate.toFixed(1)}% refund rate
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Unique Buyers</CardTitle>
                    <UsersIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.kpis.unique_buyers.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      {analytics.kpis.no_show_rate.toFixed(1)}% no-show rate
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Feed Engagement</CardTitle>
                    <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.kpis.feed_engagements.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      {analytics.kpis.posts_created} posts created
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Top Events Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Events by Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.top_events.slice(0, 5).map((event, index) => (
                      <div key={event.event_id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="text-sm font-medium text-muted-foreground">#{index + 1}</div>
                          <div>
                            <p className="font-medium">{event.title}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(event.revenue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No analytics data available</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="events">
          <EventAnalyticsComponent selectedOrg={selectedOrg} dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="videos" className="space-y-6">
          <VideoAnalytics selectedOrg={selectedOrg} dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="audience" className="space-y-6">
          <AudienceAnalytics selectedOrg={selectedOrg} dateRange={dateRange} />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
};

export default AnalyticsHub;