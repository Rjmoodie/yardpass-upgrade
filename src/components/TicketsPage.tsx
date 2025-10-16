import { useEffect, useMemo, useState } from 'react';
import { useTickets, type UserTicket } from '@/hooks/useTickets';
import { useTicketAnalytics } from '@/hooks/useTicketAnalytics';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TicketList } from '@/components/tickets/TicketList';
import { TicketDetail } from '@/components/tickets/TicketDetail';
import { GuestSessionManager } from '@/components/GuestSessionManager';
import { ArrowLeft, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface TicketsPageProps {
  guestToken?: string;
  guestScope?: { all?: boolean; eventIds?: string[] };
  onGuestSignOut?: () => void;
  onBack: () => void;
}

interface GuestTicketsResponse {
  tickets: UserTicket[];
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
  onGuestSignOut,
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
          setGuestTickets(payload as UserTicket[]);
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

  const tickets = useMemo(() => (isGuestMode ? guestTickets : userTickets), [isGuestMode, guestTickets, userTickets]);
  const loading = isGuestMode ? guestLoading : userLoading;
  const error = isGuestMode ? guestError : userError;

  const handleRefresh = () => {
    if (isGuestMode && guestToken) {
      setGuestLoading(true);
      supabase.functions
        .invoke('tickets-list-guest', { body: { token: guestToken, scope: guestScope } })
        .then(({ data, error }) => {
          if (error) throw error;
          setGuestTickets(((data as GuestTicketsResponse | null)?.tickets ?? []) as UserTicket[]);
        })
        .catch((err) => setGuestError(err instanceof Error ? err.message : 'Unable to refresh tickets'))
        .finally(() => setGuestLoading(false));
    } else {
      setIsRefreshing(true);
      refreshTickets();
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

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
    ? 'Guest access • limited time token'
    : `${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`;

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
          {isGuestMode ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onGuestSignOut}
              className="gap-2"
              aria-label="Sign out guest session"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Secure & Verified
            </span>
          )}
        </div>
        <Separator />
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        {isGuestMode && onGuestSignOut && (
          <GuestSessionManager 
            onSignOut={onGuestSignOut}
            className="mb-4"
          />
        )}
        
        <Card className="border-border/60 bg-background/80 p-6 shadow-sm">
          <TicketList
            tickets={tickets}
            loading={loading}
            error={error}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing || guestLoading}
            onSelectTicket={setSelectedTicket}
            emptyState={
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Purchase a ticket from the explore tab and it will appear here instantly.</p>
                <p>No extra steps needed — just show your QR and you&apos;re in.</p>
              </div>
            }
          />
        </Card>
      </main>

      {selectedTicket && (
        <TicketDetail
          ticket={selectedTicket}
          isOpen={Boolean(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
          onShare={handleShareTicket}
          onAddToCalendar={(ticket) => downloadICS(ticket, false)}
          onDownloadCalendar={(ticket) => downloadICS(ticket, true)}
        />
      )}
    </div>
  );
}

