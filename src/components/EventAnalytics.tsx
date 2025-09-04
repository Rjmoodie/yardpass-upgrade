import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, TrendingUpIcon, UsersIcon, DollarSignIcon, TicketIcon, ScanIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface EventKPIs {
  gross_revenue: number;
  net_revenue: number;
  platform_fees: number;
  tickets_sold: number;
  capacity: number;
  sell_through: number;
  checkin_rate: number;
  posts_created: number;
  feed_engagements: number;
}

interface TierPerformance {
  id: string;
  name: string;
  price_cents: number;
  quantity: number;
  sold: number;
  revenue: number;
  sell_through: number;
}

interface EventAnalyticsData {
  event: {
    id: string;
    title: string;
    start_at: string;
    end_at: string;
  };
  kpis: EventKPIs;
  sales_curve: Array<{
    date: string;
    cumulative_revenue: number;
    daily_revenue: number;
    daily_units: number;
  }>;
  checkin_timeline: Array<{
    date: string;
    scans: number;
    duplicates: number;
  }>;
  tier_performance: TierPerformance[];
  scan_summary: {
    total_scans: number;
    valid_scans: number;
    duplicate_scans: number;
  };
}

interface EventAnalyticsProps {
  eventId?: string;
}

const EventAnalytics: React.FC<EventAnalyticsProps> = ({ eventId: initialEventId }) => {
  const { user } = useAuth();
  const [selectedEvent, setSelectedEvent] = useState<string>(initialEventId || '');
  const [dateRange, setDateRange] = useState<string>('30d');
  const [analytics, setAnalytics] = useState<EventAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<Array<{ id: string; title: string; start_at: string }>>([]);

  useEffect(() => {
    if (user) {
      fetchUserEvents();
    }
  }, [user]);

  useEffect(() => {
    if (selectedEvent) {
      fetchEventAnalytics();
    }
  }, [selectedEvent, dateRange]);

  const fetchUserEvents = async () => {
    try {
      // Get individual events
      const { data: individualEvents } = await supabase
        .from('events')
        .select('id, title, start_at')
        .eq('owner_context_type', 'individual')
        .eq('owner_context_id', user?.id)
        .order('start_at', { ascending: false });

      // Get org events
      const { data: orgMemberships } = await supabase
        .from('org_memberships')
        .select('org_id')
        .eq('user_id', user?.id);

      const orgIds = orgMemberships?.map(m => m.org_id) || [];
      
      let orgEvents: any[] = [];
      if (orgIds.length > 0) {
        const { data } = await supabase
          .from('events')
          .select('id, title, start_at')
          .eq('owner_context_type', 'organization')
          .in('owner_context_id', orgIds)
          .order('start_at', { ascending: false });
        
        orgEvents = data || [];
      }

      const allEvents = [...(individualEvents || []), ...orgEvents];
      setEvents(allEvents);
      
      if (allEvents.length > 0 && !selectedEvent) {
        setSelectedEvent(allEvents[0].id);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: "Error",
        description: "Failed to fetch events",
        variant: "destructive"
      });
    }
  };

  const fetchEventAnalytics = async () => {
    if (!selectedEvent) return;

    setLoading(true);
    try {
      const fromDate = getDateFromRange(dateRange);
      const toDate = new Date().toISOString();

      const { data, error } = await supabase.functions.invoke('analytics-event-overview', {
        body: {
          event_id: selectedEvent,
          from: fromDate,
          to: toDate
        }
      });

      if (error) throw error;

      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching event analytics:', error);
      toast({
        title: "Error",
        description: "Failed to fetch event analytics",
        variant: "destructive"
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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please sign in to view analytics</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Event Analytics</h1>
        <p className="text-muted-foreground">Detailed performance insights for your events</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <Select value={selectedEvent} onValueChange={setSelectedEvent}>
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue placeholder="Select event" />
          </SelectTrigger>
          <SelectContent>
            {events.map(event => (
              <SelectItem key={event.id} value={event.id}>
                <div className="flex flex-col">
                  <span>{event.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(event.start_at)}
                  </span>
                </div>
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

        <Button onClick={fetchEventAnalytics} disabled={loading} variant="outline">
          <CalendarIcon className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Content */}
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
        <div className="space-y-6">
          {/* Event Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{analytics.event.title}</span>
                <Badge variant="outline">
                  {formatDate(analytics.event.start_at)} - {formatDate(analytics.event.end_at)}
                </Badge>
              </CardTitle>
            </CardHeader>
          </Card>

          {/* KPIs Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
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
                <div className="text-2xl font-bold">
                  {analytics.kpis.tickets_sold} / {analytics.kpis.capacity}
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics.kpis.sell_through.toFixed(1)}% sell-through
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Check-ins</CardTitle>
                <ScanIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.scan_summary.total_scans}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics.kpis.checkin_rate.toFixed(1)}% of tickets
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Engagement</CardTitle>
                <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.kpis.feed_engagements}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics.kpis.posts_created} posts
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tier Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Ticket Tier Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.tier_performance.map((tier) => (
                  <div key={tier.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{tier.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(tier.price_cents)} • {tier.sold} / {tier.quantity || '∞'} sold
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(tier.revenue)}</p>
                      <p className="text-sm text-muted-foreground">
                        {tier.sell_through.toFixed(1)}% sold
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Scan Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Scan Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {analytics.scan_summary.valid_scans}
                  </div>
                  <p className="text-sm text-muted-foreground">Valid Scans</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {analytics.scan_summary.duplicate_scans}
                  </div>
                  <p className="text-sm text-muted-foreground">Duplicates</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {analytics.scan_summary.total_scans}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Scans</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No analytics data available</p>
        </div>
      )}
    </div>
  );
};

export default EventAnalytics;