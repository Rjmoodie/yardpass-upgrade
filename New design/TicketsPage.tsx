import { QrCode, Download, Share2, MoreVertical, Clock, MapPin, Calendar } from "lucide-react";
import { useState } from "react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface Ticket {
  id: string;
  eventName: string;
  eventImage: string;
  date: string;
  time: string;
  location: string;
  ticketType: string;
  price: string;
  qrCode: string;
  status: 'active' | 'used' | 'upcoming';
}

const mockTickets: Ticket[] = [
  {
    id: "1",
    eventName: "Summer Music Festival 2025",
    eventImage: "https://images.unsplash.com/photo-1656283384093-1e227e621fad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    date: "Aug 15, 2025",
    time: "6:00 PM",
    location: "Central Park, NYC",
    ticketType: "VIP Pass",
    price: "$150",
    qrCode: "QR123456789",
    status: "upcoming"
  },
  {
    id: "2",
    eventName: "Tech Conference 2025",
    eventImage: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    date: "Sep 20, 2025",
    time: "9:00 AM",
    location: "Convention Center",
    ticketType: "General Admission",
    price: "$120",
    qrCode: "QR987654321",
    status: "upcoming"
  },
  {
    id: "3",
    eventName: "Jazz Night Live",
    eventImage: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800",
    date: "Jul 10, 2025",
    time: "8:00 PM",
    location: "Blue Note NYC",
    ticketType: "Premium",
    price: "$80",
    qrCode: "QR456123789",
    status: "used"
  }
];

export function TicketsPage() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  const filteredTickets = mockTickets.filter(ticket => 
    activeTab === 'upcoming' ? ticket.status === 'upcoming' : ticket.status === 'used'
  );

  return (
    <div className="min-h-screen bg-black pb-20 pt-4 sm:pt-6">
      {/* Header */}
      <div className="mb-6 px-3 sm:px-4 md:px-6">
        <h1 className="mb-2 text-white">My Tickets</h1>
        <p className="text-sm text-white/60 sm:text-base">
          {filteredTickets.length} {activeTab === 'upcoming' ? 'upcoming' : 'past'} tickets
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 px-3 sm:px-4 md:px-6">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 rounded-full py-2.5 text-sm transition-all sm:py-3 sm:text-base ${
            activeTab === 'upcoming'
              ? 'bg-[#FF8C00] text-white shadow-lg'
              : 'border border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`flex-1 rounded-full py-2.5 text-sm transition-all sm:py-3 sm:text-base ${
            activeTab === 'past'
              ? 'bg-[#FF8C00] text-white shadow-lg'
              : 'border border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          Past Events
        </button>
      </div>

      {/* Tickets List */}
      <div className="space-y-4 px-3 sm:space-y-5 sm:px-4 md:px-6">
        {filteredTickets.map((ticket) => (
          <div
            key={ticket.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl transition-all hover:border-white/20 hover:shadow-xl sm:rounded-3xl"
          >
            {/* Card Header */}
            <div className="relative h-32 overflow-hidden sm:h-40 md:h-48">
              <ImageWithFallback
                src={ticket.eventImage}
                alt={ticket.eventName}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/90" />
              
              {/* Status Badge */}
              <div className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs backdrop-blur-md sm:text-sm ${
                ticket.status === 'upcoming' 
                  ? 'bg-green-500/80 text-white' 
                  : 'bg-white/20 text-white/80'
              }`}>
                {ticket.status === 'upcoming' ? 'Active' : 'Used'}
              </div>

              {/* Event Name Overlay */}
              <div className="absolute bottom-3 left-3 right-3">
                <h3 className="text-white drop-shadow-lg">{ticket.eventName}</h3>
              </div>
            </div>

            {/* Card Content */}
            <div className="p-4 sm:p-5">
              {/* Ticket Info */}
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 text-white/50 sm:h-5 sm:w-5" />
                  <div>
                    <p className="text-xs text-white/50 sm:text-sm">Date</p>
                    <p className="text-sm text-white sm:text-base">{ticket.date}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 text-white/50 sm:h-5 sm:w-5" />
                  <div>
                    <p className="text-xs text-white/50 sm:text-sm">Time</p>
                    <p className="text-sm text-white sm:text-base">{ticket.time}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2 sm:col-span-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-white/50 sm:h-5 sm:w-5" />
                  <div>
                    <p className="text-xs text-white/50 sm:text-sm">Location</p>
                    <p className="text-sm text-white sm:text-base">{ticket.location}</p>
                  </div>
                </div>
              </div>

              {/* Ticket Type & Price */}
              <div className="mb-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                <div>
                  <p className="text-xs text-white/50 sm:text-sm">Ticket Type</p>
                  <p className="text-sm text-white sm:text-base">{ticket.ticketType}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/50 sm:text-sm">Price</p>
                  <p className="text-base text-[#FF8C00] sm:text-lg">{ticket.price}</p>
                </div>
              </div>

              {/* QR Code Section */}
              {ticket.status === 'upcoming' && (
                <div className="mb-4">
                  <button
                    onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF8C00]/20">
                          <QrCode className="h-5 w-5 text-[#FF8C00]" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm text-white sm:text-base">Show QR Code</p>
                          <p className="text-xs text-white/50">Tap to expand</p>
                        </div>
                      </div>
                      <div className={`transform transition-transform ${expandedTicket === ticket.id ? 'rotate-180' : ''}`}>
                        <MoreVertical className="h-5 w-5 text-white/50" />
                      </div>
                    </div>
                  </button>

                  {/* Expanded QR Code */}
                  {expandedTicket === ticket.id && (
                    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-6 text-center">
                      <div className="mx-auto mb-4 flex h-48 w-48 items-center justify-center rounded-2xl bg-white sm:h-64 sm:w-64">
                        {/* Placeholder QR Code */}
                        <div className="text-center">
                          <QrCode className="mx-auto mb-2 h-32 w-32 text-black sm:h-48 sm:w-48" />
                          <p className="text-xs text-black/60">{ticket.qrCode}</p>
                        </div>
                      </div>
                      <p className="text-xs text-white/60 sm:text-sm">
                        Show this code at the venue entrance
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 py-2.5 text-xs text-white transition-all hover:bg-white/10 active:scale-95 sm:text-sm">
                  <Download className="h-4 w-4" />
                  Download
                </button>
                <button className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 py-2.5 text-xs text-white transition-all hover:bg-white/10 active:scale-95 sm:text-sm">
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
                <button className="col-span-2 flex items-center justify-center gap-2 rounded-full bg-[#FF8C00] py-2.5 text-xs text-white transition-all hover:bg-[#FF9D1A] active:scale-95 sm:col-span-1 sm:text-sm">
                  View Event
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Empty State */}
        {filteredTickets.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center backdrop-blur-xl sm:rounded-3xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
              <QrCode className="h-8 w-8 text-white/30" />
            </div>
            <h3 className="mb-2 text-white">No {activeTab} tickets</h3>
            <p className="text-sm text-white/60">
              {activeTab === 'upcoming' 
                ? 'Get tickets to upcoming events to see them here'
                : 'Your past event tickets will appear here'}
            </p>
            {activeTab === 'upcoming' && (
              <button className="mt-6 rounded-full bg-[#FF8C00] px-6 py-3 text-sm text-white transition-all hover:bg-[#FF9D1A] active:scale-95">
                Browse Events
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
