import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ArrowLeft, Calendar, Users, BarChart3, Settings, Scan, Download, ExternalLink, MoreVertical } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GuestManagement } from '@/components/GuestManagement';

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
  // Safety checks for undefined event or ticketTiers
  if (!event) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Event not found</h2>
          <p className="text-muted-foreground mb-4">The requested event could not be loaded.</p>
          <Button onClick={onBack}>Go Back</Button>
        </div>
      </div>
    );
  }

  const ticketTiers = event.ticketTiers || [];
  const totalTickets = ticketTiers.reduce((sum, tier) => sum + tier.total, 0);
  const soldTickets = ticketTiers.reduce((sum, tier) => sum + (tier.total - tier.available), 0);
  const revenue = ticketTiers.reduce((sum, tier) => sum + (tier.price * (tier.total - tier.available)), 0);
  const totalAttendees = mockAttendees.length;
  const checkedInCount = mockAttendees.filter(a => a.checkedIn).length;

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-4 mb-4">
          <Button onClick={onBack} variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{event.title}</h1>
            <p className="text-sm text-muted-foreground">Event Management</p>
          </div>
          <Button variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-1" />
            View Event
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="guests">Guests</TabsTrigger>
            <TabsTrigger value="attendees">Attendees</TabsTrigger>
            <TabsTrigger value="scanner">Scanner</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{soldTickets}</div>
                      <div className="text-sm text-muted-foreground">Tickets Sold</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{totalAttendees}</div>
                      <div className="text-sm text-muted-foreground">Total Attendees</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">${revenue.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Revenue</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                      <Scan className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{checkedInCount}</div>
                      <div className="text-sm text-muted-foreground">Checked In</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
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

          <TabsContent value="settings" className="space-y-4">
            <div className="space-y-4">
              <h2>Event Settings</h2>
              <p className="text-muted-foreground">Settings and configuration options coming soon.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}