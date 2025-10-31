import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, Download, Share2, MoreVertical, Clock, MapPin, Calendar, ChevronDown } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";

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
  eventId?: string;
}

export default function TicketsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrCodeImages, setQrCodeImages] = useState<Record<string, string>>({});

  // Load user tickets
  useEffect(() => {
    const loadTickets = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('tickets')
          .select(`
            id,
            status,
            qr_code,
            created_at,
            event_id,
            events!fk_tickets_event_id (
              id,
              title,
              start_at,
              venue,
              address,
              cover_image_url
            ),
            ticket_tiers!fk_tickets_tier_id (
              name,
              price_cents
            )
          `)
          .eq('owner_user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Map to the format expected by UI
        const mappedTickets: Ticket[] = (data || []).map((ticket: any) => {
          const event = ticket.events || {};
          const tier = ticket.ticket_tiers || {};
          const startDate = event.start_at ? new Date(event.start_at) : new Date();
          const isPast = startDate < new Date();
          
          return {
            id: ticket.id,
            eventName: event.title || 'Event',
            eventImage: event.cover_image_url || '',
            eventId: event.id,
            date: startDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            }),
            time: startDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit'
            }),
            location: `${event.venue || 'Venue TBA'}${event.address ? ', ' + event.address : ''}`,
            ticketType: tier.name || 'General Admission',
            price: tier.price_cents ? `$${(tier.price_cents / 100).toFixed(2)}` : 'Free',
            qrCode: ticket.qr_code || '',
            status: ticket.status === 'used' || isPast ? 'used' : 'upcoming'
          };
        });

        setTickets(mappedTickets);

        // Generate QR codes for active tickets
        const qrPromises = mappedTickets
          .filter(t => t.status === 'upcoming' && t.qrCode)
          .map(async (ticket) => {
            try {
              const qrDataUrl = await QRCode.toDataURL(ticket.qrCode, {
                width: 400,
                margin: 2,
                color: {
                  dark: '#000000',
                  light: '#FFFFFF'
                }
              });
              return { id: ticket.id, dataUrl: qrDataUrl };
            } catch (err) {
              console.error('Error generating QR code:', err);
              return null;
            }
          });

        const qrResults = await Promise.all(qrPromises);
        const qrMap: Record<string, string> = {};
        qrResults.forEach(result => {
          if (result) {
            qrMap[result.id] = result.dataUrl;
          }
        });
        setQrCodeImages(qrMap);

      } catch (error) {
        console.error('Error loading tickets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTickets();
  }, [user?.id]);

  const filteredTickets = tickets.filter(ticket => 
    activeTab === 'upcoming' ? ticket.status === 'upcoming' : ticket.status === 'used'
  );

  const handleShare = async (ticket: Ticket) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: ticket.eventName,
          text: `Check out my ticket for ${ticket.eventName}!`,
          url: window.location.origin + `/e/${ticket.eventId}`
        });
      } catch (err) {
        console.log('Share cancelled or failed');
      }
    }
  };

  const handleDownload = (ticket: Ticket) => {
    const qrImage = qrCodeImages[ticket.id];
    if (!qrImage) return;

    const link = document.createElement('a');
    link.href = qrImage;
    link.download = `${ticket.eventName.replace(/\s+/g, '-')}-ticket-${ticket.id}.png`;
    link.click();
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-border/10 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 pt-4 sm:pt-6">
      {/* Header */}
      <div className="mb-6 px-3 sm:px-4 md:px-6">
        <h1 className="mb-2 text-3xl font-bold text-foreground sm:text-4xl">My Tickets</h1>
        <p className="text-sm text-foreground/60 sm:text-base">
          {filteredTickets.length} {activeTab === 'upcoming' ? 'upcoming' : 'past'} ticket{filteredTickets.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 px-3 sm:px-4 md:px-6">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-all sm:py-3 sm:text-base ${
            activeTab === 'upcoming'
              ? 'bg-primary text-foreground shadow-lg'
              : 'border border-border/10 bg-white/5 text-foreground/60 hover:bg-white/10'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-all sm:py-3 sm:text-base ${
            activeTab === 'past'
              ? 'bg-primary text-foreground shadow-lg'
              : 'border border-border/10 bg-white/5 text-foreground/60 hover:bg-white/10'
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
            className="overflow-hidden rounded-2xl border border-border/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl transition-all hover:border-border/20 hover:shadow-xl sm:rounded-3xl"
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
              <div className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-md sm:text-sm ${
                ticket.status === 'upcoming' 
                  ? 'bg-green-500/80 text-foreground' 
                  : 'bg-white/20 text-foreground/80'
              }`}>
                {ticket.status === 'upcoming' ? 'Active' : 'Used'}
              </div>

              {/* Event Name Overlay */}
              <div className="absolute bottom-3 left-3 right-3">
                <div className="inline-block max-w-full rounded-lg bg-background/90 px-3 py-2 backdrop-blur-md">
                  <h3 className="text-lg font-bold text-foreground sm:text-xl">{ticket.eventName}</h3>
                </div>
              </div>
            </div>

            {/* Card Content */}
            <div className="p-4 sm:p-5">
              {/* Ticket Info */}
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 text-foreground/50 sm:h-5 sm:w-5" />
                  <div>
                    <p className="text-xs text-foreground/50 sm:text-sm">Date</p>
                    <p className="text-sm font-medium text-foreground sm:text-base">{ticket.date}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 text-foreground/50 sm:h-5 sm:w-5" />
                  <div>
                    <p className="text-xs text-foreground/50 sm:text-sm">Time</p>
                    <p className="text-sm font-medium text-foreground sm:text-base">{ticket.time}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2 sm:col-span-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-foreground/50 sm:h-5 sm:w-5" />
                  <div>
                    <p className="text-xs text-foreground/50 sm:text-sm">Location</p>
                    <p className="text-sm font-medium text-foreground sm:text-base">{ticket.location}</p>
                  </div>
                </div>
              </div>

              {/* Ticket Type & Price */}
              <div className="mb-4 flex items-center justify-between rounded-xl border border-border/10 bg-white/5 p-3">
                <div>
                  <p className="text-xs text-foreground/50 sm:text-sm">Ticket Type</p>
                  <p className="text-sm font-semibold text-foreground sm:text-base">{ticket.ticketType}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-foreground/50 sm:text-sm">Price</p>
                  <p className="text-base font-bold text-primary sm:text-lg">{ticket.price}</p>
                </div>
              </div>

              {/* QR Code Section */}
              {ticket.status === 'upcoming' && ticket.qrCode && (
                <div className="mb-4">
                  <button
                    onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                    className="w-full rounded-xl border border-border/10 bg-white/5 p-4 transition-all hover:bg-white/10"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                          <QrCode className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-foreground sm:text-base">Show QR Code</p>
                          <p className="text-xs text-foreground/50">Tap to expand</p>
                        </div>
                      </div>
                      <div className={`transform transition-transform ${expandedTicket === ticket.id ? 'rotate-180' : ''}`}>
                        <ChevronDown className="h-5 w-5 text-foreground/50" />
                      </div>
                    </div>
                  </button>

                  {/* Expanded QR Code */}
                  {expandedTicket === ticket.id && (
                    <div className="mt-4 rounded-xl border border-border/10 bg-white/5 p-6 text-center">
                      {qrCodeImages[ticket.id] ? (
                        <div className="mx-auto mb-4 flex h-48 w-48 items-center justify-center rounded-2xl bg-white p-4 sm:h-64 sm:w-64">
                          <img 
                            src={qrCodeImages[ticket.id]} 
                            alt="QR Code"
                            className="h-full w-full"
                          />
                        </div>
                      ) : (
                        <div className="mx-auto mb-4 flex h-48 w-48 items-center justify-center rounded-2xl bg-white sm:h-64 sm:w-64">
                          <div className="h-12 w-12 animate-spin rounded-full border-4 border-black/10 border-t-primary" />
                        </div>
                      )}
                      <p className="text-xs font-medium text-foreground/60 sm:text-sm">
                        Show this code at the venue entrance
                      </p>
                      <p className="mt-2 text-xs text-foreground/40">
                        {ticket.qrCode}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button 
                  onClick={() => handleDownload(ticket)}
                  disabled={!qrCodeImages[ticket.id]}
                  className="flex items-center justify-center gap-2 rounded-full border border-border/10 bg-white/5 py-2.5 text-xs font-medium text-foreground transition-all hover:bg-white/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed sm:text-sm"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
                <button 
                  onClick={() => handleShare(ticket)}
                  className="flex items-center justify-center gap-2 rounded-full border border-border/10 bg-white/5 py-2.5 text-xs font-medium text-foreground transition-all hover:bg-white/10 active:scale-95 sm:text-sm"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
                <button 
                  onClick={() => ticket.eventId && navigate(`/e/${ticket.eventId}`)}
                  className="col-span-2 flex items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-xs font-semibold text-foreground transition-all hover:bg-[#FF9D1A] active:scale-95 sm:col-span-1 sm:text-sm"
                >
                  View Event
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Empty State */}
        {filteredTickets.length === 0 && (
          <div className="rounded-2xl border border-border/10 bg-white/5 p-12 text-center backdrop-blur-xl sm:rounded-3xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
              <QrCode className="h-8 w-8 text-foreground/30" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-foreground">No {activeTab} tickets</h3>
            <p className="text-sm text-foreground/60">
              {activeTab === 'upcoming' 
                ? 'Get tickets to upcoming events to see them here'
                : 'Your past event tickets will appear here'}
            </p>
            {activeTab === 'upcoming' && (
              <button 
                onClick={() => navigate('/search')}
                className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-foreground transition-all hover:bg-[#FF9D1A] active:scale-95"
              >
                Browse Events
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
