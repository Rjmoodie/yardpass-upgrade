import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Calendar, Clock, Download, MapPin, Share2, Ticket } from 'lucide-react';
import type { UserTicket } from '@/hooks/useTickets';
import { QrDisplay } from './QrDisplay';
import { useTicketQrToken } from '@/hooks/useTicketQrToken';

export interface TicketDetailProps {
  ticket: UserTicket & {
    orderDate?: string;
    appleWalletUrl?: string | null;
    googleWalletUrl?: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
  onShare?: (ticket: UserTicket) => void;
  onAddToCalendar?: (ticket: UserTicket) => void;
  onDownloadCalendar?: (ticket: UserTicket) => void;
}

function getStatusBadge(ticket: UserTicket) {
  if (ticket.status === 'checked_in') return { label: 'Used', variant: 'secondary' as const };
  if (ticket.status === 'void' || ticket.status === 'refunded') return { label: 'Inactive', variant: 'outline' as const };
  if (ticket.isUpcoming) return { label: 'Active', variant: 'default' as const };
  return { label: 'Expired', variant: 'outline' as const };
}

export function TicketDetail({
  ticket,
  isOpen,
  onClose,
  onShare,
  onAddToCalendar,
  onDownloadCalendar,
}: TicketDetailProps) {
  const status = useMemo(() => getStatusBadge(ticket), [ticket]);
  const priceLabel = ticket.price > 0
    ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(ticket.price)
    : 'Free ticket';
  // Use QR code directly from ticket data if available, otherwise fetch it
  const { token: fetchedToken, isLoading, isError } = useTicketQrToken({
    ticketId: ticket.id,
    eventId: ticket.eventId,
  });
  
  // Use the QR code from ticket data if available, otherwise use the fetched one
  const token = ticket.qrCode || fetchedToken;
  const isQrLoading = !ticket.qrCode && isLoading;
  const isQrError = !ticket.qrCode && isError;
  
  // Debug logging
  console.log('🎫 TicketDetail QR Debug:', {
    ticketId: ticket.id,
    hasQrCode: !!ticket.qrCode,
    qrCode: ticket.qrCode,
    fetchedToken,
    finalToken: token,
    isQrLoading,
    isQrError
  });

  return (
    <Dialog open={isOpen} onOpenChange={(next) => {
      if (!next) {
        onClose();
      }
    }}>
      <DialogContent 
        className="max-w-xl gap-[clamp(1rem,3vh,1.5rem)] overflow-hidden p-0 sm:rounded-3xl [&>button]:absolute [&>button]:right-[clamp(1rem,4vw,1.5rem)] [&>button]:top-[clamp(1rem,4vw,1.5rem)] [&>button]:text-primary-foreground/70 [&>button]:hover:text-primary-foreground [&>button]:transition [&>button]:focus-visible:outline-none [&>button]:focus-visible:ring-2 [&>button]:focus-visible:ring-offset-2"
        onPointerDownOutside={(e) => {
          // Prevent dialog from closing on outside clicks
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Allow ESC key to close
          onClose();
        }}
      >
        <div className="relative bg-gradient-to-br from-primary/90 via-primary to-primary/80 p-[clamp(1.5rem,5vh,2rem)] text-primary-foreground" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
          <DialogHeader className="space-y-[clamp(0.375rem,1.5vh,0.5rem)] text-left">
            <DialogTitle className="text-[clamp(1.25rem,5vw,1.5rem)] font-semibold tracking-tight text-primary-foreground leading-tight">
              {ticket.eventTitle}
            </DialogTitle>
            <p className="text-[clamp(0.8125rem,3.5vw,0.875rem)] text-primary-foreground/80">{ticket.organizerName}</p>
          </DialogHeader>
          <div className="mt-[clamp(0.75rem,2.5vh,1rem)] grid gap-[clamp(0.375rem,1.5vh,0.5rem)] text-[clamp(0.8125rem,3.5vw,0.875rem)]">
            <div className="flex items-center gap-[clamp(0.375rem,1.5vw,0.5rem)]">
              <Calendar className="h-[clamp(0.875rem,3.5vw,1rem)] w-[clamp(0.875rem,3.5vw,1rem)]" aria-hidden />
              <span>{ticket.eventDate}</span>
            </div>
            <div className="flex items-center gap-[clamp(0.375rem,1.5vw,0.5rem)]">
              <Clock className="h-[clamp(0.875rem,3.5vw,1rem)] w-[clamp(0.875rem,3.5vw,1rem)]" aria-hidden />
              <span>{ticket.eventTime}</span>
            </div>
            <div className="flex items-center gap-[clamp(0.375rem,1.5vw,0.5rem)]">
              <MapPin className="h-[clamp(0.875rem,3.5vw,1rem)] w-[clamp(0.875rem,3.5vw,1rem)]" aria-hidden />
              <span>{ticket.eventLocation}</span>
            </div>
          </div>
          <div className="mt-[clamp(0.75rem,2.5vh,1rem)] flex items-center gap-[clamp(0.5rem,2vw,0.75rem)] flex-wrap">
            <Badge variant={status.variant} className="text-[clamp(0.75rem,3vw,0.875rem)]">{status.label}</Badge>
            <Badge variant="secondary" className="bg-primary-foreground/20 text-[clamp(0.6875rem,2.8vw,0.75rem)] text-primary-foreground">
              {ticket.ticketType}
            </Badge>
          </div>
        </div>
        <div className="space-y-[clamp(1rem,4vh,1.5rem)] p-[clamp(1rem,4vw,1.5rem)]" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          <QrDisplay
            ticketId={ticket.id}
            eventId={ticket.eventId}
            token={token}
            isLoading={isQrLoading}
            errored={isQrError}
          />
          <div className="space-y-[clamp(0.75rem,3vh,1rem)]">
            <div>
              <h3 className="text-[clamp(0.6875rem,3vw,0.75rem)] font-semibold uppercase tracking-wide text-muted-foreground">Ticket Holder</h3>
              <div className="mt-[clamp(0.375rem,1.5vh,0.5rem)] flex flex-wrap items-center gap-[clamp(0.5rem,2vw,0.75rem)]">
                <Badge variant="outline" className="gap-[clamp(0.375rem,1.5vw,0.5rem)] text-[clamp(0.8125rem,3.5vw,0.875rem)] min-h-[44px]">
                  <Ticket className="h-[clamp(0.875rem,3.5vw,1rem)] w-[clamp(0.875rem,3.5vw,1rem)]" aria-hidden />
                  {ticket.ticketType}
                </Badge>
                <span className="text-[clamp(0.8125rem,3.5vw,0.875rem)] text-muted-foreground">{priceLabel}</span>
                {ticket.orderDate && (
                  <span className="text-[clamp(0.8125rem,3.5vw,0.875rem)] text-muted-foreground">
                    Ordered {new Date(ticket.orderDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <Separator />
            <div className="grid gap-[clamp(0.5rem,2vh,0.75rem)] sm:grid-cols-2 sm:gap-[clamp(0.5rem,2vh,0.75rem)]">
              <Button variant="secondary" onClick={() => onShare?.(ticket)} className="justify-start gap-[clamp(0.375rem,1.5vw,0.5rem)] min-h-[44px] text-[clamp(0.8125rem,3.5vw,0.875rem)]" aria-label="Share ticket">
                <Share2 className="h-[clamp(0.875rem,3.5vw,1rem)] w-[clamp(0.875rem,3.5vw,1rem)]" aria-hidden />
                Share ticket
              </Button>
              <Button
                variant="secondary"
                onClick={() => onAddToCalendar?.(ticket)}
                className="justify-start gap-[clamp(0.375rem,1.5vw,0.5rem)] min-h-[44px] text-[clamp(0.8125rem,3.5vw,0.875rem)]"
                aria-label="Add to calendar"
              >
                <Calendar className="h-[clamp(0.875rem,3.5vw,1rem)] w-[clamp(0.875rem,3.5vw,1rem)]" aria-hidden />
                Add to calendar
              </Button>
              <Button
                variant="ghost"
                onClick={() => onDownloadCalendar?.(ticket)}
                className="justify-start gap-[clamp(0.375rem,1.5vw,0.5rem)] min-h-[44px] text-[clamp(0.8125rem,3.5vw,0.875rem)]"
                aria-label="Download calendar file"
              >
                <Download className="h-[clamp(0.875rem,3.5vw,1rem)] w-[clamp(0.875rem,3.5vw,1rem)]" aria-hidden />
                Download .ics
              </Button>
              {(ticket.appleWalletUrl || ticket.googleWalletUrl) && (
                <Button
                  variant="secondary"
                  asChild
                  className="justify-start gap-2"
                  aria-label="Add ticket to digital wallet"
                >
                  <a href={ticket.appleWalletUrl ?? ticket.googleWalletUrl ?? '#'} target="_blank" rel="noreferrer">
                    Add to Wallet
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

