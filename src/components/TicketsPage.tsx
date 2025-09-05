import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft,
  Ticket,
  Calendar,
  MapPin,
  Users,
  Star,
  Filter,
  Download,
  QrCode
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  role: 'attendee' | 'organizer';
}

interface Ticket {
  id: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  city: string;
  ticketType: string;
  badgeLevel: string;
  seatNumber: string;
  qrCode: string;
  status: string;
  coverImage: string;
  badge?: string;
  eventLocation?: string;
  organizerName?: string;
  tierName?: string;
  price?: number;
  orderDate?: string;
}

interface TicketsPageProps {
  user: User;
  onBack: () => void;
}

// Mock user tickets data
const mockTickets = [
  {
    id: '1',
    eventTitle: 'Summer Music Festival 2024',
    eventDate: 'July 15-17, 2024',
    eventTime: '6:00 PM',
    eventLocation: 'Central Park, NYC',
    organizerName: 'LiveNation Events',
    tierName: 'VIP Experience',
    badge: 'VIP',
    price: 199,
    status: 'confirmed',
    orderDate: '2024-06-15',
    qrCode: 'VIP-SMF2024-001',
    coverImage: 'https://images.unsplash.com/photo-1681149341674-45fd772fd463?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwZmVzdGl2YWwlMjBvdXRkb29yfGVufDF8fHx8MTc1Njc5OTY4OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
  },
  {
    id: '2',
    eventTitle: 'Street Food Fiesta',
    eventDate: 'August 8, 2024',
    eventTime: '12:00 PM',
    eventLocation: 'Brooklyn Bridge Park',
    organizerName: 'Foodie Adventures',
    tierName: 'Foodie Pass',
    badge: 'FOODIE',
    price: 75,
    status: 'confirmed',
    orderDate: '2024-07-20',
    qrCode: 'FOODIE-SFF2024-023',
    coverImage: 'https://images.unsplash.com/photo-1551883709-2516220df0bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwZmVzdGl2YWwlMjBvdXRkb29yfGVufDF8fHx8MTc1Njc5OTY4OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
  }
];


export function TicketsPage({ user, onBack }: TicketsPageProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('upcoming');
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const { user: authUser } = useAuth();

  // Load user's tickets from database
  useEffect(() => {
    const loadUserTickets = async () => {
      if (!authUser) return;
      
      try {
        const { data: ticketsData, error } = await supabase
          .from('tickets')
          .select(`
            *,
            events (
              id,
              title,
              start_at,
              end_at,
              venue,
              city,
              cover_image_url
            ),
            ticket_tiers (
              name,
              badge_label
            )
          `)
          .eq('owner_user_id', authUser.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading user tickets:', error);
          setTickets([]);
        } else if (ticketsData && ticketsData.length > 0) {
          // Transform database tickets to match UI format
          const transformedTickets = ticketsData.map(ticket => ({
            id: ticket.id,
            eventTitle: (ticket as any).events?.title || 'Event',
            eventDate: new Date((ticket as any).events?.start_at).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }),
            eventTime: new Date((ticket as any).events?.start_at).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit'
            }),
            venue: (ticket as any).events?.venue || 'TBA',
            city: (ticket as any).events?.city || '',
            ticketType: (ticket as any).ticket_tiers?.name || 'General',
            badgeLevel: (ticket as any).ticket_tiers?.badge_label || 'GA',
            badge: (ticket as any).ticket_tiers?.badge_label || 'GA',
            seatNumber: `Ticket #${ticket.id.slice(-8)}`,
            qrCode: ticket.qr_code,
            status: ticket.status,
            coverImage: (ticket as any).events?.cover_image_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30',
            eventLocation: `${(ticket as any).events?.venue || 'TBA'}, ${(ticket as any).events?.city || ''}`,
            organizerName: 'Event Organizer',
            tierName: (ticket as any).ticket_tiers?.name || 'General',
            price: Math.floor(Math.random() * 100 + 25), // Mock price for now
            orderDate: ticket.created_at
          }));
          setTickets(transformedTickets);
        } else {
          setTickets([]);
        }
      } catch (error) {
        console.error('Error fetching user tickets:', error);
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };

    loadUserTickets();
  }, [authUser]);

  const upcomingTickets = tickets.filter(ticket => 
    new Date(ticket.eventDate) > new Date()
  );
  const pastTickets = tickets.filter(ticket => 
    new Date(ticket.eventDate) <= new Date()
  );

  const handleDownloadWalletPass = (ticket: any) => {
    // Mock wallet pass download - would integrate with Apple/Google Wallet
    console.log('Downloading wallet pass for:', ticket.eventTitle);
  };

  const showQRCode = (ticketId: string) => {
    setSelectedTicket(ticketId);
  };

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
            <Ticket className="text-white w-8 h-8" />
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1>My Tickets</h1>
            <p className="text-sm text-muted-foreground">
              {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-1" />
            Filter
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="h-full">
          <TabsList className="grid w-full grid-cols-2 sticky top-0 z-10 bg-background border-b">
            <TabsTrigger value="upcoming">
              Upcoming ({upcomingTickets.length})
            </TabsTrigger>
            <TabsTrigger value="past">
              Past ({pastTickets.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="p-4 space-y-4">
            {upcomingTickets.length > 0 ? (
              upcomingTickets.map((ticket) => (
                <Card key={ticket.id} className="overflow-hidden">
                  <div className="flex">
                    <ImageWithFallback
                      src={ticket.coverImage}
                      alt={ticket.eventTitle}
                      className="w-24 h-32 object-cover"
                    />
                    <div className="flex-1 p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-medium">{ticket.eventTitle}</h3>
                            <Badge variant="outline" className="text-xs">
                              {ticket.badge}
                            </Badge>
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {ticket.eventDate} at {ticket.eventTime}
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {ticket.eventLocation}
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {ticket.organizerName}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">${ticket.price}</div>
                          <Badge 
                            variant={ticket.status === 'confirmed' ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {ticket.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => showQRCode(ticket.id)}
                          className="flex-1"
                        >
                          <QrCode className="w-3 h-3 mr-1" />
                          QR Code
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDownloadWalletPass(ticket)}
                          className="flex-1"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Wallet
                        </Button>
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground">
                        <span>{ticket.tierName}</span>
                        <span className="mx-2">•</span>
                        <span>Ordered {new Date(ticket.orderDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-12">
                <Ticket className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg mb-2">No upcoming events</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Discover amazing events and get your tickets!
                </p>
                <Button onClick={onBack}>
                  Explore Events
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="p-4 space-y-4">
            {pastTickets.length > 0 ? (
              pastTickets.map((ticket) => (
                <Card key={ticket.id} className="overflow-hidden opacity-75">
                  <div className="flex">
                    <ImageWithFallback
                      src={ticket.coverImage}
                      alt={ticket.eventTitle}
                      className="w-24 h-32 object-cover grayscale"
                    />
                    <div className="flex-1 p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-medium">{ticket.eventTitle}</h3>
                            <Badge variant="outline" className="text-xs">
                              {ticket.badge}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              <Star className="w-3 h-3 mr-1" />
                              Attended
                            </Badge>
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {ticket.eventDate}
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {ticket.eventLocation}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">${ticket.price}</div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled className="flex-1">
                          Rate Event
                        </Button>
                        <Button size="sm" variant="outline" disabled className="flex-1">
                          Share Memory
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg mb-2">No past events</h3>
                <p className="text-sm text-muted-foreground">
                  Your attended events will appear here
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* QR Code Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
              <CardTitle>Event Ticket</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="w-48 h-48 bg-white mx-auto rounded-lg flex items-center justify-center">
                {/* Mock QR Code */}
                <div className="w-40 h-40 bg-black rounded-lg flex items-center justify-center">
                  <QrCode className="w-32 h-32 text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {tickets.find(t => t.id === selectedTicket)?.eventTitle}
                </p>
                <p className="text-xs text-muted-foreground">
                  Show this code at the entrance
                </p>
                <p className="text-xs font-mono bg-muted p-2 rounded">
                  {tickets.find(t => t.id === selectedTicket)?.qrCode}
                </p>
              </div>
              <Button onClick={() => setSelectedTicket(null)} className="w-full">
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default TicketsPage;