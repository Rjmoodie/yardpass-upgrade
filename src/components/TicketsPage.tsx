import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QRCodeModal } from '@/components/QRCodeModal';
import { useTickets } from '@/hooks/useTickets';
import { useTicketAnalytics } from '@/hooks/useTicketAnalytics';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Ticket as TicketIcon,
  QrCode,
  Download,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Wallet,
  Share,
  Copy,
  CheckCircle,
  XCircle,
  Globe,
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  role: 'attendee' | 'organizer';
}

interface TicketsPageProps {
  user?: User;
  guestToken?: string;
  guestScope?: { all?: boolean; eventIds?: string[] };
  onGuestSignOut?: () => void;
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
const escapeICS = (str: string) =>
  str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export default function TicketsPage({ 
  user, 
  guestToken, 
  guestScope, 
  onGuestSignOut, 
  onBack 
}: TicketsPageProps) {
  const { tickets: userTickets, loading: userLoading, error: userError, refreshTickets } = useTickets();
  const [guestTickets, setGuestTickets] = useState<any[]>([]);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState<Error | null>(null);
  
  const tickets = guestToken ? guestTickets : userTickets;
  const loading = guestToken ? guestLoading : userLoading;
  const error = guestToken ? guestError : userError;

  const { trackTicketView, trackQRCodeView, trackTicketShare } = useTicketAnalytics();

  // Fetch guest tickets
  useEffect(() => {
    if (!guestToken) return;
    
    let cancelled = false;
    setGuestLoading(true);
    setGuestError(null);
    
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('tickets-list-guest', {
          body: { token: guestToken },
        });
        
        if (error) throw error;
        if (!cancelled) {
          setGuestTickets(data?.tickets || []);
        }
      } catch (e) {
        if (!cancelled) {
          setGuestError(e as Error);
        }
      } finally {
        if (!cancelled) {
          setGuestLoading(false);
        }
      }
    })();
    
    return () => { cancelled = true; };
  }, [guestToken]);

  const [selectedTab, setSelectedTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    if (guestToken) {
      // Re-fetch guest tickets
      setGuestLoading(true);
      setGuestError(null);
      
      supabase.functions.invoke('tickets-list-guest', {
        body: { token: guestToken },
      }).then(({ data, error }) => {
        if (error) throw error;
        setGuestTickets(data?.tickets || []);
      }).catch((e) => {
        setGuestError(e as Error);
      }).finally(() => {
        setGuestLoading(false);
      });
    } else {
      setIsRefreshing(true);
      refreshTickets();
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  // Build ICS calendar content
  const buildICS = (ticket: any) => {
    const event = ticket.event;
    const dtstart = toICSUTC(event.start_at);
    const dtend = event.end_at ? toICSUTC(event.end_at) : '';
    const summary = escapeICS(event.title);
    const description = escapeICS(`Ticket: ${ticket.tier.name}\nEvent: ${event.title}`);
    const location = escapeICS(event.venue || '');
    const uid = `ticket-${ticket.id}@yardpass.app`;

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//YardPass//EN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${dtstart}`,
      dtend ? `DTEND:${dtend}` : '',
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      location ? `LOCATION:${location}` : '',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(Boolean)
      .join('\r\n');
  };

  // Download ICS file
  const downloadICS = (ticket: any) => {
    const icsContent = buildICS(ticket);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${ticket.event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Show QR code modal
  const showQRCode = (ticket: any) => {
    setSelectedTicket(ticket);
    if (user) {
      trackQRCodeView(ticket.id, ticket.event.id, user.id);
    }
  };

  // Copy QR code data to clipboard
  const handleCopyQRCode = async (qrData: string) => {
    try {
      await navigator.clipboard.writeText(qrData);
      // Success feedback handled by QRCodeModal
    } catch (err) {
      console.error('Failed to copy QR code:', err);
    }
  };

  // Share ticket
  const handleShareTicket = (ticket: any) => {
    const shareData = {
      title: `My ticket to ${ticket.event.title}`,
      text: `Check out my ticket to ${ticket.event.title}!`,
      url: window.location.href,
    };

    if (navigator.share && navigator.canShare(shareData)) {
      navigator.share(shareData);
    } else {
      // Fallback: copy URL to clipboard
      navigator.clipboard.writeText(window.location.href);
    }

    if (user) {
      trackTicketShare(ticket.id, ticket.event.id, user.id, 'share');
    }
  };

  // Handle wallet pass download
  const handleDownloadWalletPass = (ticket: any) => {
    if (ticket.wallet_pass_url) {
      window.open(ticket.wallet_pass_url, '_blank');
    }
  };

  // Filter tickets
  const now = new Date();
  const upcomingTickets = tickets.filter((ticket) => new Date(ticket.event.start_at) > now);
  const pastTickets = tickets.filter((ticket) => new Date(ticket.event.start_at) <= now);
  const totalCount = tickets.length;
  const isOffline = false; // You can implement offline detection if needed

  // Track ticket views
  useEffect(() => {
    tickets.forEach((ticket) => {
      if (user) {
        trackTicketView(ticket.id, ticket.event.id, user.id);
      }
    });
  }, [tickets, trackTicketView, user]);

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
        {guestToken && (
          <div className="mb-4 rounded-md border bg-muted/40 p-3 text-sm">
            Viewing tickets for the verified contact.{" "}
            {onGuestSignOut && (
              <button className="underline ml-2" onClick={onGuestSignOut}>
                Use a different email/phone
              </button>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">
              {guestToken ? 'Your Tickets' : 'My Tickets'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {guestToken ? 'Tickets for your verified contact' : `Welcome back, ${user?.name}`}
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
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Offline indicator */}
      {isOffline && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <div className="flex items-center gap-2 text-yellow-800 text-sm">
            <Globe className="w-4 h-4" />
            You're viewing cached tickets while offline. Some actions may be unavailable.
          </div>
        </div>
      )}

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
                onClick={handleRefresh}
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      {!errorText && (
        <div className="flex-1 p-4">
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="upcoming" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Upcoming ({upcomingTickets.length})
              </TabsTrigger>
              <TabsTrigger value="past" className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Past ({pastTickets.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="space-y-4">
              {upcomingTickets.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <TicketIcon className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No upcoming events</h3>
                  <p className="text-muted-foreground">
                    You don't have any tickets for upcoming events yet.
                  </p>
                </div>
              ) : (
                upcomingTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onShowQRCode={showQRCode}
                    onDownloadCalendar={downloadICS}
                    onDownloadWalletPass={handleDownloadWalletPass}
                    onShare={handleShareTicket}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-4">
              {pastTickets.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <TicketIcon className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No past events</h3>
                  <p className="text-muted-foreground">
                    Your past event tickets will appear here.
                  </p>
                </div>
              ) : (
                pastTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onShowQRCode={showQRCode}
                    onDownloadCalendar={downloadICS}
                    onDownloadWalletPass={handleDownloadWalletPass}
                    onShare={handleShareTicket}
                    isPast
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* QR Code Modal */}
      {selectedTicket && user && (
        <QRCodeModal
          ticket={selectedTicket}
          user={user}
          onClose={() => setSelectedTicket(null)}
          onCopy={() => handleCopyQRCode(selectedTicket.qr_code)}
          onShare={() => handleShareTicket(selectedTicket)}
        />
      )}
    </div>
  );
}

// Ticket Card Component
function TicketCard({
  ticket,
  onShowQRCode,
  onDownloadCalendar,
  onDownloadWalletPass,
  onShare,
  isPast = false,
}: {
  ticket: any;
  onShowQRCode: (ticket: any) => void;
  onDownloadCalendar: (ticket: any) => void;
  onDownloadWalletPass: (ticket: any) => void;
  onShare: (ticket: any) => void;
  isPast?: boolean;
}) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusBadge = (status: string, isRedeemed: boolean) => {
    if (isPast && isRedeemed) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Attended</Badge>;
    }
    if (isPast && !isRedeemed) {
      return <Badge variant="secondary">Missed</Badge>;
    }
    
    switch (status) {
      case 'issued':
        return <Badge variant="default">Active</Badge>;
      case 'transferred':
        return <Badge variant="outline">Transferred</Badge>;
      case 'redeemed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Used</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-lg">
      <CardContent className="p-0">
        <div className="flex">
          {/* Event Image */}
          <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0">
            {ticket.event.cover_image_url ? (
              <img
                src={ticket.event.cover_image_url}
                alt={ticket.event.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <TicketIcon className="w-8 h-8 text-muted-foreground" />
            )}
          </div>

          {/* Ticket Details */}
          <div className="flex-1 p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold text-lg leading-tight mb-1">
                  {ticket.event.title}
                </h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(ticket.event.start_at)}</span>
                  <Clock className="w-4 h-4 ml-2" />
                  <span>{formatTime(ticket.event.start_at)}</span>
                </div>
                {ticket.event.venue && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{ticket.event.venue}</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                {getStatusBadge(ticket.status, !!ticket.redeemed_at)}
                <div className="mt-1 text-sm font-medium">
                  {formatUSD((ticket.tier.price_cents || 0) / 100)}
                </div>
              </div>
            </div>

            {/* Ticket Type */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {ticket.tier.name}
                </Badge>
                {ticket.tier.badge_label && (
                  <Badge variant="secondary" className="text-xs">
                    {ticket.tier.badge_label}
                  </Badge>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/e/${ticket.event.id}`, '_blank')}
                className="flex-1 min-w-[80px]"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Event
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onShowQRCode(ticket)}
                className="flex-1 min-w-[80px]"
              >
                <QrCode className="w-4 h-4 mr-1" />
                QR Code
              </Button>

              {ticket.wallet_pass_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDownloadWalletPass(ticket)}
                  className="flex-1 min-w-[80px]"
                >
                  <Wallet className="w-4 h-4 mr-1" />
                  Wallet
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownloadCalendar(ticket)}
                className="flex-1 min-w-[80px]"
              >
                <Download className="w-4 h-4 mr-1" />
                Calendar
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onShare(ticket)}
                className="flex-1 min-w-[80px]"
              >
                <Share className="w-4 h-4 mr-1" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}