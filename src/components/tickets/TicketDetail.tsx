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
        className="max-w-xl gap-6 overflow-hidden p-0 sm:rounded-3xl [&>button]:absolute [&>button]:right-6 [&>button]:top-6 [&>button]:text-primary-foreground/70 [&>button]:hover:text-primary-foreground [&>button]:transition [&>button]:focus-visible:outline-none [&>button]:focus-visible:ring-2 [&>button]:focus-visible:ring-offset-2"
        onPointerDownOutside={(e) => {
          // Prevent dialog from closing on outside clicks
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Allow ESC key to close
          onClose();
        }}
      >
        <div className="relative bg-gradient-to-br from-primary/90 via-primary to-primary/80 p-8 text-primary-foreground">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-2xl font-semibold tracking-tight text-primary-foreground">
              {ticket.eventTitle}
            </DialogTitle>
            <p className="text-sm text-primary-foreground/80">{ticket.organizerName}</p>
          </DialogHeader>
          <div className="mt-4 grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" aria-hidden />
              <span>{ticket.eventDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" aria-hidden />
              <span>{ticket.eventTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" aria-hidden />
              <span>{ticket.eventLocation}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge variant="secondary" className="bg-primary-foreground/20 text-xs text-primary-foreground">
              {ticket.ticketType}
            </Badge>
          </div>
        </div>
        <div className="space-y-6 p-6">
          <QrDisplay
            ticketId={ticket.id}
            eventId={ticket.eventId}
            token={token}
            isLoading={isQrLoading}
            errored={isQrError}
          />
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ticket Holder</h3>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="gap-2 text-sm">
                  <Ticket className="h-4 w-4" aria-hidden />
                  {ticket.ticketType}
                </Badge>
                <span className="text-sm text-muted-foreground">{priceLabel}</span>
                {ticket.orderDate && (
                  <span className="text-sm text-muted-foreground">
                    Ordered {new Date(ticket.orderDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <Separator />
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              <Button variant="secondary" onClick={() => onShare?.(ticket)} className="justify-start gap-2" aria-label="Share ticket">
                <Share2 className="h-4 w-4" aria-hidden />
                Share ticket
              </Button>
              <Button
                variant="secondary"
                onClick={() => onAddToCalendar?.(ticket)}
                className="justify-start gap-2"
                aria-label="Add to calendar"
              >
                <Calendar className="h-4 w-4" aria-hidden />
                Add to calendar
              </Button>
              <Button
                variant="ghost"
                onClick={() => onDownloadCalendar?.(ticket)}
                className="justify-start gap-2"
                aria-label="Download calendar file"
              >
                <Download className="h-4 w-4" aria-hidden />
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

