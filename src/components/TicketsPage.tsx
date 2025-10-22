import { useEffect, useMemo, useState } from 'react';
import { useTickets, type UserTicket } from '@/hooks/useTickets';
import { useTicketAnalytics } from '@/hooks/useTicketAnalytics';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TicketList } from '@/components/tickets/TicketList';
import { TicketDetail } from '@/components/tickets/TicketDetail';
import { GuestSessionManager } from '@/components/GuestSessionManager';
import { ArrowLeft, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { GuestSession } from '@/hooks/useGuestTicketSession';

interface TicketsPageProps {
  guestToken?: string;
  guestScope?: { all?: boolean; eventIds?: string[] };
  guestSession?: GuestSession | null;
  focusEventId?: string;
  onGuestSignOut?: () => void;
  onGuestSessionExpired?: () => void;
  onExtendGuestSession?: () => void;
  onBack: () => void;
}

interface GuestTicketRaw {
  id: string;
  event_id: string;
  tier_id: string;
  order_id: string;
  status: string;
  qr_code: string;
  created_at: string;
  owner_email: string;
  owner_name: string;
  owner_phone: string;
  // Event fields (flat structure)
  event_title: string;
  event_date: string;
  event_time: string;
  event_location: string;
  organizer_name: string;
  cover_image: string;
  // Tier fields (flat structure)
  ticket_type: string;
  badge: string;
  price: number;
  // Order fields (flat structure)
  order_date: string;
}

interface GuestTicketsResponse {
  tickets: GuestTicketRaw[];
}

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toICSUTC = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes(),
  )}${pad(d.getUTCSeconds())}Z`;
};
const escapeICS = (str: string) =>
  (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');

export default function TicketsPage({
  guestToken,
  guestScope,
  guestSession,
  focusEventId,
  onGuestSignOut,
  onGuestSessionExpired,
  onExtendGuestSession,
  onBack,
}: TicketsPageProps) {
  const { user } = useAuth();
  const { tickets: userTickets, loading: userLoading, error: userError, refreshTickets } = useTickets();
  const { trackTicketView, trackQRCodeView, trackTicketShare } = useTicketAnalytics();
  const { toast } = useToast();

  const [guestTickets, setGuestTickets] = useState<UserTicket[]>([]);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isGuestMode = Boolean(guestToken);

  useEffect(() => {
    if (!guestToken) return;

    let cancelled = false;
    setGuestLoading(true);
    setGuestError(null);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('tickets-list-guest', {
          body: { token: guestToken, scope: guestScope },
        });
        if (error) throw error;
        if (!cancelled) {
          const payload = (data as GuestTicketsResponse | null)?.tickets ?? [];
          console.log('🔍 Guest tickets raw data:', payload);
          // Transform guest tickets to match UserTicket interface
          const transformedTickets = payload.map(ticket => {
            // Use the flat structure from tickets-list-guest function
            const startISO = ticket.event_date || new Date().toISOString();
            const endISO = new Date(new Date(startISO).getTime() + 2 * 60 * 60 * 1000).toISOString();
            
            const start = new Date(startISO);
            const end = new Date(endISO);
            const now = new Date();
            
            return {
              id: ticket.id,
              eventId: ticket.event_id || '',
              eventTitle: ticket.event_title || 'Event',
              eventDate: start.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }),
              eventTime: start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              venue: ticket.event_location || 'TBA',
              city: '', // Not available in current structure
              eventLocation: ticket.event_location || 'TBA',
              coverImage: ticket.cover_image || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30',
              ticketType: ticket.ticket_type || 'General',
              badge: ticket.badge || 'GA',
              qrCode: ticket.qr_code || '',
              status: ticket.status || 'issued',
              price: ticket.price || 0,
              orderDate: ticket.order_date || ticket.created_at || new Date().toISOString(),
              isUpcoming: end > now,
              organizerName: ticket.organizer_name || 'Event Organizer',
              startAtISO: startISO,
              endAtISO: endISO,
            } as UserTicket;
          });
          console.log('✅ Guest tickets transformed:', transformedTickets);
          setGuestTickets(transformedTickets as unknown as UserTicket[]);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Guest ticket fetch failed', err);
          setGuestError(err instanceof Error ? err.message : 'Unable to load guest tickets');
        }
      } finally {
        if (!cancelled) setGuestLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [guestToken, guestScope]);

  const allTickets = useMemo(() => (isGuestMode ? guestTickets : userTickets), [isGuestMode, guestTickets, userTickets]);
  const loading = isGuestMode ? guestLoading : userLoading;
  const error = isGuestMode ? guestError : userError;

  const [showAllTickets, setShowAllTickets] = useState(() => !focusEventId);

  useEffect(() => {
    setShowAllTickets(!focusEventId);
  }, [focusEventId]);

  const eventScopedTickets = useMemo(() => {
    if (!focusEventId) return allTickets;
    return allTickets.filter((ticket) => ticket.eventId === focusEventId);
  }, [allTickets, focusEventId]);

  const showingScoped = Boolean(focusEventId) && !showAllTickets;
  const visibleTickets = showingScoped ? eventScopedTickets : allTickets;

  useEffect(() => {
    if (selectedTicket && !visibleTickets.some((ticket) => ticket.id === selectedTicket.id)) {
      setSelectedTicket(null);
    }
  }, [visibleTickets, selectedTicket]);

  useEffect(() => {
    if (showingScoped && eventScopedTickets.length === 1) {
      setSelectedTicket(eventScopedTickets[0]);
    }
  }, [showingScoped, eventScopedTickets]);

  const handleRefresh = () => {
    if (isGuestMode && guestToken) {
      setGuestLoading(true);
      supabase.functions
        .invoke('tickets-list-guest', { body: { token: guestToken, scope: guestScope } })
        .then(({ data, error }) => {
          if (error) throw error;
          const rawTickets = (data as GuestTicketsResponse | null)?.tickets ?? [];
          // Transform raw tickets to UserTicket format using flat structure
          const transformed = rawTickets.map(ticket => {
            const startISO = ticket.event_date || new Date().toISOString();
            const endISO = new Date(new Date(startISO).getTime() + 2 * 60 * 60 * 1000).toISOString();
            const start = new Date(startISO);
            const end = new Date(endISO);
            
            return {
              id: ticket.id,
              eventId: ticket.event_id || '',
              eventTitle: ticket.event_title || 'Event',
              eventDate: start.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }),
              eventTime: start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              venue: ticket.event_location || 'TBA',
              city: '',
              eventLocation: ticket.event_location || 'TBA',
              coverImage: ticket.cover_image || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30',
              ticketType: ticket.ticket_type || 'General',
              badge: ticket.badge || 'GA',
              qrCode: ticket.qr_code,
              status: ticket.status,
              price: ticket.price || 0,
              orderDate: ticket.order_date || ticket.created_at,
              isUpcoming: end > new Date(),
              organizerName: ticket.organizer_name || 'Event Organizer',
              startAtISO: startISO,
              endAtISO: endISO,
            };
          });
          setGuestTickets(transformed as unknown as UserTicket[]);
        })
        .catch((err) => setGuestError(err instanceof Error ? err.message : 'Unable to refresh tickets'))
        .finally(() => setGuestLoading(false));
    } else {
      setIsRefreshing(true);
      refreshTickets();
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const maskGuestContact = (contact?: string | null) => {
    if (!contact) return 'Guest access';
    if (contact.includes('@')) {
      const [userPart, domain] = contact.split('@');
      if (!domain) return `Guest • ${contact}`;
      const maskedUser = userPart.length <= 2
        ? `${userPart[0] ?? ''}*`
        : `${userPart[0]}${'*'.repeat(Math.max(userPart.length - 2, 1))}${userPart.slice(-1)}`;
      return `Guest • ${maskedUser}@${domain}`;
    }
    const digits = contact.replace(/\D/g, '');
    if (digits.length < 4) return `Guest • ${contact}`;
    return `Guest • ••${digits.slice(-4)}`;
  };

  const guestSubtitle = useMemo(() => {
    if (!guestSession) return `${allTickets.length} ticket${allTickets.length === 1 ? '' : 's'}`;
    return `${allTickets.length} ticket${allTickets.length === 1 ? '' : 's'}`;
  }, [guestSession, allTickets.length]);

  const totalTicketCount = allTickets.length;
  const visibleTicketCount = visibleTickets.length;

  const handleGuestSignOut = () => {
    onGuestSignOut?.();
  };

  const ticketsOutsideScope = Math.max(totalTicketCount - eventScopedTickets.length, 0);

  const buildICS = (ticket: UserTicket) => {
    const dtstart = toICSUTC(ticket.startAtISO);
    const dtend = ticket.endAtISO ? toICSUTC(ticket.endAtISO) : '';
    const summary = escapeICS(ticket.eventTitle);
    const description = escapeICS(`Ticket: ${ticket.ticketType}\nEvent: ${ticket.eventTitle}`);
    const location = escapeICS(ticket.eventLocation);
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

  const downloadICS = (ticket: UserTicket, download = true) => {
    const icsContent = buildICS(ticket);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    if (download) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(ticket.eventTitle || 'event').replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      window.open(url, '_blank', 'noopener');
    }
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleShareTicket = async (ticket: UserTicket) => {
    try {
      const shareData = {
        title: `My ticket to ${ticket.eventTitle}`,
        text: `Join me at ${ticket.eventTitle}`,
        url: window.location.origin,
      };
      if ((navigator as any).share && (navigator as any).canShare?.(shareData)) {
        await (navigator as any).share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.url}`);
        toast({ title: 'Ticket link copied', description: 'Share it with your friends!' });
      }
      if (user) {
        trackTicketShare(ticket.id, ticket.eventId, user.id, 'share');
      }
    } catch (err) {
      console.error('Ticket share failed', err);
      toast({ title: 'Unable to share', description: 'Please try again later.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!selectedTicket || !user) return;
    trackTicketView(selectedTicket.id, selectedTicket.eventId, user.id);
    trackQRCodeView(selectedTicket.id, selectedTicket.eventId, user.id);
  }, [selectedTicket, trackTicketView, trackQRCodeView, user]);

  const headerSubtitle = isGuestMode
    ? guestSubtitle
    : showingScoped
      ? `${visibleTicketCount} ticket${visibleTicketCount === 1 ? '' : 's'} for this event`
      : `${totalTicketCount} ticket${totalTicketCount === 1 ? '' : 's'}`;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-background/80">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2" aria-label="Go back">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </Button>
          <div className="text-center">
            <h1 className="text-lg font-semibold">My Tickets</h1>
            <p className="text-xs text-muted-foreground">{headerSubtitle}</p>
          </div>
          {!isGuestMode && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Secure & Verified
            </span>
          )}
        </div>
        <Separator />
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        {isGuestMode && guestSession && (
          <GuestSessionManager
            session={guestSession}
            onExtend={onExtendGuestSession}
            onSignOut={handleGuestSignOut}
            onExpired={onGuestSessionExpired}
          />
        )}

        {focusEventId && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 text-left">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                    Event focus
                  </Badge>
                  <span>{eventScopedTickets[0]?.eventTitle ?? 'This event'}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {showingScoped
                    ? 'Showing tickets just for this event.'
                    : 'Viewing every ticket saved to your wallet.'}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {showingScoped && ticketsOutsideScope > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllTickets(true)}
                  >
                    View all tickets
                  </Button>
                )}
                {!showingScoped && focusEventId && eventScopedTickets.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllTickets(false)}
                  >
                    Back to event tickets
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/60 bg-background/80 p-6 shadow-sm">
          <TicketList
            tickets={visibleTickets}
            loading={loading}
            error={error}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing || guestLoading}
            onSelectTicket={setSelectedTicket}
            emptyState={
              showingScoped ? (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>We couldn&apos;t find tickets for this event yet.</p>
                  {onExtendGuestSession && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onExtendGuestSession}
                    >
                      Try a different email or phone
                    </Button>
                  )}
                  {ticketsOutsideScope > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllTickets(true)}
                    >
                      View all of my tickets
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Purchase a ticket from the explore tab and it will appear here instantly.</p>
                  <p>No extra steps needed — just show your QR and you&apos;re in.</p>
                </div>
              )
            }
          />
        </Card>
      </main>

      {selectedTicket && (
        <TicketDetail
          ticket={selectedTicket}
          isOpen={Boolean(selectedTicket)}
          onClose={() => {
            console.log('🎫 Closing ticket modal');
            setSelectedTicket(null);
          }}
          onShare={handleShareTicket}
          onAddToCalendar={(ticket) => downloadICS(ticket, false)}
          onDownloadCalendar={(ticket) => downloadICS(ticket, true)}
        />
      )}
    </div>
  );
}

