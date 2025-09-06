// ...imports unchanged...

export interface UserTicket {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  city: string;
  eventLocation: string;
  coverImage: string;
  ticketType: string;
  badge: string;
  qrCode: string;
  status: string;
  price: number;
  orderDate: string;
  isUpcoming: boolean;
  organizerName?: string;

  // NEW (for ICS / richer UX)
  startISO?: string;
  endISO?: string;
  timezone?: string;
  address?: string;
  url?: string;
}

// ...inside transform()
  const transform = useCallback((raw: any): UserTicket => {
    const startAt = raw?.events?.start_at ? new Date(raw.events.start_at) : new Date();
    const endAt = raw?.events?.end_at ? new Date(raw.events.end_at) : undefined;
    const now = new Date();
    const title = raw?.events?.title || 'Event';
    const venue = raw?.events?.venue || 'TBA';
    const city = raw?.events?.city || '';

    return {
      id: raw.id,
      eventId: raw.events?.id || '',
      eventTitle: title,
      eventDate: startAt.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      }),
      eventTime: startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      venue,
      city,
      eventLocation: city ? `${venue}, ${city}` : venue,
      coverImage: raw.events?.cover_image_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30',
      ticketType: raw.ticket_tiers?.name || 'General',
      badge: raw.ticket_tiers?.badge_label || 'GA',
      qrCode: raw.qr_code,
      status: raw.status,
      price: (raw.ticket_tiers?.price_cents || 0) / 100,
      orderDate: raw.orders?.created_at || raw.created_at,
      isUpcoming: startAt > now,
      organizerName: raw.events?.organizer_name || 'Event Organizer',

      // NEW
      startISO: raw?.events?.start_at || undefined,
      endISO: raw?.events?.end_at || undefined,
      timezone: raw?.events?.timezone || undefined,
      address: raw?.events?.address || undefined,
      url: raw?.events?.slug ? `${window.location.origin}/events/${raw.events.slug}` :
           raw?.events?.id ? `${window.location.origin}/events/${raw.events.id}` : undefined
    };
  }, []);
