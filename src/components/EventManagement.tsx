import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, Calendar, Users, BarChart3, Settings, Scan, Download, ExternalLink, MoreVertical, Search, Filter, RefreshCw, Edit, Trash2, Plus, Eye, Share, MessageSquare, Bell, Mail, QrCode, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GuestManagement } from '@/components/GuestManagement';
import { OrganizerRolesPanel } from './organizer/OrganizerRolesPanel';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import { Event, TicketTier } from '@/types/events';

// Mock attendee data
const mockAttendees = [
  { id: '1', name: 'Sarah Chen', email: 'sarah@example.com', phone: '+1 555-0101', badge: 'VIP', ticketTier: 'VIP Access', purchaseDate: '2024-01-15', checkedIn: true },
  { id: '2', name: 'Mike Rodriguez', email: 'mike@example.com', phone: '+1 555-0102', badge: 'GA', ticketTier: 'General Admission', purchaseDate: '2024-01-14', checkedIn: false },
  { id: '3', name: 'Emma Wilson', email: 'emma@example.com', phone: '+1 555-0103', badge: 'VIP', ticketTier: 'VIP Access', purchaseDate: '2024-01-13', checkedIn: true },
  { id: '4', name: 'James Park', email: 'james@example.com', phone: '+1 555-0104', badge: 'GA', ticketTier: 'General Admission', purchaseDate: '2024-01-12', checkedIn: false },
];

interface EventManagementProps {
  event: Event;
  onBack: () => void;
}

export default function EventManagement({ event, onBack }: EventManagementProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [attendees, setAttendees] = useState(mockAttendees);
  const [realTimeStats, setRealTimeStats] = useState({
    totalScans: 0,
    validScans: 0,
    duplicateScans: 0,
    lastScanTime: null as Date | null
  });

  // Safety checks for undefined event or ticketTiers
  if (!event) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2 text-accent">Event not found</h2>
          <p className="text-accent-muted mb-4">The requested event could not be loaded.</p>
          <Button onClick={onBack} className="btn-enhanced">Go Back</Button>
        </div>
      </div>
    );
  }

  const ticketTiers = event.ticketTiers || [];
  const totalTickets = ticketTiers.reduce((sum, tier) => sum + tier.total, 0);
  const soldTickets = ticketTiers.reduce((sum, tier) => sum + (tier.total - tier.available), 0);
  const revenue = ticketTiers.reduce((sum, tier) => sum + (tier.price * (tier.total - tier.available)), 0);
  const totalAttendees = attendees.length;
  const checkedInCount = attendees.filter(a => a.checkedIn).length;

  // Real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate real-time scan updates
      setRealTimeStats(prev => ({
        ...prev,
        totalScans: prev.totalScans + Math.floor(Math.random() * 3),
        validScans: prev.validScans + Math.floor(Math.random() * 2),
        lastScanTime: new Date()
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      // Refresh attendee data
      // In real implementation, fetch from API
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLoading(false);
    } catch (error) {
      setLoading(false);
      toast({
        title: "Refresh failed",
        description: "Could not refresh event data",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Enhanced Header */}
      <div className="border-b border-accent bg-card p-4">
        <div className="flex items-center gap-4 mb-4">
          <Button onClick={onBack} variant="ghost" size="icon" className="rounded-full btn-enhanced">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-accent">{event.title}</h1>
            <p className="text-sm text-accent-muted">Event Management</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading} className="btn-enhanced border-accent">
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="btn-enhanced border-accent">
              <ExternalLink className="w-4 h-4 mr-1" />
              View Event
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{soldTickets}</div>
            <div className="text-xs text-accent-muted">Tickets Sold</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{checkedInCount}</div>
            <div className="text-xs text-accent-muted">Checked In</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">${revenue.toLocaleString()}</div>
            <div className="text-xs text-accent-muted">Revenue</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">{realTimeStats.totalScans}</div>
            <div className="text-xs text-accent-muted">Total Scans</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="tabs-mobile mb-4">
            <TabsTrigger value="overview" className="tab-enhanced">Overview</TabsTrigger>
            <TabsTrigger value="attendees" className="tab-enhanced">Attendees</TabsTrigger>
            <TabsTrigger value="scanner" className="tab-enhanced">Scanner</TabsTrigger>
            <TabsTrigger value="teams" className="tab-enhanced">Teams</TabsTrigger>
            <TabsTrigger value="settings" className="tab-enhanced">Settings</TabsTrigger>
          </div>

          <TabsContent value="overview" className="space-y-4">
            {/* Enhanced Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="card-enhanced">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center border border-accent">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-accent">{soldTickets}</div>
                      <div className="text-sm text-accent-muted">Tickets Sold</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center border border-accent">
                      <Users className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-accent">{totalAttendees}</div>
                      <div className="text-sm text-accent-muted">Total Attendees</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center border border-accent">
                      <BarChart3 className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-accent">${revenue.toLocaleString()}</div>
                      <div className="text-sm text-accent-muted">Revenue</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center border border-accent">
                      <Scan className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-accent">{checkedInCount}</div>
                      <div className="text-sm text-accent-muted">Checked In</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Real-time Activity */}
            <Card className="card-enhanced">
              <CardHeader>
                <CardTitle className="text-accent">Live Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border border-accent rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{realTimeStats.validScans}</div>
                    <div className="text-sm text-accent-muted">Valid Scans</div>
                  </div>
                  <div className="text-center p-4 border border-accent rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{realTimeStats.duplicateScans}</div>
                    <div className="text-sm text-accent-muted">Duplicate Scans</div>
                  </div>
                  <div className="text-center p-4 border border-accent rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {realTimeStats.lastScanTime ? 'Live' : 'Offline'}
                    </div>
                    <div className="text-sm text-accent-muted">Scanner Status</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="card-enhanced">
              <CardHeader>
                <CardTitle className="text-accent">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                  <Scan className="w-6 h-6" />
                  <span>Check-in Scanner</span>
                </Button>
                <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                  <Download className="w-6 h-6" />
                  <span>Export Guest List</span>
                </Button>
                <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                  <Users className="w-6 h-6" />
                  <span>View Attendees</span>
                </Button>
                <Button variant="outline" className="h-auto flex-col gap-2 p-4">
                  <Settings className="w-6 h-6" />
                  <span>Event Settings</span>
                </Button>
              </CardContent>
            </Card>

            {/* Ticket Tiers Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Ticket Tiers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ticketTiers.map((tier) => {
                  const sold = tier.total - tier.available;
                  const percentage = Math.round((sold / tier.total) * 100);
                  
                  return (
                    <div key={tier.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{tier.badge}</Badge>
                        <div>
                          <div className="font-medium">{tier.name}</div>
                          <div className="text-sm text-muted-foreground">
                            ${tier.price} • {sold}/{tier.total} sold ({percentage}%)
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">${(tier.price * sold).toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">Revenue</div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="guests" className="space-y-4">
            <GuestManagement eventId={event.id} />
          </TabsContent>

          <TabsContent value="attendees" className="space-y-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2>Attendee List</h2>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1" />
                  Export CSV
                </Button>
              </div>

              <div className="space-y-3">
                {mockAttendees.map((attendee) => (
                  <Card key={attendee.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{attendee.name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {attendee.badge}
                            </Badge>
                            {attendee.checkedIn && (
                              <Badge variant="secondary" className="text-xs">
                                Checked In
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {attendee.email} • {attendee.phone}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {attendee.ticketTier} • Purchased {attendee.purchaseDate}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="scanner" className="space-y-4">
            <div className="text-center py-12">
              <Scan className="w-24 h-24 mx-auto mb-6 text-muted-foreground/50" />
              <h2 className="text-xl font-bold mb-2">QR Code Scanner</h2>
              <p className="text-muted-foreground mb-6">
                Scan attendee tickets to check them in to your event
              </p>
              <Button size="lg" onClick={() => {
                // Navigate to full scanner page
                console.log('Navigate to scanner for event:', event.id);
              }}>
                <Scan className="w-5 h-5 mr-2" />
                Start Scanning
              </Button>
              <div className="mt-8 max-w-md mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Scanner Instructions</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Point camera at attendee's QR code</li>
                      <li>Wait for automatic scan recognition</li>
                      <li>Verify attendee information</li>
                      <li>Confirm check-in</li>
                    </ol>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="teams" className="space-y-4">
            <OrganizerRolesPanel eventId={event.id} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="text-accent">Event Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-accent">Event Title</label>
                    <Input value={event.title} className="input-enhanced" readOnly />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-accent">Status</label>
                    <Select defaultValue="active">
                      <SelectTrigger className="input-enhanced">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="live">Live</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="btn-enhanced w-full">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Event
                  </Button>
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="text-accent">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                    <h4 className="font-medium text-red-800 mb-2">Delete Event</h4>
                    <p className="text-sm text-red-600 mb-4">
                      This action cannot be undone. All tickets, attendees, and data will be permanently deleted.
                    </p>
                    <Button variant="destructive" className="btn-enhanced">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Event
                    </Button>
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