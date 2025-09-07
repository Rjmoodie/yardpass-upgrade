// src/components/TicketsPage.tsx

import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
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
  Ticket as TicketIcon,
  Calendar,
  MapPin,
  Users,
  Star,
  Filter,
  Download,
  QrCode,
  RefreshCw,
  AlertCircle,
  Share2,
  CalendarPlus
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

const formatUSD = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n || 0);

export function TicketsPage({ user, onBack }: TicketsPageProps) {
  const [selectedTab, setSelectedTab] = useState('upcoming');
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { tickets, upcomingTickets, pastTickets, loading, error, isOffline, refreshTickets, forceRefreshTickets } =
    useTickets();
  const { trackTicketView, trackQRCodeView, trackTicketShare, trackTicketCopy, trackWalletDownload } =
    useTicketAnalytics();

  // ——————————————————————————————————
  // ICS helpers
  // ——————————————————————————————————
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const toICSUTC = (iso: string) => {
    const d = new Date(iso);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
      d.getUTCHours()
    )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  };

  const escapeICS = (s: string) =>
    (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const buildICS = (ticket: UserTicket) => {
    const dtStart = toICSUTC(ticket.startAtISO);
    const dtEnd = toICSUTC(ticket.endAtISO || ticket.startAtISO);
    const uid = `${ticket.id}@yardpass`;
    const url = `${window.location.origin}/events/${ticket.eventId}`;
    const desc = `Your ticket (${ticket.badge} - ${ticket.ticketType}). Show your QR at entry.\n${url}`;
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//YardPass//Tickets//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${toICSUTC(new Date().toISOString())}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeICS(ticket.eventTitle)}`,
      `DESCRIPTION:${escapeICS(desc)}`,
      `LOCATION:${escapeICS(ticket.eventLocation || '')}`,
      `URL:${url}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    return ics;
  };

  const downloadICS = async (ticket: UserTicket) => {
    try {
      const content = buildICS(ticket);
      const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
      const fileName = `${ticket.eventTitle.replace(/[^\w\s-]/g, '')}.ics`;

      // Mobile-native share with a file if available
      if ((navigator as any).canShare && 'share' in navigator) {
        const file = new File([blob], fileName, { type: 'text/calendar' });
        if ((navigator as any).canShare({ files: [file] })) {
          await (navigator as any).share({
            title: ticket.eventTitle,
            text: 'Add to calendar',
            files: [file],
          });
          toast({ title: 'Shared to Calendar apps' });
          return;
        }
      }

      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({
        title: 'ICS downloaded',
        description: 'Open it to add to your calendar.',
      });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Calendar error',
        description: 'Could not create calendar file.',
        variant: 'destructive',
      });
    }
  };

  // ——————————————————————————————————
  // Ticket actions
  // ——————————————————————————————————
  const showQRCode = (ticketId: string) => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (ticket) {
      trackQRCodeView(ticket.id, ticket.eventId, user.id);
    }
    setSelectedTicket(ticketId);
  };

  const handleCopyQRCode = async (ticket: UserTicket) => {
    try {
      const qrData = generateQRData({
        id: ticket.id,
        eventId: ticket.eventId,
        qrCode: ticket.qrCode,
        userId: user.id,
      });

      await copyQRDataToClipboard(qrData);
      trackTicketCopy(ticket.id, ticket.eventId, user.id);

      toast({
        title: 'Copied!',
        description: 'Ticket information copied to clipboard',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy ticket information',
        variant: 'destructive',
      });
    }
  };

  const handleShareTicket = async (ticket: UserTicket) => {
    try {
      const qrData = generateQRData({
        id: ticket.id,
        eventId: ticket.eventId,
        qrCode: ticket.qrCode,
        userId: user.id,
      });

      await shareQRData(qrData);
      trackTicketShare(ticket.id, ticket.eventId, user.id, 'native_share');

      toast({
        title: 'Shared!',
        description: 'Ticket shared successfully',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to share ticket',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadWalletPass = (ticket: UserTicket) => {
    // Placeholder until native pass is wired up
    trackWalletDownload(ticket.id, ticket.eventId, user.id);
    toast({
      title: 'Wallet Pass',
      description: 'Wallet integration coming soon! Use Add to Calendar or QR Code meanwhile.',
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      console.log('🔄 Force refreshing tickets...');
      await forceRefreshTickets();
      toast({
        title: 'Tickets Refreshed',
        description: 'Your tickets have been updated.',
      });
    } catch (error) {
      console.error('❌ Refresh failed:', error);
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh tickets. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Emergency refresh function that bypasses all caching
  const handleEmergencyRefresh = async () => {
    setIsRefreshing(true);
    try {
      console.log('🚨 Emergency refresh - bypassing all cache...');
      
      // Clear any cached data
      if (typeof window !== 'undefined' && window.localStorage) {
        const keys = Object.keys(window.localStorage);
        keys.forEach(key => {
          if (key.includes('ticket') || key.includes('cache')) {
            window.localStorage.removeItem(key);
          }
        });
      }
      
      // Force refresh
      await forceRefreshTickets();
      
      toast({
        title: 'Emergency Refresh Complete',
        description: 'All cached data cleared and tickets refreshed.',
      });
    } catch (error) {
      console.error('❌ Emergency refresh failed:', error);
      toast({
        title: 'Emergency Refresh Failed',
        description: 'Please contact support if the issue persists.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // ——————————————————————————————————
  // Render
  // ——————————————————————————————————
  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
            <TicketIcon className="text-white w-8 h-8" />
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
          <button onClick={onBack} className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1>My Tickets</h1>
            <p className="text-sm text-muted-foreground">
              {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}{' '}
              {isOffline && <span className="ml-1">(offline)</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleEmergencyRefresh} disabled={isRefreshing} className="text-orange-600 hover:text-orange-700">
              <AlertCircle className="w-4 h-4 mr-1" />
              Force Refresh
            </Button>
            <Button variant="outline" size="sm" disabled title="Filters coming soon">
              <Filter className="w-4 h-4 mr-1" />
              Filter
            </Button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4">
          <Card className="border-destructive">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Error Loading Tickets</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-2">
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
            <TabsTrigger value="upcoming">Upcoming ({upcomingTickets.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({pastTickets.length})</TabsTrigger>
          </TabsList>

          {/* Upcoming */}
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
                          <div className="text-sm font-medium">{formatUSD(ticket.price)}</div>
                          <Badge
                            variant={ticket.status === 'issued' ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {ticket.status === 'issued' ? 'confirmed' : ticket.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
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

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadICS(ticket)}
                          className="flex-1"
                          title="Add to Calendar (.ics)"
                        >
                          <CalendarPlus className="w-3 h-3 mr-1" />
                          Calendar
                        </Button>
                      </div>

                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleShareTicket(ticket)}
                          className="text-muted-foreground"
                        >
                          <Share2 className="w-3 h-3 mr-1" />
                          Share
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Ordered {new Date(ticket.orderDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-12">
                <TicketIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg mb-2">No upcoming events</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Discover amazing events and get your tickets!
                </p>
                <Button onClick={onBack}>Explore Events</Button>
              </div>
            )}
          </TabsContent>

          {/* Past */}
          <TabsContent value="past" className="p-4 space-y-4">
            {pastTickets.length > 0 ? (
              pastTickets.map((ticket) => (
                <Card key={ticket.id} className="overflow-hidden opacity-90">
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
                          <div className="text-sm font-medium">{formatUSD(ticket.price)}</div>
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
                <p className="text-sm text-muted-foreground">Your attended events will appear here</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* QR Code Modal */}
      {selectedTicket && (
        <QRCodeModal
          ticket={tickets.find((t) => t.id === selectedTicket)!}
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
