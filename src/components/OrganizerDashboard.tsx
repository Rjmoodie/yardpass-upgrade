import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Plus, 
  Users, 
  DollarSign, 
  Calendar, 
  TrendingUp,
  Eye,
  Heart,
  Share,
  MoreVertical 
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

  const totalRevenue = mockEvents.reduce((sum, event) => sum + event.revenue, 0);
  const totalAttendees = mockEvents.reduce((sum, event) => sum + event.attendees, 0);
  const totalViews = mockEvents.reduce((sum, event) => sum + event.views, 0);

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1>Organizer Dashboard</h1>
            <p className="text-sm text-muted-foreground">Welcome back, {user.name}</p>
          </div>
          <Button onClick={onCreateEvent}>
            <Plus className="w-4 h-4 mr-1" />
            Create Event
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="overview" className="h-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="events">Events ({mockEvents.length})</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
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
                  <CardTitle className="text-sm">Active Events</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{mockEvents.length}</div>
                  <p className="text-xs text-muted-foreground">
                    2 published, 1 draft
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
                <div className="space-y-4">
                  {mockEvents.map((event) => (
                    <div 
                      key={event.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => onEventSelect(event)}
                    >
                      <div className="flex items-center gap-4">
                        <ImageWithFallback
                          src={event.coverImage}
                          alt={event.title}
                          className="w-12 h-12 rounded object-cover"
                        />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm">{event.title}</h4>
                            <Badge 
                              variant={event.status === 'published' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {event.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{event.date}</p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div>{event.attendees} attendees</div>
                        <div className="text-muted-foreground">${event.revenue.toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg">Your Events</h2>
              <Button variant="outline" size="sm">
                Filter
              </Button>
            </div>

            <div className="grid gap-4">
              {mockEvents.map((event) => (
                <Card key={event.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="flex">
                    <ImageWithFallback
                      src={event.coverImage}
                      alt={event.title}
                      className="w-32 h-24 object-cover"
                    />
                    <div className="flex-1 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm">{event.title}</h3>
                            <Badge 
                              variant={event.status === 'published' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {event.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{event.date}</p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-4 gap-4 mt-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {event.attendees}
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {event.views}
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {event.likes}
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {event.revenue.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
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