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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col">
      {/* Sticky header with enhanced visual design */}
      <div className="sticky top-0 z-20 border-b bg-card/98 backdrop-blur-xl shadow-sm border-border/40">
        {guestToken && (
          <div className="px-3 sm:px-4 py-3 bg-gradient-to-r from-amber-50/80 to-amber-100/60 dark:from-amber-500/15 dark:to-amber-400/10 border-b border-amber-200/60 dark:border-amber-400/20">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1">
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Viewing tickets for verified contact
              </span>
              {onGuestSignOut && (
                <button className="text-sm font-medium underline text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors" onClick={onGuestSignOut}>
                  Use different email/phone
                </button>
              )}
            </div>
          </div>
        )}

        <div className="p-4 sm:p-6 flex items-center gap-4">
          <button
            onClick={onBack}
            className="mobile-button flex-shrink-0 p-2.5 rounded-xl hover:bg-muted/80 transition-all duration-200 focus-ring touch-manipulation border border-border/40"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-foreground/80" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {guestToken ? 'Your Tickets' : 'My Tickets'}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground font-medium mt-1">
              {guestToken ? 'Verified contact tickets' : `Welcome back, ${user?.name || 'there'}`}
            </p>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="mobile-button hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 btn-enhanced touch-manipulation border-border/60"
              aria-label="Refresh tickets"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Error */}
      {errorText && (
        <div className="p-4 sm:p-6">
          <Card className="border-red-200/60 bg-gradient-to-br from-red-50/80 to-red-100/40 dark:from-red-950/40 dark:to-red-900/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 text-red-700 dark:text-red-300 mb-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-xl grid place-items-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-lg">Error Loading Tickets</h3>
                  <p className="text-sm mt-1 text-red-600 dark:text-red-400">{errorText}</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={handleRefresh} 
                className="border-red-300 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main */}
      {!errorText && (
        <div className="flex-1 px-4 sm:px-6 pb-6 safe-bottom-pad">
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)} className="w-full">
            {/* Enhanced mobile-optimized tabs */}
            <TabsList className="grid w-full grid-cols-2 mb-6 sm:mb-8 rounded-2xl bg-muted/30 p-1.5 border border-border/40">
              <TabsTrigger value="upcoming" className="rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/60">
                <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="truncate">Upcoming</span>
                <span className="ml-2 inline-flex h-5 min-w-[20px] px-2 rounded-full bg-primary/20 text-primary text-xs items-center justify-center font-bold flex-shrink-0">
                  {upcomingTickets.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="past" className="rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/60">
                <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="truncate">Past</span>
                <span className="ml-2 inline-flex h-5 min-w-[20px] px-2 rounded-full bg-muted-foreground/20 text-muted-foreground text-xs items-center justify-center font-bold flex-shrink-0">
                  {pastTickets.length}
                </span>
              </TabsTrigger>
            </TabsList>

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
    <div className="text-center py-16">
      <div className="w-24 h-24 rounded-3xl grid place-items-center mx-auto mb-6 bg-gradient-to-br from-primary/20 to-primary/10 text-primary shadow-lg">
        <TicketIcon className="w-12 h-12" />
      </div>
      <h3 className="text-xl font-bold mb-2 text-foreground">{title}</h3>
      <p className="text-muted-foreground text-base max-w-sm mx-auto leading-relaxed">{subtitle}</p>
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
    <Card className="overflow-hidden transition-all duration-300 border border-border/60 bg-gradient-to-br from-card via-card to-card/95 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 backdrop-blur-sm">
      <CardContent className="p-0">
        <div className="flex flex-col">
          {/* Event image - enhanced with overlay */}
          <div className="relative w-full h-48 sm:h-40 bg-gradient-to-br from-muted/60 to-muted/40 overflow-hidden">
            {ticket?.coverImage ? (
              <>
                <img 
                  src={ticket.coverImage} 
                  alt={ticket?.eventTitle || 'Event cover'} 
                  className="w-full h-full object-cover" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                
                {/* Event details overlay */}
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium text-shadow-soft">{dateStr || 'Date'}</span>
                    <Clock className="w-4 h-4 flex-shrink-0 ml-2" />
                    <span className="font-medium text-shadow-soft">{timeStr || 'Time'}</span>
                  </div>
                  {venue && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="font-medium text-shadow-soft truncate">{venue}</span>
                    </div>
                  )}
                </div>

                {/* Status badge on image */}
                <div className="absolute top-4 left-4">
                  {statusBadge}
                </div>
              </>
            ) : (
              <div className="w-full h-full grid place-items-center">
                <TicketIcon className="w-12 h-12 text-muted-foreground/60" aria-hidden />
              </div>
            )}
          </div>

          {/* Ticket details */}
          <div className="p-5 sm:p-6">
            <div className="flex justify-between items-start gap-4 mb-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-lg sm:text-xl leading-tight text-foreground mb-2">
                  {ticket?.eventTitle || 'Event'}
                </h3>
                
                {/* Ticket type and price */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-semibold border-primary/30 text-primary bg-primary/5">
                      {ticket?.ticketType || 'General'}
                    </Badge>
                    {ticket?.badge && (
                      <Badge variant="secondary" className="font-semibold bg-secondary/80">
                        {ticket.badge}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-foreground">{formatUSD(ticket?.price || 0)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced action buttons */}
            <div className="space-y-3">
              {/* Primary action - QR Code */}
              <Button
                size="lg"
                onClick={() => onShowQRCode(ticket)}
                className="w-full bg-gradient-to-r from-primary via-primary to-primary/90 hover:from-primary/90 hover:via-primary hover:to-primary text-primary-foreground font-bold py-4 text-base rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                aria-label="Show QR code"
              >
                <QrCode className="w-5 h-5 mr-3" />
                Show QR Code
              </Button>

              {/* Secondary actions */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => window.open(`/e/${ticket?.eventId || ''}`, '_blank')}
                  className="border-border/60 hover:bg-muted/50 hover:border-primary/40 transition-all duration-200 py-3 rounded-xl font-semibold"
                  aria-label="Open event page"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Event Details
                </Button>

                <Button
                  variant="outline"
                  size="default"
                  onClick={() => onDownloadCalendar(ticket)}
                  className="border-border/60 hover:bg-muted/50 hover:border-primary/40 transition-all duration-200 py-3 rounded-xl font-semibold"
                  aria-label="Download calendar file"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Calendar
                </Button>
              </div>

              {/* Tertiary actions */}
              <div className="grid grid-cols-2 gap-3">
                {ticket?.wallet_pass_url && (
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => onDownloadWalletPass(ticket)}
                    className="border-border/60 hover:bg-muted/50 hover:border-primary/40 transition-all duration-200 py-3 rounded-xl font-semibold"
                    aria-label="Add to wallet"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Add to Wallet
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="default"
                  onClick={() => onShare(ticket)}
                  className="border-border/60 hover:bg-muted/50 hover:border-primary/40 transition-all duration-200 py-3 rounded-xl font-semibold"
                  aria-label="Share ticket"
                >
                  <Share className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
