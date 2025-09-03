import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Scan, Users, BarChart3, Settings, Download, Share } from 'lucide-react';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';

interface EventManagementProps {
  event: any;
  onBack: () => void;
}

// Mock attendee data
const mockAttendees = [
  {
    id: '1',
    name: 'Sarah Chen',
    email: 'sarah@example.com',
    phone: '+1 (555) 123-4567',
    ticketTier: 'VIP Experience',
    badge: 'VIP',
    checkedIn: true,
    purchaseDate: '2024-01-15'
  },
  {
    id: '2',
    name: 'Mike Johnson',
    email: 'mike@example.com',
    phone: '+1 (555) 234-5678',
    ticketTier: 'General Admission',
    badge: 'GA',
    checkedIn: false,
    purchaseDate: '2024-01-20'
  },
  {
    id: '3',
    name: 'Emma Davis',
    email: 'emma@example.com',
    phone: '+1 (555) 345-6789',
    ticketTier: 'VIP Experience',
    badge: 'VIP',
    checkedIn: true,
    purchaseDate: '2024-01-18'
  }
];

export default function EventManagement({ event, onBack }: EventManagementProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const totalAttendees = mockAttendees.length;
  const checkedInCount = mockAttendees.filter(a => a.checkedIn).length;
  const totalRevenue = 15420; // Mock revenue
  const refundRequests = 2; // Mock refund requests

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1>Event Management</h1>
            <p className="text-sm text-muted-foreground">{event.title}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Share className="w-4 h-4 mr-1" />
              Share
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-1" />
              Edit
            </Button>
          </div>
        </div>

        {/* Event Preview */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4">
              <ImageWithFallback
                src={event.coverImage}
                alt={event.title}
                className="w-16 h-16 rounded object-cover"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium">{event.title}</h3>
                  <Badge variant="secondary">Published</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {event.date} • {event.location}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="border-b bg-card">
        <div className="flex">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'attendees', label: 'Attendees', icon: Users },
            { id: 'scanner', label: 'Scanner', icon: Scan },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{totalAttendees}</div>
                  <div className="text-sm text-muted-foreground">Total Attendees</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{checkedInCount}</div>
                  <div className="text-sm text-muted-foreground">Checked In</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Revenue</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{refundRequests}</div>
                  <div className="text-sm text-muted-foreground">Refund Requests</div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="h-auto p-4 flex flex-col gap-2">
                    <Download className="w-6 h-6" />
                    <span>Export Guest List</span>
                  </Button>
                  <Button variant="outline" className="h-auto p-4 flex flex-col gap-2">
                    <Scan className="w-6 h-6" />
                    <span>Open Scanner</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <div className="text-sm">New ticket purchase</div>
                      <div className="text-xs text-muted-foreground">Emma Davis bought VIP ticket</div>
                    </div>
                    <div className="text-xs text-muted-foreground">2 hours ago</div>
                  </div>
                  <div className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <div className="text-sm">Check-in</div>
                      <div className="text-xs text-muted-foreground">Sarah Chen checked in</div>
                    </div>
                    <div className="text-xs text-muted-foreground">1 day ago</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'attendees' && (
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
        )}

        {activeTab === 'scanner' && (
          <div className="text-center py-12">
            <Scan className="w-24 h-24 mx-auto mb-6 text-muted-foreground/50" />
            <h2 className="text-xl font-bold mb-2">QR Code Scanner</h2>
            <p className="text-muted-foreground mb-6">
              Scan attendee tickets to check them in to your event
            </p>
            <Button size="lg">
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
        )}
      </div>
    </div>
  );
}