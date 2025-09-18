// src/pages/TicketsPage.tsx (enhanced UI + visibility)
// — Keeps your data flow intact, focuses on visuals and a11y.

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QRCodeModal } from '@/components/QRCodeModal';
import { useTickets } from '@/hooks/useTickets';
import { useTicketAnalytics } from '@/hooks/useTicketAnalytics';
import { useToast } from '@/hooks/use-toast';
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
  CheckCircle,
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

// --------------- ICS helpers ---------------
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toICSUTC = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours()
  )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};
const escapeICS = (str: string) =>
  (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');

export default function TicketsPage({
  user,
  guestToken,
  guestScope, // reserved for future filtering UI
  onGuestSignOut,
  onBack,
}: TicketsPageProps) {
  const { toast } = useToast();
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
        if (!cancelled) setGuestTickets(data?.tickets || []);
      } catch (e) {
        if (!cancelled) setGuestError(e as Error);
      } finally {
        if (!cancelled) setGuestLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [guestToken]);

  const [selectedTab, setSelectedTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    if (guestToken) {
      setGuestLoading(true);
      setGuestError(null);
      supabase.functions
        .invoke('tickets-list-guest', { body: { token: guestToken } })
        .then(({ data, error }) => {
          if (error) throw error;
          setGuestTickets(data?.tickets || []);
        })
        .catch((e) => setGuestError(e as Error))
        .finally(() => setGuestLoading(false));
    } else {
      setIsRefreshing(true);
      refreshTickets();
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  // Build ICS calendar content
  const buildICS = (ticket: any) => {
    const dtstart = toICSUTC(ticket?.startAtISO);
    const dtend = ticket?.endAtISO ? toICSUTC(ticket.endAtISO) : '';
    const summary = escapeICS(ticket?.eventTitle);
    const description = escapeICS(`Ticket: ${ticket?.ticketType}\nEvent: ${ticket?.eventTitle}`);
    const location = escapeICS(ticket?.venue || '');
    const uid = `ticket-${ticket?.id}@yardpass.app`;

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
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(ticket?.eventTitle || 'event').replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Show QR code modal
  const showQRCode = (ticket: any) => {
    setSelectedTicket(ticket);
    if (user && ticket?.id && ticket?.eventId) {
      trackQRCodeView(ticket.id, ticket.eventId, user.id);
    }
  };

  // Share ticket
  const handleShareTicket = async (ticket: any) => {
    try {
      const shareData = {
        title: `My ticket to ${ticket?.eventTitle || 'Event'}`,
        text: `Check out my ticket to ${ticket?.eventTitle || 'Event'}!`,
        url: window.location.href,
      };

      if ((navigator as any).share && (navigator as any).canShare?.(shareData)) {
        await (navigator as any).share(shareData);
        toast({ title: 'Shared successfully', description: 'Ticket shared!' });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast({ title: 'Link copied', description: 'Ticket link copied to clipboard!' });
      }

      if (user && ticket?.id && ticket?.eventId) {
        trackTicketShare(ticket.id, ticket.eventId, user.id, 'share');
      }
    } catch {
      toast({
        title: 'Share failed',
        description: 'Could not share the ticket. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadWalletPass = (ticket: any) => {
    if (ticket?.wallet_pass_url) window.open(ticket.wallet_pass_url, '_blank');
  };

  // Filter tickets
  const now = new Date();
  const upcomingTickets = tickets.filter((t) => t?.startAtISO && new Date(t.startAtISO) > now);
  const pastTickets = tickets.filter((t) => t?.startAtISO && new Date(t.startAtISO) <= now);

  // Track views
  useEffect(() => {
    tickets.forEach((t) => {
      if (user && t?.id && t?.eventId) trackTicketView(t.id, t.eventId, user.id);
    });
  }, [tickets, trackTicketView, user]);

  const errorText =
    typeof error === 'string' ? error : (error as any)?.message || (error ? 'Something went wrong.' : '');

  // --------------------- UI ---------------------
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky header with mobile-optimized design */}
      <div className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur-lg shadow-sm">
        {guestToken && (
          <div className="px-3 sm:px-4 py-2 text-xs sm:text-sm bg-amber-50/70 dark:bg-amber-500/10 border-b border-amber-200/60 dark:border-amber-400/20">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1">
              <span>Viewing tickets for verified contact</span>
              {onGuestSignOut && (
                <button className="underline text-left text-primary hover:text-primary/80 transition-colors" onClick={onGuestSignOut}>
                  Use different email/phone
                </button>
              )}
            </div>
          </div>
        )}

        <div className="p-3 sm:p-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="mobile-button flex-shrink-0 p-2 rounded-full hover:bg-muted transition-colors focus-ring touch-manipulation"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">
              {guestToken ? 'Your Tickets' : 'My Tickets'}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {guestToken ? 'Verified contact tickets' : `Welcome back, ${user?.name || 'there'}`}
            </p>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="mobile-button hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 btn-enhanced touch-manipulation"
              aria-label="Refresh tickets"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Error */}
      {errorText && (
        <div className="p-4">
          <Card className="border-red-200 bg-red-50/60 dark:bg-red-950/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-red-700 dark:text-red-300 mb-3">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-full grid place-items-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Error Loading Tickets</h3>
                  <p className="text-sm mt-1">{errorText}</p>
                </div>
              </div>
              <Button variant="outline" onClick={handleRefresh} className="border-red-300 text-red-700 dark:text-red-300">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main */}
      {!errorText && (
        <div className="flex-1 px-3 sm:px-4 pb-3 sm:pb-4 safe-bottom-pad">
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)} className="w-full">
            {/* Mobile-optimized tabs */}
            <div className="tabs-mobile mb-4 sm:mb-6">
              <TabsTrigger value="upcoming" className="tab-enhanced">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">Upcoming</span>
                <span className="ml-1 sm:ml-2 inline-flex h-4 min-w-[16px] px-1 rounded-full bg-secondary text-[10px] sm:text-xs items-center justify-center flex-shrink-0">
                  {upcomingTickets.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="past" className="tab-enhanced">
                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">Past</span>
                <span className="ml-1 sm:ml-2 inline-flex h-4 min-w-[16px] px-1 rounded-full bg-secondary text-[10px] sm:text-xs items-center justify-center flex-shrink-0">
                  {pastTickets.length}
                </span>
              </TabsTrigger>
            </div>

            <TabsContent value="upcoming" className="space-y-4">
              {loading ? (
                <SkeletonTickets />
              ) : upcomingTickets.length === 0 ? (
                <EmptyState title="No upcoming events" subtitle="You don’t have tickets for upcoming events yet." />
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
              {loading ? (
                <SkeletonTickets />
              ) : pastTickets.length === 0 ? (
                <EmptyState title="No past events" subtitle="Your past event tickets will appear here." />
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

      {/* QR Modal */}
      {selectedTicket && user && (
        <QRCodeModal
          ticket={selectedTicket}
          user={user}
          onClose={() => setSelectedTicket(null)}
          onCopy={() => {}}
          onShare={() => handleShareTicket(selectedTicket)}
          // Optional: override the logo used inside the QR
          logoUrl="/yardpass-qr-logo.png"
        />
      )}
    </div>
  );
}

// ---------------- Components ----------------

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 rounded-2xl grid place-items-center mx-auto mb-4 brand-gradient text-foreground/90 shadow-md">
        <TicketIcon className="w-10 h-10" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function SkeletonTickets() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 sm:h-28 skeleton rounded-lg" />
      ))}
    </div>
  );
}

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
  const dateStr = ticket?.eventDate || '';
  const timeStr = ticket?.eventTime || '';
  const venue = ticket?.venue || ticket?.eventLocation || '';

  const statusBadge = (() => {
    const status = ticket?.status || (isPast ? (ticket?.redeemed_at ? 'attended' : 'missed') : 'issued');
    const C = ({ children, className = '' }: any) => (
      <Badge variant="secondary" className={`text-xs px-2 py-0.5 ${className}`}>{children}</Badge>
    );
    switch (status) {
      case 'issued':
        return <C className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</C>;
      case 'redeemed':
      case 'attended':
        return <C className="bg-green-100 text-green-800 border-green-200">Attended</C>;
      case 'transferred':
        return <C className="bg-blue-50 text-blue-700 border-blue-200">Transferred</C>;
      case 'missed':
        return <C className="bg-slate-100 text-slate-700 border-slate-200">Missed</C>;
      default:
        return <C>{status}</C>;
    }
  })();

  return (
    <Card className="overflow-hidden transition-all duration-200 card-enhanced hover:app-glow">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Event image - mobile full width, desktop left side */}
          <div className="w-full h-32 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-muted/60 grid place-items-center flex-shrink-0">
            {ticket?.coverImage ? (
              <img 
                src={ticket.coverImage} 
                alt={ticket?.eventTitle || 'Event cover'} 
                className="w-full h-full object-cover" 
              />
            ) : (
              <TicketIcon className="w-8 h-8 text-muted-foreground" aria-hidden />
            )}
          </div>

          {/* Details */}
          <div className="flex-1 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-base sm:text-lg leading-tight truncate">
                  {ticket?.eventTitle || 'Event'}
                </h3>
                <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">{dateStr || 'Date'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">{timeStr || 'Time'}</span>
                  </span>
                  {venue && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="truncate">{venue}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex sm:flex-col items-start sm:items-end gap-2 sm:text-right">
                <div>{statusBadge}</div>
                <div className="text-sm font-semibold">{formatUSD(ticket?.price || 0)}</div>
              </div>
            </div>

            {/* Tags */}
            <div className="mt-2 flex items-center gap-1 sm:gap-2">
              <Badge variant="outline" className="text-[10px] sm:text-xs px-1 sm:px-2">
                {ticket?.ticketType || 'General'}
              </Badge>
              {ticket?.badge && (
                <Badge variant="secondary" className="text-[10px] sm:text-xs px-1 sm:px-2">
                  {ticket.badge}
                </Badge>
              )}
            </div>

            {/* Mobile Actions - Streamlined */}
            <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row gap-2">
              {/* Primary action - QR Code */}
              <Button
                size="sm"
                onClick={() => onShowQRCode(ticket)}
                className="premium-button mobile-button touch-manipulation flex-1 sm:flex-initial"
                aria-label="Show QR code"
              >
                <QrCode className="w-4 h-4 mr-2" />
                <span className="font-semibold">Show QR Code</span>
              </Button>

              {/* Secondary actions - Mobile optimized grid */}
              <div className="grid grid-cols-2 sm:flex gap-2 flex-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/e/${ticket?.eventId || ''}`, '_blank')}
                  className="btn-enhanced mobile-button touch-manipulation"
                  aria-label="Open event page"
                >
                  <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="truncate">Event</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDownloadCalendar(ticket)}
                  className="btn-enhanced mobile-button touch-manipulation"
                  aria-label="Download calendar file"
                >
                  <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="truncate">Calendar</span>
                </Button>

                {ticket?.wallet_pass_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDownloadWalletPass(ticket)}
                    className="btn-enhanced mobile-button touch-manipulation"
                    aria-label="Add to wallet"
                  >
                    <Wallet className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    <span className="truncate">Wallet</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onShare(ticket)}
                  className="btn-enhanced mobile-button touch-manipulation"
                  aria-label="Share ticket"
                >
                  <Share className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="truncate">Share</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
