import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, MapPin, RefreshCcw, Ticket } from 'lucide-react';
import type { UserTicket } from '@/hooks/useTickets';
import { cn } from '@/lib/utils';

export type TicketStatus = 'upcoming' | 'past';

export interface TicketListProps {
  tickets: UserTicket[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onSelectTicket?: (ticket: UserTicket) => void;
  emptyState?: React.ReactNode;
}

interface GroupedTickets {
  upcoming: UserTicket[];
  past: UserTicket[];
}

function groupTickets(tickets: UserTicket[]): GroupedTickets {
  return tickets.reduce<GroupedTickets>(
    (acc, ticket) => {
      if (ticket.isUpcoming) acc.upcoming.push(ticket);
      else acc.past.push(ticket);
      return acc;
    },
    { upcoming: [], past: [] },
  );
}

function TicketSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-start gap-4">
        <Skeleton className="h-16 w-16 rounded-xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    </div>
  );
}

interface TicketCardProps {
  ticket: UserTicket;
  onSelect?: (ticket: UserTicket) => void;
}

function TicketCard({ ticket, onSelect }: TicketCardProps) {
  const statusLabel = ticket.status === 'checked_in'
    ? 'Used'
    : ticket.isUpcoming
      ? 'Active'
      : 'Expired';

  return (
    <button
      type="button"
      onClick={() => onSelect?.(ticket)}
      className={cn(
        'group relative w-full rounded-2xl border border-border bg-gradient-to-b from-background/90 to-background p-4 text-left shadow-sm transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80',
        'hover:-translate-y-0.5 hover:shadow-lg motion-safe:transform motion-safe:transition-transform',
      )}
      aria-label={`View ticket for ${ticket.eventTitle}`}
    >
      <div className="absolute inset-x-6 top-0 h-1 rounded-full bg-gradient-to-r from-primary via-primary/60 to-primary/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className="flex items-start gap-4">
        <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
          <img
            src={ticket.coverImage}
            alt={ticket.eventTitle}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <Badge className="absolute -bottom-2 left-2 rounded-full bg-primary text-[11px] font-semibold uppercase tracking-wide shadow-lg">
            {ticket.badge}
          </Badge>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-primary/80">{ticket.ticketType}</p>
              <h3 className="text-lg font-semibold leading-tight text-foreground">{ticket.eventTitle}</h3>
            </div>
            <Badge variant={ticket.isUpcoming ? 'default' : 'secondary'} className="px-3 py-1 text-[11px] uppercase tracking-wide">
              {statusLabel}
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" aria-hidden />
              <span>{ticket.eventDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" aria-hidden />
              <span>{ticket.eventTime}</span>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <MapPin className="h-4 w-4 text-primary" aria-hidden />
              <span className="truncate" title={ticket.eventLocation}>
                {ticket.eventLocation}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export function TicketList({
  tickets,
  loading,
  error,
  onRefresh,
  isRefreshing,
  onSelectTicket,
  emptyState,
}: TicketListProps) {
  const grouped = useMemo(() => groupTickets(tickets), [tickets]);

  if (loading) {
    return (
      <div className="space-y-4" aria-live="polite">
        {Array.from({ length: 3 }).map((_, index) => (
          <TicketSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/60 bg-destructive/10">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-destructive">Unable to load tickets</CardTitle>
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCcw className={cn('mr-2 h-4 w-4', isRefreshing && 'animate-spin')} aria-hidden />
              Retry
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const hasUpcoming = grouped.upcoming.length > 0;
  const hasPast = grouped.past.length > 0;

  if (!hasUpcoming && !hasPast) {
    return (
      <Card className="border-dashed border-primary/40 bg-background/80 text-center">
        <CardHeader>
          <CardTitle className="flex flex-col items-center gap-2 text-lg font-semibold">
            <Ticket className="h-8 w-8 text-primary" />
            No tickets yet
          </CardTitle>
        </CardHeader>
        <CardContent>
          {emptyState ?? (
            <p className="text-sm text-muted-foreground">
              Tickets you purchase or receive will appear here. Check back soon!
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue={hasUpcoming ? 'upcoming' : 'past'} className="w-full">
      <div className="flex items-center justify-between gap-4 pb-4">
        <TabsList className="grid w-full grid-cols-2 bg-muted/40 p-1 sm:max-w-sm">
          <TabsTrigger value="upcoming" disabled={!hasUpcoming}>
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="past" disabled={!hasPast}>
            Past
          </TabsTrigger>
        </TabsList>
        {onRefresh && (
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            aria-label="Refresh tickets"
            className="shrink-0"
          >
            <RefreshCcw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} aria-hidden />
          </Button>
        )}
      </div>
      <TabsContent value="upcoming" className="focus-visible:outline-none">
        <div className="space-y-4">
          {grouped.upcoming.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} onSelect={onSelectTicket} />
          ))}
        </div>
      </TabsContent>
      <TabsContent value="past" className="focus-visible:outline-none">
        <div className="space-y-4">
          {grouped.past.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} onSelect={onSelectTicket} />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}

