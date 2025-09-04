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

const AnalyticsHub: React.FC = () => {
  const { user } = useAuth();
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('30d');
  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);

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
      const { data } = await supabase
        .from('org_memberships')
        .select('organizations!inner(id, name)')
        .eq('user_id', user?.id);

      const orgs = data?.map(m => ({
        id: m.organizations.id,
        name: m.organizations.name
      })) || [];

      setOrganizations(orgs);
      if (orgs.length > 0) {
        setSelectedOrg(orgs[0].id);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
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

      if (error) throw error;

      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Failed to fetch analytics data",
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
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
        </TabsList>

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
          <Card>
            <CardHeader>
              <CardTitle>Event Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Event-specific analytics coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="videos">
          <Card>
            <CardHeader>
              <CardTitle>Video Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Video performance analytics coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audience">
          <Card>
            <CardHeader>
              <CardTitle>Audience & Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Audience insights coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsHub;