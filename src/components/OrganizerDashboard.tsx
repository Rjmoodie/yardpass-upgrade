import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useOrganizerAnalytics } from '@/hooks/useOrganizerAnalytics';
import { useAuth } from '@/contexts/AuthContext';
import { VerificationBadge } from './VerificationBadge';
import { PayoutDashboard } from './PayoutDashboard';
import { 
  Plus, 
  Users, 
  DollarSign, 
  Calendar, 
  TrendingUp,
  Eye,
  Heart,
  Share,
  MoreVertical,
  CreditCard,
  RefreshCw,
  Ticket,
  MessageSquare
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  role: 'attendee' | 'organizer';
}

interface OrganizerDashboardProps {
  user: User;
  onCreateEvent: () => void;
  onEventSelect: (event: any) => void;
}

// Mock data
const mockEvents = [
  {
    id: '1',
    title: 'Summer Music Festival 2024',
    status: 'published',
    date: 'July 15-17, 2024',
    attendees: 1243,
    revenue: 89540,
    views: 15600,
    likes: 892,
    shares: 156,
    coverImage: 'https://images.unsplash.com/photo-1681149341674-45fd772fd463?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwZmVzdGl2YWwlMjBvdXRkb29yfGVufDF8fHx8MTc1Njc5OTY4OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
  },
  {
    id: '2',
    title: 'Tech Innovation Summit',
    status: 'draft',
    date: 'August 22, 2024',
    attendees: 67,
    revenue: 8940,
    views: 2300,
    likes: 45,
    shares: 12,
    coverImage: 'https://images.unsplash.com/photo-1713779490284-a81ff6a8ffae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnQlMjBnYWxsZXJ5JTIwZXhoaWJpdGlvbnxlbnwxfHx8fDE3NTY3NjI4ODd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
  }
];

const salesData = [
  { name: 'Jan', sales: 4000 },
  { name: 'Feb', sales: 3000 },
  { name: 'Mar', sales: 2000 },
  { name: 'Apr', sales: 2780 },
  { name: 'May', sales: 1890 },
  { name: 'Jun', sales: 2390 },
];

export function OrganizerDashboard({ user, onCreateEvent, onEventSelect }: OrganizerDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const { profile } = useAuth();
  const { eventAnalytics, overallAnalytics, loading, error, refreshAnalytics } = useOrganizerAnalytics();

  // Use real data when available, fallback to mock data
  const totalRevenue = overallAnalytics?.total_revenue || mockEvents.reduce((sum, event) => sum + event.revenue, 0);
  const totalAttendees = overallAnalytics?.total_attendees || mockEvents.reduce((sum, event) => sum + event.attendees, 0);
  const totalEvents = overallAnalytics?.total_events || mockEvents.length;
  const completedEvents = overallAnalytics?.completed_events || 0;
  const totalViews = eventAnalytics.reduce((sum, event) => sum + event.total_views, 0) || mockEvents.reduce((sum, event) => sum + event.views, 0);

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1>Organizer Dashboard</h1>
              <VerificationBadge status={profile?.verification_status || 'none'} />
            </div>
            <p className="text-sm text-muted-foreground">Welcome back, {user.name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refreshAnalytics} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={onCreateEvent}>
              <Plus className="w-4 h-4 mr-1" />
              Create Event
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="overview" className="h-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="events">Events ({totalEvents})</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">${totalRevenue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    +20.1% from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Total Attendees</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{totalAttendees.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    +15% from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Total Events</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{totalEvents}</div>
                  <p className="text-xs text-muted-foreground">
                    {completedEvents} completed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Total Views</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{totalViews.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    +8.2% from last month
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Events */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Events</CardTitle>
                <CardDescription>Your latest event activity</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="flex items-center gap-4 p-4">
                          <div className="w-12 h-12 bg-muted rounded"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                            <div className="h-3 bg-muted rounded w-1/4"></div>
                          </div>
                          <div className="w-20 h-8 bg-muted rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Failed to load events</p>
                    <Button variant="outline" size="sm" onClick={refreshAnalytics} className="mt-2">
                      Retry
                    </Button>
                  </div>
                ) : eventAnalytics.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No events yet</p>
                    <Button onClick={onCreateEvent} className="mt-2">
                      Create Your First Event
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {eventAnalytics.slice(0, 3).map((event) => (
                      <div 
                        key={event.event_id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => onEventSelect(event)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center">
                            <Ticket className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium">{event.event_title}</h4>
                            <p className="text-xs text-muted-foreground">
                              {event.total_attendees} attendees • {event.ticket_sales} tickets sold
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="font-medium">${event.total_revenue.toLocaleString()}</div>
                          <div className="text-muted-foreground">{event.check_ins} check-ins</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg">Your Events</h2>
              <Button variant="outline" size="sm" onClick={onCreateEvent}>
                <Plus className="w-4 h-4 mr-2" />
                New Event
              </Button>
            </div>

            <div className="grid gap-4">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="animate-pulse flex">
                      <div className="w-32 h-24 bg-muted"></div>
                      <div className="flex-1 p-4">
                        <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/4 mb-3"></div>
                        <div className="grid grid-cols-4 gap-4">
                          {[1, 2, 3, 4].map((j) => (
                            <div key={j} className="h-3 bg-muted rounded"></div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              ) : eventAnalytics.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No events yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first event to start building your audience
                  </p>
                  <Button onClick={onCreateEvent}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Event
                  </Button>
                </div>
              ) : (
                eventAnalytics.map((event) => (
                  <Card key={event.event_id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <div className="flex">
                      <div className="w-32 h-24 bg-primary/10 flex items-center justify-center">
                        <Ticket className="w-8 h-8 text-primary" />
                      </div>
                      <div className="flex-1 p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="text-sm font-medium">{event.event_title}</h3>
                            <p className="text-xs text-muted-foreground">Event ID: {event.event_id.slice(-8)}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => onEventSelect(event)}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mt-3 text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Users className="w-3 h-3" />
                            <span>{event.total_attendees} attendees</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Ticket className="w-3 h-3" />
                            <span>{event.ticket_sales} sold</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Heart className="w-3 h-3" />
                            <span>{event.engagement_metrics.likes} likes</span>
                          </div>
                          <div className="flex items-center gap-1 font-medium">
                            <DollarSign className="w-3 h-3" />
                            <span>${event.total_revenue.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="sales" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg">Sales Dashboard</h2>
              <div className="flex gap-2">
                {['7d', '30d', '90d'].map((period) => (
                  <Button
                    key={period}
                    variant={selectedPeriod === period ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPeriod(period)}
                  >
                    {period}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Sales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">All time revenue</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Tickets Sold</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{eventAnalytics.reduce((sum, e) => sum + e.ticket_sales, 0)}</div>
                  <p className="text-xs text-muted-foreground">Total tickets</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Avg. Ticket Price</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${totalRevenue && eventAnalytics.reduce((sum, e) => sum + e.ticket_sales, 0) 
                      ? Math.round(totalRevenue / eventAnalytics.reduce((sum, e) => sum + e.ticket_sales, 0))
                      : 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Per ticket</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Refunds</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{eventAnalytics.reduce((sum, e) => sum + e.refunds.count, 0)}</div>
                  <p className="text-xs text-muted-foreground">Total refunded</p>
                </CardContent>
              </Card>
            </div>

            {eventAnalytics.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Event Performance</CardTitle>
                  <CardDescription>Revenue and ticket sales by event</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {eventAnalytics.map((event) => (
                      <div key={event.event_id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <h4 className="font-medium">{event.event_title}</h4>
                          <p className="text-sm text-muted-foreground">{event.ticket_sales} tickets sold</p>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">${event.total_revenue.toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">{event.check_ins} check-ins</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="engagement" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg">Engagement Analytics</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Total Likes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{eventAnalytics.reduce((sum, e) => sum + e.engagement_metrics.likes, 0)}</div>
                  <p className="text-xs text-muted-foreground">Across all events</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Comments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{eventAnalytics.reduce((sum, e) => sum + e.engagement_metrics.comments, 0)}</div>
                  <p className="text-xs text-muted-foreground">Total comments</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Share className="w-4 h-4" />
                    Shares
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{eventAnalytics.reduce((sum, e) => sum + e.engagement_metrics.shares, 0)}</div>
                  <p className="text-xs text-muted-foreground">Total shares</p>
                </CardContent>
              </Card>
            </div>

            {eventAnalytics.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Event Engagement</CardTitle>
                  <CardDescription>Likes, comments, and shares by event</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {eventAnalytics.map((event) => (
                      <div key={event.event_id} className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-3">{event.event_title}</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Heart className="w-4 h-4 text-red-500" />
                            <span>{event.engagement_metrics.likes} likes</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-blue-500" />
                            <span>{event.engagement_metrics.comments} comments</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Share className="w-4 h-4 text-green-500" />
                            <span>{event.engagement_metrics.shares} shares</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="payouts" className="space-y-4">
            <PayoutDashboard />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg">Analytics</h2>
              <div className="flex gap-2">
                {['7d', '30d', '90d'].map((period) => (
                  <Button
                    key={period}
                    variant={selectedPeriod === period ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPeriod(period)}
                  >
                    {period}
                  </Button>
                ))}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Ticket Sales Over Time</CardTitle>
                <CardDescription>Revenue from ticket sales in the last 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="sales" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockEvents.map((event, index) => (
                      <div key={event.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">#{index + 1}</span>
                          <span className="text-sm truncate max-w-32">{event.title}</span>
                        </div>
                        <div className="text-sm">${event.revenue.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Engagement Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Average Views per Event</span>
                      <span className="text-sm">{Math.round(totalViews / mockEvents.length).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Conversion Rate</span>
                      <span className="text-sm">12.4%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Average Ticket Price</span>
                      <span className="text-sm">$68</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default OrganizerDashboard;