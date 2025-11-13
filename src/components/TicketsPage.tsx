import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Download,
  MapPin,
  QrCode,
  Share2,
  Ticket,
  LogOut,
  Clock,
  CheckCircle,
  Mail,
  Phone,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { GuestSession } from '@/hooks/useGuestTicketSession';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import QRCode from 'qrcode';

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
  eventId?: string;
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


export default function TicketsPage({
  guestToken,
  guestScope,
  guestSession,
  focusEventId,
  onGuestSignOut,
  onGuestSessionExpired,
  onExtendGuestSession,
  onBack
}: TicketsPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [allTickets, setAllTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeImages, setQrCodeImages] = useState<Record<string, string>>({});

  const tickets = useMemo(() => {
    return allTickets.filter((ticket) =>
      activeTab === 'upcoming' ? ticket.status === 'active' : ticket.status === 'used',
    );
  }, [activeTab, allTickets]);

  const { toast } = useToast();

  const toggleExpand = (ticketId: string) => {
    setExpandedTicket((current) => (current === ticketId ? null : ticketId));
  };

  const handleEventClick = (eventId: string | undefined, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent ticket expansion when clicking event name
    if (eventId) {
      navigate(`/e/${eventId}`);
    }
  };

  // Fetch member tickets
  useEffect(() => {
    const fetchMemberTickets = async () => {
      // Skip if guest token present (use guest fetch instead)
      if (guestToken || !user?.id) {
        if (!guestToken) setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log('[TicketsPage] Fetching member tickets for user:', user.id);

        const { data, error: fetchError } = await supabase
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
              city,
              cover_image_url,
              created_by
            ),
            ticket_tiers!fk_tickets_tier_id (
              name,
              badge_label,
              price_cents
            )
          `)
          .eq('owner_user_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        console.log('[TicketsPage] Member tickets response:', {
          ticketCount: data?.length || 0,
          firstTicket: data?.[0],
        });

        // Get organizer names
        const eventCreatorIds = [...new Set(data?.map((t: any) => t.events?.created_by).filter(Boolean))];
        const { data: organizerProfiles } = eventCreatorIds.length
          ? await supabase
              .from('user_profiles')
              .select('user_id, display_name')
              .in('user_id', eventCreatorIds)
          : { data: [] };

        const organizerMap = new Map(
          (organizerProfiles || []).map((p: any) => [p.user_id, p.display_name])
        );

        // Map to TicketItem format
        const mappedTickets: TicketItem[] = (data || []).map((ticket: any) => {
          const event = ticket.events || {};
          const tier = ticket.ticket_tiers || {};

          let eventDate: Date | null = null;
          let dateString = 'Date TBA';

          try {
            if (event.start_at) {
              eventDate = new Date(event.start_at);
              if (!isNaN(eventDate.getTime())) {
                dateString = eventDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
              }
            }
          } catch (err) {
            console.error('Error parsing date:', err);
          }

          const isPast = eventDate && eventDate < new Date();
          let priceDisplay = 'Free';
          if (tier.price_cents && tier.price_cents > 0) {
            priceDisplay = `$${(tier.price_cents / 100).toFixed(2)}`;
          }

          const ticketStatus = ticket.status === 'redeemed' || isPast ? 'used' : 'active';

          return {
            id: ticket.id,
            status: ticketStatus,
            title: event.title || 'Event',
            date: dateString,
            location: `${event.venue || event.city || 'Location TBA'}`,
            ticketType: tier.badge_label || tier.name || 'General Admission',
            price: priceDisplay,
            image: event.cover_image_url || '',
            qrCode: ticket.qr_code || '',
            organizer: organizerMap.get(event.created_by) || 'Organizer',
            eventId: event.id,
          };
        });

        setAllTickets(mappedTickets);

        // Generate QR codes
        const qrPromises = mappedTickets
          .filter(t => t.qrCode)
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
              console.error('[TicketsPage] Error generating QR code:', err);
              return null;
            }
          });

        const qrResults = await Promise.all(qrPromises);
        const qrMap: Record<string, string> = {};
        qrResults.forEach(result => {
          if (result) qrMap[result.id] = result.dataUrl;
        });
        setQrCodeImages(qrMap);

      } catch (err: any) {
        console.error('Error fetching member tickets:', err);
        setError(err?.message || 'Failed to load tickets');
        toast({
          title: 'Error loading tickets',
          description: err?.message || 'Please try again',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMemberTickets();
  }, [user?.id, guestToken, toast]);

  // Fetch guest tickets
  useEffect(() => {
    const fetchGuestTickets = async () => {
      if (!guestToken) {
        return; // Member fetch will handle this
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase.functions.invoke('tickets-list-guest', {
          body: { token: guestToken },
        });

        if (fetchError) throw fetchError;

        console.log('[TicketsPage] Guest tickets response:', {
          ticketCount: data?.tickets?.length || 0,
          firstTicket: data?.tickets?.[0],
          firstTicketQR: data?.tickets?.[0]?.qr_code,
        });

        // Map the response to TicketItem format
        const mappedTickets: TicketItem[] = (data?.tickets || []).map((ticket: any) => {
          // event_date is timestamp with time zone, event_time is time without time zone
          let eventDate: Date | null = null;
          let dateString = 'Date TBA';
          
          try {
            if (ticket.event_date) {
              // event_date is already a full timestamp
              eventDate = new Date(ticket.event_date);
              
              if (!isNaN(eventDate.getTime())) {
                dateString = eventDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                });
              }
            }
          } catch (err) {
            console.error('Error parsing date:', err);
          }

          const isPast = eventDate && eventDate < new Date();

          // Format price: numeric -> string
          let priceDisplay = 'Free';
          if (ticket.price && parseFloat(ticket.price) > 0) {
            priceDisplay = `$${parseFloat(ticket.price).toFixed(2)}`;
          }

          // Determine status - only mark as used if redeemed or event is truly past
          const ticketStatus = ticket.status === 'redeemed' || isPast ? 'used' : 'active';

          console.log('[TicketsPage] Ticket status check:', {
            id: ticket.id,
            eventTitle: ticket.event_title,
            eventDate: ticket.event_date,
            parsedDate: eventDate,
            isPast,
            dbStatus: ticket.status,
            finalStatus: ticketStatus,
            hasQR: !!ticket.qr_code,
          });

          return {
            id: ticket.id,
            status: ticketStatus,
            title: ticket.event_title || 'Event',
            date: dateString,
            location: ticket.event_location || 'Location TBA',
            ticketType: ticket.ticket_type || ticket.badge || 'General Admission',
            price: priceDisplay,
            image: ticket.cover_image || '',
            qrCode: ticket.qr_code || '',
            organizer: ticket.organizer_name || 'Organizer',
            eventId: ticket.event_id,
          };
        });

        setAllTickets(mappedTickets);

        // Generate QR codes for all tickets (both active and past)
        console.log('[TicketsPage] Generating QR codes for tickets:', {
          totalTickets: mappedTickets.length,
          withQR: mappedTickets.filter(t => t.qrCode).length,
          activeCount: mappedTickets.filter(t => t.status === 'active').length,
          usedCount: mappedTickets.filter(t => t.status === 'used').length,
          sampleTicketId: mappedTickets[0]?.id,
          sampleQRCode: mappedTickets[0]?.qrCode?.substring(0, 50),
        });

        const qrPromises = mappedTickets
          .filter(t => t.qrCode) // Generate for ALL tickets with QR codes, not just active
          .map(async (ticket) => {
            try {
              console.log('[TicketsPage] Generating QR for ticket:', ticket.id, 'with code:', ticket.qrCode.substring(0, 30));
              const qrDataUrl = await QRCode.toDataURL(ticket.qrCode, {
                width: 400,
                margin: 2,
                color: {
                  dark: '#000000',
                  light: '#FFFFFF'
                }
              });
              console.log('[TicketsPage] ✅ QR generated for:', ticket.id);
              return { id: ticket.id, dataUrl: qrDataUrl };
            } catch (err) {
              console.error('[TicketsPage] ❌ Error generating QR code for ticket:', ticket.id, err);
              return null;
            }
          });

        const qrResults = await Promise.all(qrPromises);
        console.log('[TicketsPage] QR promises resolved:', qrResults.length, 'results');
        
        const qrMap: Record<string, string> = {};
        qrResults.forEach((result, index) => {
          if (result) {
            console.log(`[TicketsPage] Adding QR ${index + 1}:`, result.id);
            qrMap[result.id] = result.dataUrl;
          } else {
            console.warn(`[TicketsPage] Null result at index ${index}`);
          }
        });
        
        console.log('[TicketsPage] Setting QR code images state with', Object.keys(qrMap).length, 'images');
        setQrCodeImages(qrMap);

        console.log('[TicketsPage] ✅ QR code generation complete:', {
          generated: Object.keys(qrMap).length,
          ticketIds: Object.keys(qrMap),
          hasImages: Object.keys(qrMap).length > 0,
        });
      } catch (err: any) {
        console.error('Error fetching guest tickets:', err);
        setError(err?.message || 'Failed to load tickets');
        toast({
          title: 'Error loading tickets',
          description: err?.message || 'Please try again',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchGuestTickets();
  }, [guestToken, toast]);

  return (
    <div className="min-h-screen bg-black pb-nav">
      {/* Guest Session Banner */}
      {guestSession && (
        <div className="sticky top-0 z-40 border-b border-green-500/20 bg-green-900/20 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
            <div className="flex items-center gap-2 flex-1">
              {guestSession.email ? (
                <>
                  <Mail className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-white">{guestSession.email}</span>
                </>
              ) : guestSession.phone ? (
                <>
                  <Phone className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-white">{guestSession.phone}</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span className="text-sm text-white">Guest Session Active</span>
                </>
              )}
              {guestSession.exp && (
                <span className="text-xs text-white/60 hidden sm:inline">
                  • Expires {new Date(guestSession.exp).toLocaleTimeString()}
                </span>
              )}
            </div>
            {onGuestSignOut && (
              <button
                onClick={onGuestSignOut}
                className="flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/20"
              >
                <LogOut className="h-3 w-3" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-3 py-4 sm:px-4 sm:py-5">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-all hover:bg-white/10"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h1 className="text-white">{guestSession ? 'Guest Tickets' : 'My Tickets'}</h1>
              <p className="text-xs text-white/60 sm:text-sm">
                {guestSession ? 'Your event tickets' : 'All your events in one place'}
              </p>
            </div>
          </div>

        </div>

        <div className="mx-auto flex w-full max-w-5xl gap-2 px-3 pb-4 sm:px-4">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 rounded-full px-4 py-2 text-sm transition-colors duration-100 sm:text-base ${
              activeTab === 'upcoming' ? 'bg-[#1171c0] text-white shadow-lg' : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`flex-1 rounded-full px-4 py-2 text-sm transition-colors duration-100 sm:text-base ${
              activeTab === 'past' ? 'bg-[#1171c0] text-white shadow-lg' : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            Past
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-3 pt-4 sm:px-4">
        {loading ? (
          <div className="mt-12 flex flex-col items-center justify-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-primary" />
            <p className="text-sm text-white/60">Loading your tickets...</p>
          </div>
        ) : error ? (
          <div className="mt-12 rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-center">
            <p className="text-red-400">{error}</p>
            {onExtendGuestSession && (
              <button
                onClick={onExtendGuestSession}
                className="mt-4 rounded-full bg-primary px-6 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary/90"
              >
                Try Again
              </button>
            )}
          </div>
        ) : tickets.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-dashed border-white/20 bg-white/5 p-8 text-center text-white/70">
            <Ticket className="mx-auto mb-4 h-12 w-12 text-white/40" />
            <h2 className="mb-2 text-lg text-white">No tickets found</h2>
            <p className="mb-4 text-sm text-white/60">
              {guestSession
                ? 'No tickets found for this contact. Make sure you used the same email or phone when purchasing.'
                : 'Buy your first ticket to see it here.'}
            </p>
            {!guestSession && (
              <button className="rounded-full bg-[#1171c0] px-6 py-2 text-sm font-medium text-white transition hover:bg-[#0d5aa1]">
                Discover Events
              </button>
            )}
          </div>
        ) : (
          <div key={activeTab} className="space-y-4 pb-nav">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl transition-colors duration-150 hover:border-white/20 hover:shadow-xl"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(ticket.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(ticket.id);
                    }
                  }}
                  className="flex w-full flex-col text-left sm:flex-row cursor-pointer hover:bg-white/[0.02] transition-colors duration-100 relative"
                >
                  {/* Tap to expand hint - only show when collapsed */}
                  {expandedTicket !== ticket.id && (
                    <div className="absolute top-2 right-2 rounded-full bg-primary/20 px-2 py-1 text-[10px] text-primary font-medium border border-primary/30 backdrop-blur-sm">
                      Tap for QR
                    </div>
                  )}
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
                        <h3 
                          onClick={(e) => handleEventClick(ticket.eventId, e)}
                          className="text-base text-white sm:text-lg cursor-pointer hover:text-[#1171c0] transition-colors underline-offset-2 hover:underline"
                        >
                          {ticket.title}
                        </h3>
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
                      {/* Expand indicator */}
                      <div className="flex items-center gap-1 text-xs text-white/50">
                        <QrCode className="h-4 w-4" />
                        {expandedTicket === ticket.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={`grid transition-all duration-200 ${
                    expandedTicket === ticket.id
                      ? 'grid-rows-[1fr] border-t border-white/10'
                      : 'grid-rows-[0fr] border-transparent'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="bg-black/60 p-5 backdrop-blur-xl">
                      {/* QR Code Section - Full Width */}
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                        <p className="mb-3 text-sm font-semibold text-white">Scan at Entry</p>
                        <div className="mx-auto flex h-56 w-56 sm:h-64 sm:w-64 items-center justify-center rounded-2xl bg-white p-4 shadow-xl">
                          {qrCodeImages[ticket.id] ? (
                            <img 
                              src={qrCodeImages[ticket.id]} 
                              alt={`${ticket.title} QR Code`} 
                              className="h-full w-full object-contain" 
                            />
                          ) : ticket.qrCode ? (
                            <div className="flex flex-col items-center gap-3 w-full">
                              <QrCode className="h-12 w-12 text-gray-400 animate-pulse" />
                              <span className="text-sm text-gray-500">Generating...</span>
                              <div className="text-xs text-gray-400 text-center mt-2">
                                Code: {ticket.qrCode}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-3">
                              <QrCode className="h-12 w-12 text-gray-400" />
                              <span className="text-sm text-gray-500">No QR code available</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-white/80">
                          <QrCode className="h-4 w-4" />
                          <span>Show this code at venue entrance</span>
                        </div>
                        {ticket.qrCode && (
                          <p className="mt-3 text-[11px] text-white/40 font-mono break-all px-4">
                            Code: {ticket.qrCode}
                          </p>
                        )}
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
