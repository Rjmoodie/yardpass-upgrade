import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useTickets, UserTicket } from '@/hooks/useTickets';
import { toast } from '@/hooks/use-toast';
import { copyQRDataToClipboard, shareQRData, generateQRData } from '@/lib/qrCode';
import { QRCodeModal } from '@/components/QRCodeModal';
import { useTicketAnalytics } from '@/hooks/useTicketAnalytics';
import {
  ArrowLeft,
  Ticket,
  Calendar,
  MapPin,
  Users,
  Star,
  Filter,
  Download,
  QrCode,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  role: 'attendee' | 'organizer';
}

interface TicketsPageProps {
  user: User;
  onBack: () => void;
}

export function TicketsPage({ user, onBack }: TicketsPageProps) {
  const [selectedTab, setSelectedTab] = useState('upcoming');
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { tickets, upcomingTickets, pastTickets, loading, error, isOffline, refreshTickets } = useTickets();
  const { trackTicketView, trackQRCodeView, trackTicketShare, trackTicketCopy, trackWalletDownload } = useTicketAnalytics();

  const viewedSetRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Track views for tickets visible in the current tab only once per session
    const sourceList = selectedTab === 'upcoming' ? upcomingTickets : pastTickets;
    for (const t of sourceList) {
      if (!viewedSetRef.current.has(t.id)) {
        viewedSetRef.current.add(t.id);
        trackTicketView(t.id, t.eventId, user.id);
      }
    }
  }, [selectedTab, upcomingTickets, pastTickets, trackTicketView, user.id]);

  const handleDownloadWalletPass = (ticket: UserTicket) => {
    trackWalletDownload(ticket.id, ticket.eventId, user.id);
    toast({
      title: "Wallet Pass",
      description: "Wallet integration coming soon. Use the QR in the meantime.",
    });
  };

  const showQRCode = (ticketId: string) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) trackQRCodeView(ticket.id, ticket.eventId, user.id);
    setSelectedTicket(ticketId);
  };

  const handleCopyQRCode = async (ticket: UserTicket) => {
    try {
      const qrData = generateQRData({
        id: ticket.id,
        eventId: ticket.eventId,
        qrCode: ticket.qrCode,
        userId: user.id
      });
      await copyQRDataToClipboard(qrData);
      trackTicketCopy(ticket.id, ticket.eventId, user.id);
      toast({ title: "Copied", description: "Ticket info copied to clipboard" });
    } catch {
      toast({
        title: "Copy failed",
        description: "Unable to copy ticket info",
        variant: "destructive",
      });
    }
  };

  const handleShareTicket = async (ticket: UserTicket) => {
    try {
      const qrData = generateQRData({
        id: ticket.id,
        eventId: ticket.eventId,
        qrCode: ticket.qrCode,
        userId: user.id
      });
      await shareQRData(qrData);
      trackTicketShare(ticket.id, ticket.eventId, user.id, 'native_share');
      toast({ title: "Shared", description: "Ticket shared successfully" });
    } catch {
      toast({
        title: "Share failed",
        description: "Unable to share ticket",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = async () => {
    if (loading) return;
    setIsRefreshing(true);
    try {
      await refreshTickets();
      toast({ title: "Tickets Refreshed", description: "Your tickets are up to date." });
    } catch {
      toast({
        title: "Refresh Failed",
        description: "Could not refresh tickets. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
            <Ticket className="text-white w-8 h-8" />
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
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
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1>My Tickets</h1>
            <p className="text-sm text-muted-foreground">
              {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" disabled>
              <Filter className="w-4 h-4 mr-1" />
              Filter
            </Button>
          </div>
        </div>

        {isOffline && (
          <div className="mt-3 rounded-lg border border-yellow-600/30 bg-yellow-500/10 text-yellow-200 p-2 text-xs">
            You’re offline — showing cached tickets.
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4">
          <Card className="border-destructive/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Error Loading Tickets</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="mt-2"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

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
                            variant={ticket.status === 'issued' ? 'secondary' : 'outline'}
                            className="text-xs capitalize"
                          >
                            {ticket.status === 'issued' ? 'confirmed' : ticket.status}
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
                        <span>{ticket.ticketType}</span>
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
                <Button onClick={onBack}>Explore Events</Button>
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
                  Your attended events will appear here.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* QR Code Modal */}
      {selectedTicket && (
        <QRCodeModal
          ticket={tickets.find(t => t.id === selectedTicket)!}
          user={user}
          onClose={() => setSelectedTicket(null)}
          onCopy={handleCopyQRCode}
          onShare={handleShareTicket}
        />
      )}
    </div>
  );
}

export default TicketsPage;
