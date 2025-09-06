// + add import
import { downloadICS } from '@/lib/ics';
// (Calendar icon is already imported above for metadata rows)

export function TicketsPage({ user, onBack }: TicketsPageProps) {
  // ...existing hooks

  const handleAddToCalendar = (ticket: UserTicket) => {
    // Prefer precise ISO from DB; otherwise parse displayed strings & fallback to 2h duration
    const start = ticket.startISO
      ? new Date(ticket.startISO)
      : new Date(`${ticket.eventDate} ${ticket.eventTime}`);
    const end = ticket.endISO
      ? new Date(ticket.endISO)
      : new Date(start.getTime() + 2 * 60 * 60 * 1000);

    downloadICS(
      {
        title: ticket.eventTitle,
        start,
        end,
        location: ticket.eventLocation || ticket.address,
        description: `${ticket.ticketType} ticket`,
        url: ticket.url,
        organizer: ticket.organizerName
      },
      `${ticket.eventTitle}.ics`
    );

    toast({
      title: 'Calendar file created',
      description: 'Open the .ics file to add it to your calendar.',
    });
  };

  // ...render

  {/* In the Upcoming tickets card actions row, add a third button */}
  // inside the block rendering each upcoming ticket, in the row with QR Code / Wallet:
  <div className="flex gap-2">
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

    {/* NEW: Add to Calendar */}
    <Button
      size="sm"
      variant="outline"
      onClick={() => handleAddToCalendar(ticket)}
      className="flex-1"
    >
      <Calendar className="w-3 h-3 mr-1" />
      Calendar
    </Button>
  </div>
