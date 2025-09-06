// + add import
import { downloadICS } from '@/lib/ics';
import { Calendar as CalendarIcon } from 'lucide-react';

// ...inside component
export function TicketSuccessPage({ onBack, onViewTickets, autoRedirectMs = 6000 }: TicketSuccessPageProps) {
  // existing hooks:
  const { tickets, refreshTickets } = useTickets(); // <-- use tickets list here

  // helper to add to calendar based on matched ticket
  const addPaidEventToCalendar = () => {
    if (!orderStatus?.event_title) {
      toast({
        title: 'Missing event info',
        description: 'Could not find event details to export.',
        variant: 'destructive'
      });
      return;
    }

    // Find a matching upcoming ticket for this event title
    const t = tickets.find(
      (tk) =>
        tk.eventTitle?.toLowerCase() === orderStatus.event_title.toLowerCase() &&
        tk.isUpcoming
    );

    if (!t) {
      toast({
        title: 'Event not found yet',
        description: 'Try again in a few seconds after tickets refresh.',
      });
      return;
    }

    const start = t.startISO ? new Date(t.startISO) : new Date(`${t.eventDate} ${t.eventTime}`);
    const end = t.endISO ? new Date(t.endISO) : new Date(start.getTime() + 2 * 60 * 60 * 1000);

    downloadICS(
      {
        title: t.eventTitle,
        start,
        end,
        location: t.eventLocation || t.address,
        description: `Tickets purchased: ${orderStatus.tickets_count}`,
        url: t.url,
        organizer: t.organizerName
      },
      `${t.eventTitle}.ics`
    );

    toast({
      title: 'Calendar file created',
      description: 'Open the .ics file to add it to your calendar.',
    });
  };

// ...in the paid UI Actions section, add this extra button (next to View My Tickets)
  <div className="flex flex-col sm:flex-row gap-3">
    <Button variant="outline" onClick={onBack} className="flex-1">
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back to Events
    </Button>
    <Button
      onClick={onViewTickets || (() => (window.location.href = '/tickets'))}
      className="flex-1"
    >
      <Ticket className="w-4 h-4 mr-2" />
      View My Tickets
    </Button>

    {/* NEW: Add to Calendar */}
    <Button variant="secondary" onClick={addPaidEventToCalendar} className="flex-1">
      <CalendarIcon className="w-4 h-4 mr-2" />
      Add to Calendar (.ics)
    </Button>

    {orderStatus?.status === 'paid' && autoRedirectMs > 0 && (
      <Button variant="ghost" onClick={() => setCancelRedirect(true)} className="sm:w-auto">
        Stop Auto-Redirect
      </Button>
    )}
  </div>
