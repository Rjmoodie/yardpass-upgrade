import { useMemo, useState } from 'react';
import {
  Calendar,
  Download,
  MapPin,
  QrCode,
  Share2,
  Ticket,
} from 'lucide-react';
import type { GuestSession } from '@/hooks/useGuestTicketSession';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';

interface TicketItem {
  id: string;
  status: 'active' | 'used';
  title: string;
  date: string;
  location: string;
  ticketType: string;
  price: string;
  image: string;
  qrCode: string;
  organizer: string;
}

interface TicketsPageProps {
  guestToken?: string;
  guestScope?: { all?: boolean; eventIds?: string[] };
  guestSession?: GuestSession | null;
  focusEventId?: string;
  onGuestSignOut?: () => void;
  onGuestSessionExpired?: () => void;
  onExtendGuestSession?: () => void;
  onBack?: () => void;
}


export default function TicketsPage({ onBack }: TicketsPageProps) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [allTickets, setAllTickets] = useState<TicketItem[]>([]);

  const tickets = useMemo(() => {
    return allTickets.filter((ticket) =>
      activeTab === 'upcoming' ? ticket.status === 'active' : ticket.status === 'used',
    );
  }, [activeTab, allTickets]);

  const toggleExpand = (ticketId: string) => {
    setExpandedTicket((current) => (current === ticketId ? null : ticketId));
  };

  return (
    <div className="min-h-screen bg-black pb-20">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-3 py-4 sm:px-4 sm:py-5">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-all hover:bg-white/10"
                aria-label="Go back"
              >
                <ArrowLeftIcon />
              </button>
            )}
            <div>
              <h1 className="text-white">My Tickets</h1>
              <p className="text-xs text-white/60 sm:text-sm">All your events in one place</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white transition hover:bg-white/10 sm:text-sm">
              Download All
            </button>
            <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white transition hover:bg-white/10 sm:text-sm">
              Share Wallet
            </button>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-5xl gap-2 px-3 pb-4 sm:px-4">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 rounded-full px-4 py-2 text-sm transition-all sm:text-base ${
              activeTab === 'upcoming' ? 'bg-[#FF8C00] text-white shadow-lg' : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`flex-1 rounded-full px-4 py-2 text-sm transition-all sm:text-base ${
              activeTab === 'past' ? 'bg-[#FF8C00] text-white shadow-lg' : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            Past
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-3 pt-4 sm:px-4">
        {tickets.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-dashed border-white/20 bg-white/5 p-8 text-center text-white/70">
            <Ticket className="mx-auto mb-4 h-12 w-12 text-white/40" />
            <h2 className="mb-2 text-lg text-white">No tickets yet</h2>
            <p className="mb-4 text-sm text-white/60">Buy your first ticket to see it here.</p>
            <button className="rounded-full bg-[#FF8C00] px-6 py-2 text-sm font-medium text-white transition hover:bg-[#FF9D1A]">
              Discover Events
            </button>
          </div>
        ) : (
          <div className="space-y-4 pb-16">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl transition hover:border-white/20 hover:shadow-xl"
              >
                <button
                  onClick={() => toggleExpand(ticket.id)}
                  className="flex w-full flex-col text-left sm:flex-row"
                >
                  <div className="relative h-48 w-full overflow-hidden sm:h-auto sm:w-56">
                    <ImageWithFallback src={ticket.image} alt={ticket.title} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />
                    <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs uppercase text-white">
                      {ticket.status === 'active' ? 'Active' : 'Used'}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col justify-between gap-4 p-5 sm:p-6">
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-base text-white sm:text-lg">{ticket.title}</h3>
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white">{ticket.ticketType}</span>
                      </div>
                      <p className="mt-1 text-xs text-white/60 sm:text-sm">{ticket.organizer}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-white/70 sm:text-sm">
                        <Calendar className="h-4 w-4 text-white/60" />
                        <span>{ticket.date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/70 sm:text-sm">
                        <MapPin className="h-4 w-4 text-white/60" />
                        <span>{ticket.location}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{ticket.price}</span>
                      <div className="flex gap-2">
                        <button className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white transition hover:bg-white/10">
                          <Download className="h-4 w-4" />
                        </button>
                        <button className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white transition hover:bg-white/10">
                          <Share2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </button>

                <div
                  className={`grid transition-all ${
                    expandedTicket === ticket.id
                      ? 'grid-rows-[1fr] border-t border-white/10'
                      : 'grid-rows-[0fr] border-transparent'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="grid gap-4 bg-black/60 p-5 backdrop-blur-xl sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                        <p className="mb-2 text-xs text-white/60">Your QR code</p>
                        <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-2xl bg-black/70 p-4">
                          <img src={ticket.qrCode} alt={`${ticket.title} QR`} className="h-full w-full object-contain" />
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-white/60">
                          <QrCode className="h-4 w-4" />
                          <span>Show this at entry</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="mb-2 text-xs text-white/60">Ticket benefits</p>
                          <ul className="space-y-2 text-xs text-white/80 sm:text-sm">
                            <li>• Priority entry line</li>
                            <li>• Access to VIP lounge</li>
                            <li>• Complimentary welcome drink</li>
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="mb-2 text-xs text-white/60">Need help?</p>
                          <p className="text-xs text-white/70 sm:text-sm">
                            Contact support@yardpass.com for ticket transfers, refunds, or account assistance.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ArrowLeftIcon() {
  return <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M15.75 19.5 8.25 12l7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
