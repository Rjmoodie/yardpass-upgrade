// src/components/TicketsPage.tsx
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { routes } from '@/lib/routes';
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
  CalendarPlus,
  ExternalLink
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

// Format helpers for ICS
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toICSUTC = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours()
  )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};
const escapeICS = (s: string) =>
  (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function TicketsPage({ user, onBack }: TicketsPageProps) {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    tickets,
    upcomingTickets,
    pastTickets,
    loading,
    error,
    isOffline,
    refreshTickets,
    forceRefreshTickets,
  } = useTickets();

  const {
    trackTicketView,
    trackQRCodeView,
    trackTicketShare,
    trackTicketCopy,
    trackWalletDownload,
  } = useTicketAnalytics();

  const totalCount = useMemo(() => tickets.length, [tickets]);

  // Build ICS content
  const buildICS = (ticket: UserTicket) => {
    const dtStart = toICSUTC(ticket.startAtISO);
    const dtEnd = toICSUTC(ticket.endAtISO || ticket.startAtISO);
    const uid = `${ticket.id}@yardpass`;
    const url = `${window.location.origin}${routes.event(ticket.eventId)}`;
    const desc = `Your ticket (${ticket.badge} - ${ticket.ticketType}). Show your QR at entry.\n${url}`;
    return [
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

  // Ticket actions
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

      toast({ title: 'Copied!', description: 'Ticket information copied to clipboard' });
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

      toast({ title: 'Shared!', description: 'Ticket shared successfully' });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to share ticket',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadWalletPass = (ticket: UserTicket) => {
    trackWalletDownload(ticket.id, ticket.eventId, user.id);
    toast({
      title: 'Wallet Pass',
      description:
        'Wallet integration coming soon! Use Add to Calendar or QR Code in the meantime.',
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await forceRefreshTickets();
      toast({ title: 'Tickets Refreshed', description: 'Your tickets have been updated.' });
    } catch (err) {
      console.error('Refresh failed:', err);
      toast({
        title: 'Refresh Failed',
        description: 'Could not refresh tickets. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Prevent inner button clicks from triggering card navigation
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // Render — loading
  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto shadow-xl animate-pulse">
            <TicketIcon className="text-white w-10 h-10" />
          </div>
          <div className="space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="text-muted-foreground font-medium">Loading your tickets...</p>
            <p className="text-sm text-muted-foreground">This may take a moment</p>
          </div>
        </div>
      </div>
    );
  }

  const errorText =
    typeof error === 'string'
      ? error
      : (error as any)?.message || (error ? 'Something went wrong.' : '');

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
              {totalCount} ticket{totalCount !== 1 ? 's' : ''}{' '}
              {isOffline && <span className="ml-1">(offline)</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
              aria-label="Refresh tickets"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Filters coming soon"
              className="hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
              aria-label="Filter tickets"
            >
              <Filter className="w-4 h-4 mr-1" />
              Filter
            </Button>
          </div>
        </div>

        {isOffline && (
          <div className="mt-3 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-3 py-2">
            You’re viewing cached tickets while offline. Some actions may be unavailable.
          </div>
        )}
      </div>

      {/* Error State */}
      {errorText && (
        <div className="p-4">
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-red-700 mb-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Error Loading Tickets</h3>
                  <p className="text-sm text-red-600 mt-1">{errorText}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshTickets}
                className="mt-3 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-all duration-200"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)} className="h-full">
          <TabsList className="grid w-full grid-cols-2 sticky top-0 z-10 bg-background border-b">
            <TabsTrigger value="upcoming">Upcoming ({upcomingTickets.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({pastTickets.length})</TabsTrigger>
          </TabsList>

          {/* UPCOMING */}
          <TabsContent value="upcoming" className="p-4 space-y-4">
            {upcomingTickets.length > 0 ? (
              upcomingTickets.map((ticket) => (
                <Card
                  key={ticket.id}
                  className="overflow-hidden cursor-pointer group"
                  onClick={() => {
                    trackTicketView(ticket.id, ticket.eventId, user.id);
                    navigate(routes.event(ticket.eventId));
                  }}
                  role="button"
                  aria-label={`Open event ${ticket.eventTitle}`}
                >
                  <div className="flex">
                    <ImageWithFallback
                      src={ticket.coverImage}
                      alt={ticket.eventTitle}
                      className="w-24 h-32 object-cover"
                    />
                    <div className="flex-1 p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          {/* Title & badge are also explicit links */}
                          <div className="flex items-center gap-2 mb-1">
                            <button
                              className="text-sm font-medium hover:underline text-left"
                              onClick={(e) => {
                                stop(e);
                                trackTicketView(ticket.id, ticket.eventId, user.id);
                                navigate(routes.event(ticket.eventId));
                              }}
                              aria-label={`Open event ${ticket.eventTitle}`}
                            >
                              {ticket.eventTitle}
                            </button>
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

                      {/* Primary actions */}
                      <div className="grid grid-cols-4 gap-2">
                        <Button size="sm" variant="outline" onClick={stop}>
                          {/* explicit “Open Event” that won’t get blocked by other onClicks */}
                          <span className="sr-only">Open Event</span>
                          <ExternalLink className="w-3 h-3 mr-1" />
                          <span
                            onClick={(e) => {
                              // nested click to prevent bubbling
                              e.stopPropagation();
                              trackTicketView(ticket.id, ticket.eventId, user.id);
                              navigate(routes.event(ticket.eventId));
                            }}
                          >
                            Event
                          </span>
                        </Button>

                        <Button size="sm" variant="outline" onClick={(e) => { stop(e); showQRCode(ticket.id); }}>
                          <QrCode className="w-3 h-3 mr-1" />
                          QR Code
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            stop(e);
                            handleDownloadWalletPass(ticket);
                          }}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Wallet
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            stop(e);
                            downloadICS(ticket);
                          }}
                          title="Add to Calendar (.ics)"
                        >
                          <CalendarPlus className="w-3 h-3 mr-1" />
                          Calendar
                        </Button>
                      </div>

                      <div className="mt-2 flex gap-2 items-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            stop(e);
                            handleShareTicket(ticket);
                          }}
                          className="text-muted-foreground"
                          aria-label="Share ticket"
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

          {/* PAST */}
          <TabsContent value="past" className="p-4 space-y-4">
            {pastTickets.length > 0 ? (
              pastTickets.map((ticket) => (
                <Card
                  key={ticket.id}
                  className="overflow-hidden opacity-90 cursor-pointer"
                  onClick={() => navigate(routes.event(ticket.eventId))}
                  role="button"
                  aria-label={`Open event ${ticket.eventTitle}`}
                >
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
                            <button
                              className="text-sm font-medium hover:underline text-left"
                              onClick={(e) => {
                                stop(e);
                                navigate(routes.event(ticket.eventId));
                              }}
                            >
                              {ticket.eventTitle}
                            </button>
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
                        <Button size="sm" variant="outline" disabled className="flex-1" onClick={stop}>
                          Rate Event
                        </Button>
                        <Button size="sm" variant="outline" disabled className="flex-1" onClick={stop}>
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
